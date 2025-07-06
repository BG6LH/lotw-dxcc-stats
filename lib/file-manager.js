import fs from 'fs';
import path from 'path';

/**
 * Save ADIF data to file - 使用配置上下文
 */
export function saveADIFData(adifData, outputPath = null, configContext) {
  const adifPath = outputPath || configContext.getPath('adif');
  
  // 确保目录存在
  const dir = path.dirname(adifPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[LoTW-DXCC] File-manager: Created directory: ${dir}`);
  }
  
  // Create backup based on config
  if (fs.existsSync(adifPath)) {
    createBackup(adifPath, configContext);
  }
  
  fs.writeFileSync(adifPath, adifData, 'utf8');
  console.log(`[LoTW-DXCC] Lotw-update: ADIF data saved to: ${adifPath}`);
  return adifPath;
}

/**
 * Save JSON data to file - 使用配置上下文
 */
export function saveJSONData(data, outputPath = null, configContext = null) {
  let jsonPath;
  
  if (outputPath) {
    jsonPath = outputPath;
  } else if (configContext) {
    jsonPath = configContext.getPath('json');
  } else {
    throw new Error('必须提供 outputPath 或 configContext');
  }
  
  // Create backup if file exists and backup is enabled
  if (fs.existsSync(jsonPath) && configContext) {
    createBackup(jsonPath, configContext);
  }
  
  // Ensure directory exists
  const dir = path.dirname(jsonPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[LoTW-DXCC] File-manager: JSON data saved to: ${jsonPath}`);
  return jsonPath;
}

/**
 * Create backup file - 使用配置上下文和备份策略
 */
export async function createBackup(filePath, configContext) {
  // 检查备份配置
  const config = configContext.config || {};
  const shouldBackup = config.qsoDataFileBackup !== false; // 默认为 true
  
  if (!shouldBackup) {
    console.log(`[LoTW-DXCC] File-manager: Backup disabled, skipping backup: ${filePath}`);
    return null;
  }
  
  // 检查文件是否存在，如果不存在则直接返回
  if (!fs.existsSync(filePath)) {
    console.log(`[LoTW-DXCC] File-manager: File does not exist, skipping backup: ${filePath}`);
    return null;
  }
  
  const timestamp = Date.now();
  const backupPath = configContext.createBackupPath(timestamp);
  
  // 先创建新备份
  fs.copyFileSync(filePath, backupPath);
  console.log(`[LoTW-DXCC] File-manager: Backup created: ${backupPath}`);
  
  // 然后清理旧备份文件（保留最新的一个，即刚创建的这个）
  cleanupOldBackups(filePath, configContext);
  
  return backupPath;
}

/**
 * 清理旧备份文件，只保留最新的一个
 */
function cleanupOldBackups(filePath, configContext) {
  try {
    const dir = path.dirname(filePath);
    const baseName = path.parse(filePath).name;
    const ext = path.parse(filePath).ext;
    
    // 查找所有备份文件
    const files = fs.readdirSync(dir);
    const backupFiles = files
      .filter(file => {
        // 匹配备份文件模式: 文件名_时间戳.bak.扩展名
        const pattern = new RegExp(`^${baseName}_\\d+\\.bak${ext.replace('.', '\\.')}$`);
        return pattern.test(file);
      })
      .map(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        return {
          path: fullPath,
          mtime: stat.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序排列
    
    // 删除除最新的之外的所有备份文件
    if (backupFiles.length > 1) {
      const filesToDelete = backupFiles.slice(1); // 保留第一个（最新的）
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`[LoTW-DXCC] File-manager: Deleting old backup: ${file.path}`);
        } catch (error) {
          console.warn(`[LoTW-DXCC] File-manager: Failed to delete old backup: ${file.path}, ${error.message}`);
        }
      });
    }
  } catch (error) {
    console.warn(`[LoTW-DXCC] File-manager: Error occurred while cleaning old backups: ${error.message}`);
  }
}

/**
 * 加载本地数据
 */
export function loadLocalData(jsonFilePath) {
  if (fs.existsSync(jsonFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    } catch (error) {
      console.warn(`[LoTW-DXCC] Lotw-update: Failed to read local JSON data: ${error.message}`);
      return null;
    }
  }
  return null;
}

/**
 * 恢复备份文件
 */
export function restoreBackup(backupPath, originalPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  try {
    fs.copyFileSync(backupPath, originalPath);
    console.log(`[LoTW-DXCC] File-manager: Restored backup from: ${backupPath} to: ${originalPath}`);
    
    // 删除备份文件
    fs.unlinkSync(backupPath);
    console.log(`[LoTW-DXCC] File-manager: Deleted backup file: ${backupPath}`);
  } catch (error) {
    throw new Error(`Failed to restore backup: ${error.message}`);
  }
}