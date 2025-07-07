export default {
  lotwUrl: "https://lotw.arrl.org/lotwuser/lotwreport.adi",
  // 优先使用临时数据路径，其次本地调试路径
  localDataPath: "./local-data",
  lotwDataFile: "lotwDxcc.json",
  qsoDataFile: "lotwQso.adif",
  qsoDataFileBackup: false,
  qsoBeginDate: "2018-01-01",
  queryTimeout: 60000,
  timestampCheckInterval: 0,

  // 新增超时重试配置
  retryConfig: {
    maxRetries: 3, // 最大重试次数
    baseDelay: 5000, // 基础延迟时间（毫秒）
    retryOn503: true, // 是否对503错误重试
    retryOnTimeout: true, // 是否对超时错误重试
  },
};
