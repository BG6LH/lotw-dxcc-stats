import fs from "fs";
import { fetchIncrementalQSL, fetchIncrementalQSO } from "./lotw-api.js";
import { parseADIFToJSON } from "./adif-parser.js";
import {
  mergeIncrementalADIFData,
  mergeIncrementalQSLDataOnly,
  updateRecordCount,
} from "./adif-processor.js";
import { createBackup, restoreBackup } from "./file-manager.js";
export async function performIncrementalUpdate({
  username,
  password,
  localData,
  configContext,
}) {
  console.log(
    "[LoTW-DXCC] DEBUG: Incremental update started, using config context",
  );

  const adifFilePath = configContext.getPath("adif");
  console.log("[LoTW-DXCC] DEBUG: adifFilePath:", adifFilePath);

  let result = null;
  let backupPath = null;

  // 增量统计
  let incrementalStats = {
    newQSOs: 0,
    newQSLs: 0,
    newDXCCs: 0,
  };

  try {
    // 创建备份
    backupPath = await createBackup(adifFilePath, configContext);

    // 使用统一的 last_updated_timestamp 作为查询依据
    const lastUpdateTimestamp = localData.last_updated_timestamp;

    console.log(
      "[LoTW-DXCC] Incremental:  Using timestamp:",
      lastUpdateTimestamp,
    );
    console.log(
      "[LoTW-DXCC] Incremental:  Timestamp corresponds to time:",
      new Date(lastUpdateTimestamp).toISOString(),
    );

    // 记录更新前的统计
    const beforeStats = {
      qso: localData.total_qso || 0,
      qsl: localData.total_qsl || 0,
      dxcc: localData.dxcc_confirmed || 0,
    };

    // 1. 获取增量 QSO 数据
    console.log("[LoTW-DXCC] Incremental:  Fetching incremental QSO data...");

    const incrementalQsoData = await fetchIncrementalQSO({
      username: username,
      password: password,
      sinceTimestamp: lastUpdateTimestamp,
      configContext: configContext,
    });

    if (
      incrementalQsoData &&
      incrementalQsoData.data &&
      incrementalQsoData.data.trim()
    ) {
      console.log(
        "[LoTW-DXCC] Incremental:  Found new QSO data, starting merge...",
      );
      // Update the function call around line 51
      await mergeIncrementalADIFData(
        incrementalQsoData.data,
        adifFilePath,
        configContext,
      );
    } else {
      console.log("[LoTW-DXCC] Incremental:  No new QSO data");
    }

    // 2. 获取增量 QSL 数据
    console.log("[LoTW-DXCC] Incremental:  Fetching incremental QSL data...");

    const incrementalQslData = await fetchIncrementalQSL({
      username: username,
      password: password,
      sinceTimestamp: lastUpdateTimestamp,
      configContext: configContext,
    });

    if (
      incrementalQslData &&
      incrementalQslData.data &&
      incrementalQslData.data.trim()
    ) {
      console.log(
        "[LoTW-DXCC] Incremental:  Found new QSL data, starting merge...",
      );
      await mergeIncrementalQSLDataOnly(
        incrementalQslData.data,
        adifFilePath,
        configContext,
      );
      console.log("[LoTW-DXCC] Incremental:  QSL data merge completed");
    } else {
      console.log("[LoTW-DXCC] Incremental:  No new QSL data");
    }

    // 3. 统一更新记录数量和重新生成统计
    console.log(
      "[LoTW-DXCC] Incremental:  Recalculating and updating record count...",
    );
    updateRecordCount(adifFilePath);

    console.log(
      "[LoTW-DXCC] Incremental:  Regenerating JSON statistics based on full ADIF file...",
    );
    result = await parseADIFToJSON(adifFilePath, configContext);

    // 计算增量统计
    if (result) {
      incrementalStats.newQSOs = (result.total_qso || 0) - beforeStats.qso;
      incrementalStats.newQSLs = (result.total_qsl || 0) - beforeStats.qsl;
      incrementalStats.newDXCCs =
        (result.dxcc_confirmed || 0) - beforeStats.dxcc;

      // 将增量统计添加到结果中
      result.incrementalStats = incrementalStats;
    }

    // 清理备份 - 根据配置决定是否保留
    if (backupPath && fs.existsSync(backupPath)) {
      const config = configContext.config || {};
      const shouldKeepBackup = config.qsoDataFileBackup !== false;

      if (!shouldKeepBackup) {
        fs.unlinkSync(backupPath);
        console.log(
          `[LoTW-DXCC] Incremental:  Deleting backup file: ${backupPath}`,
        );
      } else {
        console.log(
          `[LoTW-DXCC] Incremental:  Keeping backup file: ${backupPath}`,
        );
      }
    }

    console.log("[LoTW-DXCC] Incremental:  Incremental update completed");
    return result;
  } catch (error) {
    console.error(
      "[dxcc-badges: incremental-updater] Incremental update failed:",
      error.message,
    );

    // 恢复备份
    if (backupPath) {
      await restoreBackup(backupPath, adifFilePath);
    }

    throw error;
  }
}
