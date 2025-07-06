import path from 'path';
import fs from 'fs';

/**
 * 加载配置文件
 */
async function loadConfig() {
  try {
    // 查找配置文件的可能路径, 生产环境时需替换为11ty的正式环境
    const configPaths = [
      path.resolve(process.cwd(), 'lotw-dxcc-stats.config.js'),
      path.resolve(process.cwd(), '../lotw-dxcc-stats.config.js'),
      path.resolve(process.cwd(), '../../lotw-dxcc-stats.config.js')
    ];
    
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`[LoTW-DXCC] Loading config from: ${configPath}`);
        const config = await import(`file://${configPath}`);
        if (config.default) {
          return config.default;
        }
      }
    }
    
    throw new Error('Configuration file not found in any of the expected locations');
    
  } catch (error) {
    console.error(`[LoTW-DXCC] Error loading config: ${error.message}`);
    throw error;
  }
}

/**
 * 配置查询工厂函数 - 11ty风格的配置上下文创建器
 * 预计算所有路径和配置信息，提供统一的查询接口
 */
export async function createConfigContext(options = {}) {
  // 加载基础配置
  const baseConfig = await loadConfig();
  
  // 合并用户选项
  const mergedConfig = { ...baseConfig };
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined) {
      mergedConfig[key] = options[key];
    }
  });
  
  // 环境判断逻辑：优先使用临时数据路径，其次使用配置的本地路径
  const finalDataPath = process.env.STATS_DATA_PATH || mergedConfig.localDataPath;
  
  // 预计算所有文件路径
  const basePath = path.resolve(process.cwd(), finalDataPath);
  const paths = {
    dataDir: basePath,
    adifFile: path.resolve(basePath, mergedConfig.qsoDataFile),
    jsonFile: path.resolve(basePath, mergedConfig.lotwDataFile),
    // 备份文件路径生成函数
    getBackupPath: (timestamp) => path.resolve(basePath, `${path.parse(mergedConfig.qsoDataFile).name}_${timestamp}.bak${path.parse(mergedConfig.qsoDataFile).ext}`)
  };


  // 返回配置上下文对象
  return {
    // 原始配置
    config: mergedConfig,
    
    // 预计算的路径
    paths,

    // 配置查询接口
    get: (key) => mergedConfig[key],
    
    // 路径查询接口
    getPath: (type) => {
      switch (type) {
        case 'data': return paths.dataDir;
        case 'adif': return paths.adifFile;
        case 'json': return paths.jsonFile;
        default: throw new Error(`未知的路径类型: ${type}`);
      }
    },
    
    // 创建备份路径
    createBackupPath: (timestamp = Date.now()) => paths.getBackupPath(timestamp),

    // 新增：检查更新频率限制
    shouldSkipUpdate: (lastUpdateTime) => {
      if (!lastUpdateTime || mergedConfig.timestampCheckInterval <= 0) {
        return false; // 没有时间限制或没有上次更新时间
      }
      const now = new Date();
      const lastUpdate = new Date(lastUpdateTime);
      const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);
      return hoursDiff < mergedConfig.timestampCheckInterval;
    }
  };
}

// 向后兼容的初始化函数
export async function initConfig(options = {}) {
  const context = await createConfigContext(options);
  return context.config;
}

// // 向后兼容的路径获取函数（标记为废弃）
// export function getDataPath(filename, config) {
//   console.warn('[LoTW-DXCC] getDataPath is deprecated, use configContext.getPath() instead');
//   return path.resolve(process.cwd(), config.localDataPath, filename);
// }

// Export new modular functions
export { updateDXCCData } from './lib/update-strategy.js';
export { fetchADIFData } from './lib/lotw-api.js';
export { saveADIFData, loadLocalData } from './lib/file-manager.js';
export { parseADIFToJSON } from './lib/adif-parser.js';

// // Export display plugin
// export { default as lotwDisplayPlugin } from './eleventy-dxcc-widgets.js';

// For backward compatibility, keep original function exports
export { 
  fetchADIFData as queryDXCC
} from './lib/lotw-api.js';

// Export parseADIFToJSON with legacy name from correct module
export { 
  parseADIFToJSON as parseConfirmedDXCCFromADIF
} from './lib/adif-parser.js';

// Legacy support for old update function
export { updateDXCCData as updateLoTWData } from './lib/update-strategy.js';

// // Default export display plugin
// export { default } from './eleventy-dxcc-widgets.js';


