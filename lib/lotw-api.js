import axios from "axios";
import { ProgressIndicator } from "./progress-indicator.js";

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试机制的HTTP请求函数
 * @param {string} url - 请求URL
 * @param {object} config - axios配置
 * @param {number} maxRetries - 最大重试次数
 * @param {number} baseDelay - 基础延迟时间（毫秒）
 * @param {ProgressIndicator} progress - 进度指示器
 */
async function requestWithRetry(
  url,
  config,
  maxRetries = 3,
  baseDelay = 5000,
  progress = null,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (progress && attempt > 1) {
        progress.updateMessage(
          `Retrying request (attempt ${attempt}/${maxRetries})`,
        );
      }

      const response = await axios.get(url, config);
      return response;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      // 对于503错误或超时错误，进行重试
      if (
        (status === 503 ||
          error.code === "ECONNABORTED" ||
          error.code === "ETIMEDOUT") &&
        attempt < maxRetries
      ) {
        // 指数退避策略：每次重试延迟时间翻倍
        const delayTime = baseDelay * Math.pow(2, attempt - 1);

        console.log(
          `[LoTW-DXCC] LoTW request failed (attempt ${attempt}/${maxRetries}): ${error.message}`,
        );
        console.log(
          `[LoTW-DXCC] Waiting ${delayTime / 1000} seconds before retry...`,
        );

        if (progress) {
          progress.updateMessage(
            `Request failed, waiting ${delayTime / 1000}s before retry`,
          );
        }

        await delay(delayTime);
        continue;
      }

      // 对于其他错误或已达到最大重试次数，直接抛出
      throw error;
    }
  }

  throw lastError;
}

/**
 * 通用的LoTW数据获取函数
 * @param {object} params - 参数对象
 * @param {string} params.username - LoTW用户名
 * @param {string} params.password - LoTW密码
 * @param {object} params.queryParams - 查询参数
 * @param {object} params.configContext - 配置上下文
 * @param {string} params.progressMessage - 进度消息
 * @param {function} params.onDownloadProgress - 下载进度回调
 */
async function _fetchDataFromLoTW({
  username,
  password,
  queryParams,
  configContext,
  progressMessage,
  onDownloadProgress,
}) {
  if (!username || !password) {
    throw new Error("LoTW username and password cannot be empty");
  }

  const progress = new ProgressIndicator(progressMessage);

  try {
    progress.start();

    const requestParams = {
      login: username,
      password: password,
      ...queryParams,
    };

    // 使用重试机制的请求
    const response = await requestWithRetry(
      configContext.get("lotwUrl"),
      {
        params: requestParams,
        headers: {
          "User-Agent": "lotw-query-core/0.1",
          Accept: "text/plain",
        },
        timeout: configContext.get("queryTimeout"),
        onDownloadProgress: onDownloadProgress
          ? (progressEvent) => {
              onDownloadProgress(progressEvent, progress);
            }
          : undefined,
      },
      3,
      5000,
      progress,
    );

    progress.updateMessage("Processing response data");

    // 从响应中提取时间戳信息
    const { extractTimestamps } = await import("./adif-parser.js");
    const timestamps = extractTimestamps(response.data, response.data);

    const finalSize = ProgressIndicator.formatFileSize(
      response.data?.length || 0,
    );
    progress.stop(`Data fetched successfully (${finalSize})`);

    return {
      data: response.data,
      timestamps: timestamps,
    };
  } catch (error) {
    progress.error(`Failed to fetch data: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch ADIF data from LoTW
 */
export async function fetchADIFData({
  username,
  password,
  qsoBeginDate: paramqsoBeginDate,
  configContext,
}) {
  // 优先使用传入的参数，其次使用配置
  const qsoRxSince =
    paramqsoBeginDate !== undefined
      ? paramqsoBeginDate
      : configContext.get("qsoBeginDate");

  console.log(
    "[LoTW-DXCC] Lotw-update: Starting to fetch Full ADIF data from LoTW...",
  );

  try {
    return await _fetchDataFromLoTW({
      username,
      password,
      queryParams: {
        qso_query: "1",
        qso_qsldetail: "yes",
        qso_mydetail: "yes",
        qso_qsl: "no",
        qso_qsorxsince: qsoRxSince,
      },
      configContext,
      progressMessage: "Fetching full ADIF data",
      onDownloadProgress: (progressEvent, progress) => {
        const sizeInfo = ProgressIndicator.formatFileSize(progressEvent.loaded);
        progress.updateMessage(`Downloading ADIF data (${sizeInfo})`);
      },
    });
  } catch (error) {
    console.error("[LoTW-DXCC] Lotw-update: DEBUG - Error details:", {
      message: error.message,
      code: error.code,
      response: error.response?.status,
      timeout: error.code === "ECONNABORTED",
    });
    throw new Error(`LoTW query failed: ${error.message}`);
  }
}

/**
 * 获取增量 QSL 数据
 */
export async function fetchIncrementalQSL({
  username,
  password,
  sinceTimestamp,
  configContext,
}) {
  // Check if sinceTimestamp is already in LoTW format or Unix timestamp
  let qslSince;
  if (typeof sinceTimestamp === 'string' && sinceTimestamp.includes('-')) {
    // Already in LoTW format (YYYY-MM-DD HH:MM:SS)
    qslSince = sinceTimestamp;
  } else {
    // Unix timestamp, convert to LoTW format
    const { timestampToLoTWQueryFormat } = await import("./timestamp-utils.js");
    qslSince = timestampToLoTWQueryFormat(sinceTimestamp);
  }
  
  console.log(
    `[LoTW-DXCC] Lotw-update: Fetching incremental QSL data since: ${qslSince}`,
  );

  try {
    return await _fetchDataFromLoTW({
      username,
      password,
      queryParams: {
        qso_query: "1",
        qso_qsldetail: "yes",
        qso_mydetail: "yes",
        qso_qsl: "yes",
        qso_qslsince: qslSince,
      },
      configContext,
      progressMessage: "Fetching incremental QSL data",
      onDownloadProgress: (progressEvent, progress) => {
        const loadedKB = Math.round(progressEvent.loaded / 1024);
        progress.updateMessage(`正在下载增量 QSL 数据 (${loadedKB} KB)`);
      },
    });
  } catch (error) {
    throw new Error(`Failed to fetch incremental QSL data: ${error.message}`);
  }
}

/**
 * 获取增量 QSO 数据
 */
export async function fetchIncrementalQSO({
  username,
  password,
  sinceTimestamp,
  configContext,
}) {
  // Check if sinceTimestamp is already in LoTW format or Unix timestamp
  let qsoSince;
  if (typeof sinceTimestamp === 'string' && sinceTimestamp.includes('-')) {
    // Already in LoTW format (YYYY-MM-DD HH:MM:SS)
    qsoSince = sinceTimestamp;
  } else {
    // Unix timestamp, convert to LoTW format
    const { timestampToLoTWQueryFormat } = await import("./timestamp-utils.js");
    qsoSince = timestampToLoTWQueryFormat(sinceTimestamp);
  }
  
  console.log(
    `[LoTW-DXCC] Lotw-update: Fetching incremental QSO data since: ${qsoSince}`,
  );

  try {
    return await _fetchDataFromLoTW({
      username,
      password,
      queryParams: {
        qso_query: "1",
        qso_qsldetail: "yes",
        qso_mydetail: "yes",
        qso_qsl: "no",
        qso_qsorxsince: qsoSince,
      },
      configContext,
      progressMessage: "Fetching incremental QSO data",
      onDownloadProgress: (progressEvent, progress) => {
        const loadedKB = Math.round(progressEvent.loaded / 1024);
        progress.updateMessage(`正在下载增量 QSO 数据 (${loadedKB} KB)`);
      },
    });
  } catch (error) {
    throw new Error(`Failed to fetch incremental QSO data: ${error.message}`);
  }
}
