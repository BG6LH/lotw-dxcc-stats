import fs from "fs";
import { saveJSONData } from "./file-manager.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schema = JSON.parse(
  fs.readFileSync(
    join(__dirname, "../schemas/lotw-dxcc-data.schema.json"),
    "utf8",
  ),
);

/**
 * 解析ADIF数据为JSON格式
 * 使用原有的解析逻辑，从 update-lotw-data.js 移植过来
 */
const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(schema);

// 修改函数签名
export function parseADIFToJSON(adifFilePath, configContext) {
  console.log("[LoTW-DXCC] ADIF-parser: Parsing ADIF file to JSON...");

  if (!fs.existsSync(adifFilePath)) {
    throw new Error(`ADIF file not found: ${adifFilePath}`);
  }

  try {
    const adifData = fs.readFileSync(adifFilePath, "utf8");

    // 提取头部信息
    const headerMatch = adifData.match(/^([\s\S]*?)<eoh>/i);
    const header = headerMatch ? headerMatch[1] : "";

    // 提取时间戳（传入完整的ADIF数据）
    const timestamps = extractTimestamps(header, adifData);

    // 解析记录
    const records = parseRecords(adifData);

    // 计算DXCC统计
    const stats = calculateDXCCStats(records);

    // 构建结果对象
    const result = {
      // 时间戳信息放在开头
      ...timestamps,
      last_updated: new Date().toISOString(),
      last_updated_timestamp: Date.now(),
      // 基本统计信息
      total_qso: stats.total_qso,
      total_qsl: stats.total_qsl,
      dxcc_confirmed: stats.dxcc_confirmed,
      // DXCC详细统计放在末尾
      dxcc_stats: stats.dxcc_stats,
    };

    // 验证数据结构
    if (!validate(result)) {
      console.warn(
        "[LoTW-DXCC] ADIF-parser: Data validation failed:",
        validate.errors,
      );
    }

    // 保存JSON文件
    // 修改第 64 行，使用 configContext 的工厂函数查询
    const jsonFilePath = configContext.getPath("json");
    saveJSONData(result, jsonFilePath);

    console.log(
      `[LoTW-DXCC] ADIF-parser: Parsed ${stats.total_qso} QSOs, ${stats.total_qsl} QSLs, ${stats.dxcc_confirmed} confirmed DXCCs`,
    );

    return result;
  } catch (error) {
    console.error("[LoTW-DXCC] ADIF-parser: Error parsing ADIF data:", error);
    throw error;
  }
}

/**
 * 从ADIF头部和记录中提取时间戳信息
 */
export function extractTimestamps(header, adifData = "") {
  const timestamps = {};

  // 提取 APP_LoTW_LASTQSORX（从头部）
  const qsoRxMatch = header.match(
    /<APP_LoTW_LASTQSORX:(\d+)>([\s\S]*?)(?=<|$)/i,
  );
  let qsoRxValue = null;
  if (qsoRxMatch) {
    const length = parseInt(qsoRxMatch[1]);
    qsoRxValue = qsoRxMatch[2].substring(0, length).trim();
    timestamps.app_lotw_lastQsoRx = qsoRxValue;
  }

  // 提取 APP_LoTW_RXQSL（从头部，作为备选）
  const qslMatch = header.match(/<APP_LoTW_RXQSL:(\d+)>([\s\S]*?)(?=<|$)/i);
  let latestQslTimestamp = null;
  let latestQslValue = null;

  if (qslMatch) {
    const length = parseInt(qslMatch[1]);
    latestQslValue = qslMatch[2].substring(0, length).trim();
    latestQslTimestamp = convertToTimestamp(latestQslValue);
  }

  // 从记录中提取最新的 QSL 时间戳
  if (adifData) {
    const recordsSection = adifData.split(/<eoh>/i)[1] || "";
    const allQslMatches = recordsSection.match(
      /<APP_LoTW_RXQSL:(\d+)>([\s\S]*?)(?=<|$)/gi,
    );

    if (allQslMatches) {
      for (const match of allQslMatches) {
        // 修复：移除 \s 匹配，确保能提取完整的时间戳
        const qslRecordMatch = match.match(
          /<APP_LoTW_RXQSL:(\d+)>([\s\S]*?)(?=<|$)/i,
        );
        if (qslRecordMatch) {
          const length = parseInt(qslRecordMatch[1]);
          // 确保提取完整的时间戳，包括时间部分
          const qslValue = qslRecordMatch[2].substring(0, length).trim();
          const qslTimestamp = convertToTimestamp(qslValue);

          if (!latestQslTimestamp || qslTimestamp > latestQslTimestamp) {
            latestQslTimestamp = qslTimestamp;
            latestQslValue = qslValue;
          }
        }
      }
    }
  }

  // 设置最新的QSL时间戳
  if (latestQslValue) {
    timestamps.app_lotw_lastQsl = latestQslValue;
  }

  return timestamps;
}

/**
 * 解析ADIF记录
 */
function parseRecords(adifData) {
  const records = [];
  const recordsSection = adifData.split(/<eoh>/i)[1] || "";
  const recordMatches = recordsSection.split(/<eor>/i);

  for (const recordText of recordMatches) {
    if (!recordText.trim()) continue;

    const record = {};
    const fieldMatches = recordText.match(/<([^:>]+):(\d+)>([^<]*)/gi);

    if (fieldMatches) {
      for (const fieldMatch of fieldMatches) {
        const match = fieldMatch.match(/<([^:>]+):(\d+)>([^<]*)/i);
        if (match) {
          const fieldName = match[1].toLowerCase();
          const fieldValue = match[3].trim(); // 添加 .trim() 去除换行符
          record[fieldName] = fieldValue;
        }
      }
      records.push(record);
    }
  }

  return records;
}

/**
 * 计算DXCC统计信息
 */
function calculateDXCCStats(records) {
  const dxccStats = {};
  let total_qso = 0;
  let total_qsl = 0;

  for (const record of records) {
    total_qso++;

    // 修复QSL确认状态检查逻辑
    const isQslConfirmed =
      record.qsl_rcvd === "Y" ||
      record.app_lotw_qsl_rcvd === "Y" ||
      record["app_lotw_qsl_rcvd"] === "Y";

    // 统计DXCC实体（排除编号为0的实体）
    if (record.dxcc) {
      const dxccCode = record.dxcc.trim();
      // 排除 DXCC 实体编号为 0 的记录
      if (dxccCode !== "0" && dxccCode !== "") {
        if (!dxccStats[dxccCode]) {
          dxccStats[dxccCode] = { qso: 0, qsl: 0 };
        }
        dxccStats[dxccCode].qso++;

        if (isQslConfirmed) {
          total_qsl++;
          if (dxccStats[dxccCode].qsl === 0) {
            dxccStats[dxccCode].qsl = 1;
          }
        }
      } else if (isQslConfirmed) {
        // 对于 DXCC 编号为 0 的记录，仍然计入 total_qsl
        total_qsl++;
      }
    }
  }

  // 计算已确认的DXCC实体数量
  const dxcc_confirmed = Object.values(dxccStats).filter(
    (stats) => stats.qsl > 0,
  ).length;

  return {
    total_qso,
    total_qsl,
    dxcc_confirmed,
    dxcc_stats: dxccStats,
  };
}

/**
 * 将LoTW时间戳转换为数字时间戳
 */
function convertToTimestamp(lotwTimestamp) {
  try {
    // LoTW时间戳格式通常是 "YYYY-MM-DD HH:MM:SS"
    const date = new Date(lotwTimestamp);
    return date.getTime();
  } catch (error) {
    console.warn(
      `[LoTW-DXCC] ADIF-parser: Failed to convert timestamp: ${lotwTimestamp}`,
    );
    return 0;
  }
}

/**
 * 流式处理大型ADIF文件
 * 适用于内存受限或文件极大的情况
 */
async function parseRecordsStream(adifFilePath, callback) {
  const fileStream = createReadStream(adifFilePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let currentRecord = "";
  let inRecordsSection = false;

  for await (const line of rl) {
    if (!inRecordsSection) {
      if (line.toLowerCase().includes("<eoh>")) {
        inRecordsSection = true;
      }
      continue;
    }

    currentRecord += line;

    // 检查是否包含完整记录
    if (line.toLowerCase().includes("<eor>")) {
      const record = parseRecord(currentRecord);
      if (record && Object.keys(record).length > 0) {
        await callback(record);
      }
      currentRecord = "";
    }
  }
}

function parseRecord(recordText) {
  const record = {};
  const matches = recordText.matchAll(/<([^:>]+):(\d+)>([^<]*)/g);

  for (const match of matches) {
    const fieldName = match[1].toLowerCase();
    const fieldLength = parseInt(match[2], 10);
    const fieldValue = match[3].substring(0, fieldLength).trim();
    record[fieldName] = fieldValue;
  }

  return record;
}
