import fs from "fs";
import { saveADIFData } from "./file-manager.js";

/**
 * 读取ADIF文件并分离头部和记录
 * @param {string} adifFilePath - ADIF文件路径
 * @returns {{header: string, records: string}} - 包含头部和记录的对象
 */
function _readADIFFileParts(adifFilePath) {
  if (!fs.existsSync(adifFilePath)) {
    throw new Error(`ADIF file not found: ${adifFilePath}`);
  }
  const adifData = fs.readFileSync(adifFilePath, "utf8");
  const headerMatch = adifData.match(/^[\s\S]*?<eoh>/i);
  const header = headerMatch ? headerMatch[0] : "";
  let records = adifData.split(/<eoh>/i)[1] || "";

  // 确保记录末尾有 <APP_LoTW_EOF> 标签
  if (!records.includes("<APP_LoTW_EOF>")) {
    records = records.trim() + "\n<APP_LoTW_EOF>";
  }

  return { header, records };
}

/**
 * 合并增量ADIF数据到现有文件
 * 使用原有脚本中的 processQSOIncrementalData 逻辑
 */
// 修改函数参数名
export async function mergeIncrementalADIFData(
  incrementalAdifData,
  adifFilePath,
  configContext,
) {
  console.log("[LoTW-DXCC] ADIF-processor: Merging incremental ADIF data...");

  const { header: existingHeader, records: existingRecords } =
    _readADIFFileParts(adifFilePath);

  // 提取增量数据的头部和记录
  const incrementalHeaderMatch = incrementalAdifData.match(/^([\s\S]*?)<eoh>/i);
  const incrementalHeader = incrementalHeaderMatch
    ? incrementalHeaderMatch[0]
    : "";
  let incrementalRecords = incrementalAdifData.split(/<eoh>/i)[1] || "";

  // 从增量记录开头移除 <APP_LoTW_EOF> 标签（如果存在）
  // 但保留文件末尾的 <APP_LoTW_EOF> 标签
  incrementalRecords = incrementalRecords
    .replace(/^\s*<APP_LoTW_EOF>\s*/, "")
    .trim();

  // 更新头部信息
  let updatedHeader = existingHeader;

  // 更新 Generated at 时间戳
  const now = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
  updatedHeader = updatedHeader.replace(
    /<PROGRAMID:[^>]*>Generated at [^<]*<\/PROGRAMID>/i,
    `<PROGRAMID:${("Generated at " + now).length}>Generated at ${now}</PROGRAMID>`,
  );

  // 更新 APP_LoTW_NUMREC（累加记录数）
  const existingNumRecMatch = updatedHeader.match(
    /<APP_LoTW_NUMREC:(\d+)>(\d+)/i,
  );
  const incrementalNumRecMatch = incrementalHeader.match(
    /<APP_LoTW_NUMREC:(\d+)>(\d+)/i,
  );

  if (existingNumRecMatch && incrementalNumRecMatch) {
    const existingCount = parseInt(existingNumRecMatch[2]);
    const incrementalCount = parseInt(incrementalNumRecMatch[2]);
    const totalCount = existingCount + incrementalCount;
    const totalCountStr = totalCount.toString();

    updatedHeader = updatedHeader.replace(
      /<APP_LoTW_NUMREC:\d+>\d+/i,
      `<APP_LoTW_NUMREC:${totalCountStr.length}>${totalCountStr}`,
    );
  }

  // 合并数据：头部 + 增量记录（在前） + 现有记录（在后，包含末尾的 <APP_LoTW_EOF>）
  // 移除多余的换行符
  const mergedData = updatedHeader + incrementalRecords + existingRecords;

  // 保存合并后的数据
  const savedPath = saveADIFData(mergedData, null, configContext);

  // 移除这行：return parseADIFToJSON(savedPath, config);
  return savedPath; // 只返回文件路径
}

// 创建新函数，基于时间戳匹配和替换QSL记录
export async function mergeIncrementalQSLDataOnly(
  incrementalData,
  adifFilePath,
  configContext,
) {
  console.log("[LoTW-DXCC] ADIF-processor: Processing QSL incremental data with timestamp matching...");

  const { header: existingHeader, records: existingRecords } =
    _readADIFFileParts(adifFilePath);

  // Extract incremental QSL records
  const qslHeaderMatch = incrementalData.match(/^[\s\S]*?<eoh>/i);
  const qslHeader = qslHeaderMatch ? qslHeaderMatch[0] : "";
  let incrementalRecords = incrementalData.split(/<eoh>/i)[1] || "";
  
  // Remove APP_LoTW_EOF from incremental records if present
  incrementalRecords = incrementalRecords
    .replace(/^\s*<APP_LoTW_EOF>\s*/, "")
    .replace(/<APP_LoTW_EOF>\s*$/, "")
    .trim();

  // Parse existing records and build timestamp index
  const existingRecordsList = parseRecordsToList(existingRecords);
  const timestampIndex = buildTimestampIndex(existingRecordsList);
  
  console.log(`[LoTW-DXCC] ADIF-processor: Found ${existingRecordsList.length} existing records`);
  console.log(`[LoTW-DXCC] ADIF-processor: Built timestamp index with ${Object.keys(timestampIndex).length} entries`);

  // Parse incremental QSL records
  const incrementalRecordsList = parseRecordsToList(incrementalRecords);
  console.log(`[LoTW-DXCC] ADIF-processor: Found ${incrementalRecordsList.length} incremental QSL records`);

  let matchedCount = 0;
  let updatedCount = 0;

  // Match and replace records based on APP_LoTW_QSO_TIMESTAMP
  for (const qslRecord of incrementalRecordsList) {
    const qsoTimestamp = extractTimestampFromRecord(qslRecord);
    
    if (qsoTimestamp && timestampIndex[qsoTimestamp] !== undefined) {
      const existingIndex = timestampIndex[qsoTimestamp];
      matchedCount++;
      
      // Check if QSL status actually changed
      const existingRecord = existingRecordsList[existingIndex];
      const existingQslStatus = extractQslStatusFromRecord(existingRecord);
      const newQslStatus = extractQslStatusFromRecord(qslRecord);
      
      if (existingQslStatus !== newQslStatus) {
        // Replace the existing record with QSL record
        existingRecordsList[existingIndex] = qslRecord;
        updatedCount++;
        console.log(`[LoTW-DXCC] ADIF-processor: Updated QSL record for timestamp: ${qsoTimestamp}`);
      }
    } else {
      console.warn(`[LoTW-DXCC] ADIF-processor: No matching QSO found for QSL timestamp: ${qsoTimestamp}`);
    }
  }

  console.log(`[LoTW-DXCC] ADIF-processor: Matched ${matchedCount} records, updated ${updatedCount} QSL statuses`);

  // Rebuild records section
  const updatedRecords = rebuildRecordsSection(existingRecordsList);

  // Update header information
  let updatedHeader = existingHeader;

  // Update APP_LoTW_RXQSL timestamp
  const newQslMatch = qslHeader.match(/<APP_LoTW_RXQSL:(\d+)>([^<]+)/i);
  if (newQslMatch) {
    const newTimestamp = newQslMatch[2].trim();
    updatedHeader = updatedHeader.replace(
      /<APP_LoTW_RXQSL:\d+>[^<]*/i,
      `<APP_LoTW_RXQSL:${newTimestamp.length}>${newTimestamp}`,
    );
  }

  // Update Generated at timestamp
  const now = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
  updatedHeader = updatedHeader.replace(
    /<PROGRAMID:[^>]*>Generated at [^<]*<\/PROGRAMID>/i,
    `<PROGRAMID:${("Generated at " + now).length}>Generated at ${now}</PROGRAMID>`,
  );

  // Combine updated data
  const updatedData = updatedHeader + updatedRecords;

  // Save updated data
  const savedPath = saveADIFData(updatedData, null, configContext);
  return savedPath;
}

/**
 * Parse ADIF records section into array of record strings
 */
function parseRecordsToList(recordsSection) {
  if (!recordsSection || !recordsSection.trim()) {
    return [];
  }
  
  const records = [];
  const recordMatches = recordsSection.split(/<eor>/i);
  
  for (const recordText of recordMatches) {
    const trimmed = recordText.trim();
    if (trimmed && !trimmed.includes('<APP_LoTW_EOF>')) {
      records.push(trimmed + '\n<eor>');
    }
  }
  
  return records;
}

/**
 * Build index mapping APP_LoTW_QSO_TIMESTAMP to record array index
 */
function buildTimestampIndex(recordsList) {
  const index = {};
  
  for (let i = 0; i < recordsList.length; i++) {
    const timestamp = extractTimestampFromRecord(recordsList[i]);
    if (timestamp) {
      index[timestamp] = i;
    }
  }
  
  return index;
}

/**
 * Extract APP_LoTW_QSO_TIMESTAMP from record string
 */
function extractTimestampFromRecord(recordText) {
  const match = recordText.match(/<APP_LoTW_QSO_TIMESTAMP:(\d+)>([^<]+)/i);
  return match ? match[2].trim() : null;
}

/**
 * Extract QSL confirmation status from record
 */
function extractQslStatusFromRecord(recordText) {
  // Check multiple QSL fields
  const qslRcvdMatch = recordText.match(/<QSL_RCVD:(\d+)>([^<]+)/i);
  const appLotwQslMatch = recordText.match(/<APP_LoTW_QSL_RCVD:(\d+)>([^<]+)/i);
  
  if (qslRcvdMatch && qslRcvdMatch[2].trim() === 'Y') return 'Y';
  if (appLotwQslMatch && appLotwQslMatch[2].trim() === 'Y') return 'Y';
  
  return 'N';
}

/**
 * Rebuild records section from array of record strings
 */
function rebuildRecordsSection(recordsList) {
  let result = '';
  
  for (const record of recordsList) {
    result += '\n' + record + '\n';
  }
  
  // Ensure proper ending
  if (!result.includes('<APP_LoTW_EOF>')) {
    result += '\n<APP_LoTW_EOF>';
  }
  
  return result;
}

/**
 * 重新计算并更新 ADIF 文件中的记录数量
 */
export function updateRecordCount(adifFilePath) {
  console.log("[LoTW-DXCC] ADIF-processor: Recalculating record count...");

  if (!fs.existsSync(adifFilePath)) {
    throw new Error("ADIF file not found");
  }

  const adifData = fs.readFileSync(adifFilePath, "utf8");

  // 提取头部和记录部分
  const headerMatch = adifData.match(/^([\s\S]*?)<eoh>/i);
  let header = headerMatch ? headerMatch[0] : "";
  const records = adifData.split(/<eoh>/i)[1] || "";

  // 计算实际记录数量（统计 <eor> 标签数量）
  const recordCount = (records.match(/<eor>/gi) || []).length;
  const recordCountStr = recordCount.toString();

  console.log(
    `[LoTW-DXCC] ADIF-processor: Actual record count: ${recordCount}`,
  );

  // **移除有问题的头部清理逻辑**
  // 不要使用 header.replace(/\s+/g, ' ') 这会破坏ADIF格式

  // 更新或添加 APP_LoTW_NUMREC 字段
  if (header.match(/<APP_LoTW_NUMREC:\d+>\d+/i)) {
    // 如果存在，则更新
    header = header.replace(
      /<APP_LoTW_NUMREC:\d+>\d+/i,
      `<APP_LoTW_NUMREC:${recordCountStr.length}>${recordCountStr}`,
    );
  } else {
    // 如果不存在，则在 <eoh> 前添加
    header = header.replace(
      /<eoh>/i,
      `\n<APP_LoTW_NUMREC:${recordCountStr.length}>${recordCountStr}\n<eoh>`,
    );
  }

  // 确保 <eoh> 前有换行符（修复当前格式问题）
  header = header.replace(/<APP_LoTW_NUMREC:\d+>\d+\s*<eoh>/i, (match) => {
    const numRecPart = match.replace(/<eoh>/i, "").trim();
    return numRecPart + "\n<eoh>";
  });

  // 重新组合数据 - 移除多余的换行符
  const updatedData = header + records;

  // 保存更新后的数据
  fs.writeFileSync(adifFilePath, updatedData, "utf8");

  console.log(
    `[LoTW-DXCC] ADIF-processor: Record count updated to: ${recordCount}`,
  );

  return recordCount;
}
