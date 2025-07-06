//import fs from 'fs';
import { loadLocalData } from './file-manager.js';

/**
 * Simplified update strategy determination
 * Based on local data integrity rather than time intervals to determine update strategy
 */
export async function determineUpdateStrategy(localData, configContext, options = {}) {
  const { full = false } = options;  // 改为 full
  
  // 添加调试信息
  // console.log('[LoTW-DXCC] DEBUG: determineUpdateStrategy options:', options);
  // console.log('[LoTW-DXCC] DEBUG: full parameter:', full);  // 改为 full
  
  // Use full update when forced
  if (full) { 
    // console.log('[LoTW-DXCC] DEBUG: Full update triggered!');
    return {
      strategy: 'full',
      reason: 'Forced full update'  // 更新描述
    };
  }
  
  // Check if update should be skipped (based on time limit)
  if (localData && localData.last_updated_timestamp) {
    if (configContext.shouldSkipUpdate(localData.last_updated_timestamp)) {
      const interval = configContext.get('timestampCheckInterval');
      return {
        strategy: 'skip',
        reason: `Less than ${interval} hours since last update`
      };
    }
  }
  
  // If no local data, use full update
  if (!localData) {
    return {
      strategy: 'full',
      reason: 'No local data'
    };
  }
  
  // Check local data integrity
  if (!localData.dxcc_stats || typeof localData.dxcc_stats !== 'object' || Object.keys(localData.dxcc_stats).length === 0) {
    return {
      strategy: 'full',
      reason: 'Local data incomplete or empty'
    };
  }
  
  // Check if necessary timestamp information exists
  if (!localData.last_updated_timestamp) {
    return {
      strategy: 'full',
      reason: 'Missing timestamp information'
    };
  }
  
  // 移除这个检查块：
  // if (!useIncremental) {
  //   return {
  //     strategy: 'full',
  //     reason: 'Incremental update disabled'
  //   };
  // }
  
  // Local data is complete, use incremental update
  return {
    strategy: 'incremental',
    reason: 'Local data complete, performing incremental update'
  };
}

/**
 * Main update function - using configuration context
 */
export async function updateDXCCData({ username, password, configContext, options = {} }) {
  const { full = false, adifPath = null } = options;  // 改为 full
  
  try {
    // Load local data
    const localData = await loadLocalData(configContext.getPath('json'));
    
    // Determine update strategy
    const strategyResult = await determineUpdateStrategy(localData, configContext, { full });  // 改为 full
    // 移除：useIncremental 参数
    
    console.log(`[LoTW-DXCC] Update strategy: ${strategyResult.strategy} (${strategyResult.reason})`);
    
    // Execute corresponding operation based on strategy
    switch (strategyResult.strategy) {
      case 'skip':
        return {
          success: true,
          strategy: 'skip',
          message: strategyResult.reason,
          data: localData
        };
        
      case 'full':
        return await performFullUpdate({ username, password, configContext, adifPath });
        
      case 'incremental':
        const { performIncrementalUpdate } = await import('./incremental-updater.js');
        return await performIncrementalUpdate({ 
          username, 
          password, 
          strategy: strategyResult, 
          localData, 
          configContext 
        });
        
      default:
        throw new Error(`Unknown update strategy: ${strategyResult.strategy}`);
    }
    
  } catch (error) {
    console.error('[LoTW-DXCC] Update failed:', error.message);
    throw error;
  }
}

/**
 * Full update function - using configuration context
 */
async function performFullUpdate({ username, password, configContext, adifPath = null }) {
  try {
    // Use pre-calculated paths
    let adifFilePath = adifPath || configContext.getPath('adif');
    const jsonFilePath = configContext.getPath('json');
    
    if (!username || !password) {
      throw new Error('LoTW username and password required');
    }

    // Read local data to calculate changes
    const localData = await loadLocalData(configContext.getPath('json'));
    const beforeStats = {
      qso: localData?.total_qso || 0,
      qsl: localData?.total_qsl || 0,
      dxcc: localData?.dxcc_confirmed || 0
    };
    
    console.log('[LoTW-DXCC] Lotw-update: Executing full update...');
    
    // Get API functions
    const { fetchADIFData } = await import('./lotw-api.js');
    const { saveADIFData } = await import('./file-manager.js');
    
    // Execute data fetching
    const result = await fetchADIFData({ 
      username, 
      password, 
      qsoBeginDate: configContext.get('qsoBeginDate'),
      configContext // Pass configContext directly
    });
    
    adifFilePath = saveADIFData(result.data, adifFilePath, configContext);
    
    // Parse data
    const { parseADIFToJSON } = await import('./adif-parser.js');
    const parsedResult = await parseADIFToJSON(adifFilePath, configContext);
    
    // Calculate incremental statistics (changes during full update)
    if (parsedResult) {
      parsedResult.incrementalStats = {
        newQSOs: (parsedResult.total_qso || 0) - beforeStats.qso,
        newQSLs: (parsedResult.total_qsl || 0) - beforeStats.qsl,
        newDXCCs: (parsedResult.dxcc_confirmed || 0) - beforeStats.dxcc
      };
    }
    
    console.log('[LoTW-DXCC] Lotw-update: Full update completed!');
    return parsedResult;
    
  } catch (error) {
    console.error('[LoTW-DXCC] Lotw-update: Full update failed:', error.message);
    throw error;
  }
}
