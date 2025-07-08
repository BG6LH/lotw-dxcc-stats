/**
 * 将 Unix 时间戳转换为 LoTW API 查询格式（增加1秒避免重复）
 * @param {number} timestamp - Unix 时间戳（毫秒）
 * @returns {string} - LoTW 格式的时间戳 (YYYY-MM-DD HH:MM:SS)
 */
export function timestampToLoTWQueryFormat(timestamp) {
  if (!timestamp) return null;

  // 增加 1 秒（1000 毫秒）避免重复数据
  const adjustedDate = new Date(timestamp + 1000);

  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(adjustedDate.getUTCDate()).padStart(2, "0");
  const hour = String(adjustedDate.getUTCHours()).padStart(2, "0");
  const minute = String(adjustedDate.getUTCMinutes()).padStart(2, "0");
  const second = String(adjustedDate.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * 将 Unix 时间戳转换为 LoTW API 的 URL 参数格式
 * @param {number} timestamp - Unix 时间戳（毫秒）
 * @returns {string} - URL 参数格式 (YYYYMMDDHHMMSS)
 */
export function timestampToLoTWUrlFormat(timestamp) {
  const lotwFormat = timestampToLoTWQueryFormat(timestamp);
  if (!lotwFormat) return null;

  // 转换为 URL 参数格式：YYYYMMDDHHMMSS
  return lotwFormat.replace(/[-: ]/g, "");
}


/**
 * Add 1 second to LoTW timestamp format to avoid duplicate data
 * @param {string} lotwTimestamp - LoTW format: "YYYY-MM-DD HH:MM:SS"
 * @returns {string} - LoTW format with +1 second: "YYYY-MM-DD HH:MM:SS"
 */
export function addOneSecondToLoTWTimestamp(lotwTimestamp) {
  if (!lotwTimestamp || typeof lotwTimestamp !== 'string') {
    return null;
  }

  try {
    // Parse the LoTW timestamp
    const date = new Date(lotwTimestamp + ' UTC');
    
    if (isNaN(date.getTime())) {
      console.warn(`[LoTW-DXCC] timestamp-utils: Invalid LoTW timestamp: ${lotwTimestamp}`);
      return null;
    }

    // Add 1 second
    date.setSeconds(date.getSeconds() + 1);

    // Format back to LoTW format
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    console.warn(`[LoTW-DXCC] timestamp-utils: Failed to process LoTW timestamp: ${lotwTimestamp}`, error);
    return null;
  }
}
