# LoTW DXCC Stats

![DXCC Confirmed](https://img.shields.io/badge/dynamic/json?label=DXCC%20Confirmed&url=https://bg6lh.github.io/js/lotwDxcc.json&query=dxcc_confirmed)
![LoTW QSOs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSO&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qso)
![LoTW QSLs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSL&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qsl)

上边是我的[Logbook of the World (LoTW)](https://lotw.arrl.org) DXCC的统计徽章。如果你也想有一套，你可以试试我的项目。

这是一个业余无线电 LoTW DXCC 统计工具，用于自动从 LoTW 获取和处理 QSO/QSL 记录，生成详细的 DXCC 统计数据，并以JSON格式保存在Github上。

## ✨ 核心特性

- 🏆 **自动 DXCC 数据同步**：从 LoTW 自动下载和解析 ADIF 格式数据
- 📊 **完整统计分析**：生成 DXCC 确认数、QSO 总数、QSL 确认数等详细统计
- 🔄 **智能增量更新**：支持完整更新和增量更新两种策略，节省带宽和时间
- ⚡ **GitHub Actions 自动化**：通过 GitHub 脚本实现定时自动更新和部署
- 🛡️ **数据完整性验证**：使用 JSON Schema 确保数据格式正确性
- 🔒 **私密数据保护**：支持私有仓库部署，保护个人 LoTW 凭据安全
- 📈 **徽章支持**：生成可用于 shields.io 的数据接口
- 🚀 **高性能处理**：优化的 ADIF 解析算法，支持大文件处理

## 如何使用？

本项目有两种使用方式：

1. 在你的 node.js 环境中运行，生成统计数据。
2. 部署在 Github Action 上，定期自动生成统计数据，主要可以用于你的各种在线服务。比如结合 Shelds.io 的徽章服务，生成你的DXCC徽章。

我还计划把它发布成 npm 包，这样你就可以在你的项目里，用 npm 安装和使用它。

## 本地安装

```bash
npm install lotw-dxcc-stats
```

### 基本配置

1. **配置文件**

在项目根目录，编辑 `lotw-dxcc-stats.config.js`：

```javascript
export default {
  lotwUrl: "https://lotw.arrl.org/lotwuser/lotwreport.adi", // LoTW RESTful 查询接口，不用改变
  localDataPath: "./local-data", // 本地运行时，统计数据输出的目录
  lotwDataFile: "lotwDxcc.json", // JSON统计数据名称
  qsoDataFile: "lotwQso.adif", // ADIF统计数据名称
  qsoDataFileBackup: true, // true，更新时备份ADIF文件；false，不备份
  qsoBeginDate: "2018-01-01",
  queryTimeout: 60000,
  timestampCheckInterval: 0,

  // 对LoTW请求的超时重试配置
  retryConfig: {
    maxRetries: 3, // 最大重试次数
    baseDelay: 5000, // 基础延迟时间（毫秒）
    retryOn503: true, // 是否对LoTW的503错误重试
    retryOnTimeout: true, // 是否对超时错误重试
  },
};
```

2. **设置环境变量**

创建 `.env` 文件，用于保存LoTW的用户名、密码。

```env
LOTW_USERNAME=your_lotw_username
LOTW_PASSWORD=your_lotw_password
```

注意：

- 默认查询和 LOTW_USERNAME 账户绑定的所有QSO数据。
- 记得把 `.env` 文件添加到 `.gitignore` 中，避免把你的 LoTW 用户名、密码上传到公开仓库。

### 命令行使用

首次运行时，脚本会执行一次全量更新，将LoTW的通联记录同步到本地，并创建统计文件。

```bash
# 手动更新 DXCC 数据
npm run update-dxcc

# 强制完整更新（重新下载所有数据）
npm run update-dxcc --full

```

### 统计结果

更新完成后，根据在配置文件指定的目录、文件名，生成三个主要数据：

```bash
# 例如：在配置文件 lotw-dxcc-stats.config.js 中指定了数据目录
# localDataPath: './local-data',
# lotwDataFile: 'lotwDxcc.json',
# qsoDataFile: 'lotwQso.adif',
local-data/
├── lotwDxcc.json    # 最新DXCC通联统计
├── lotwQsl.adif     # 截至最后一次统计时，全部的QSO、QSL记录
└── lotwQso_<timestamp>.bak.adif # 最后一次统计的备份数据。

```

## Github部署，自动更新

### 推荐部署方案

本项目会同步你在LoTW的QSO记录，所以强烈建议使用**私有仓库**部署本项目，然后在另外项目中，通过Github的PAT机制获取统计数据。

1. **创建私有 GitHub 仓库**
   - Fork 或复制本项目到你的私有仓库
   - 设置仓库为 Private

2. **配置 GitHub Secrets**
   - `LOTW_USERNAME`: 你的 LoTW 用户名
   - `LOTW_PASSWORD`: 你的 LoTW 密码

3. **启用 GitHub Actions**
   - 自动定时更新（每日执行）
   - 手动触发更新
   - 自动部署到 GitHub Pages

### 🔧 GitHub Actions 配置

项目包含预配置的 GitHub Actions 工作流脚本。

```bash
# Github Workflow YAML
.github/workflows/update-dxcc.yml

```

### 手动更新

在Github Action中，运行该工作流，即可手动执行 LoTW 更新。

手动更新时，可以勾选 `--Full` 选项，以便执行全量更新。

### 自动更新

如果你希望定时自动运行更新，可以去掉工作流脚本中，以下代码前的注释符号。

```yaml
#  schedule:
#  - cron: '0 2 * * *' # Execute daily at UTC 02:00 AM
```

### 统计结果

Aciton 更新完成后，将自动在仓库中创建 `stats` 分支，并将三个主要数据保存在分支的根目录，并生成一个README.md文件：

```bash
# Action 执行后，将在 stats 分支根目录生成数据
lotwDxcc.json     # 最新DXCC通联统计
lotwQsl.adif      # 截至最后一次统计时，全部的QSO、QSL记录
lotwQso_<timestamp>.bak.adif  # 最后一次统计的备份数据。
README.md         # 说明文件
```

## 统计数据应用

如果你的统计库是私密的，在Github上其它项目访问本仓库统计数据时，需要配置 PAT 策略，以及相应的权限。这里不再赘述。

以下仅对本项目的统计数据应用进行说明。

### 📊 统计数据结构

生成的 JSON 数据包含完整的 DXCC 通联统计信息：

```json
{
  "total_qso": 1234,
  "total_qsl": 567,
  "dxcc_confirmed": 89,
  "app_lotw_lastQsoRx": "2024-01-15 14:30:25",
  "app_lotw_lastQsl": "2024-01-15 12:15:30",
  "last_updated": "2024-01-15T14:30:25.123Z",
  "last_updated_timestamp": 1705327825123,
  "dxcc_stats": {
    "1": { "qso": 45, "qsl": 23 },
    "6": { "qso": 12, "qsl": 8 },
    "...": "更多 DXCC 实体统计"
  }
}
```

**字段说明：**

- `total_qso`: QSO 联络总数
- `total_qsl`: QSL 确认总数
- `dxcc_confirmed`: 已确认的 DXCC 实体数量
- `app_lotw_lastQsoRx`: 最后接收 QSO 的时间戳
- `app_lotw_lastQsl`: 最后接收 QSL 的时间戳
- `dxcc_stats`: 各 DXCC 实体的详细统计

#### 生成 Shields.io 徽章

结合 Shields.io 的服务，你可以用本项目生成的JSON文件，渲染出以下格式的徽章。JSON文件的具体引用路径，需要根据你的部署方案调整。

```markdown
<!-- DXCC 确认数徽章 -->

![DXCC Confirmed](https://img.shields.io/badge/dynamic/json?label=DXCC%20Confirmed&url=https://bg6lh.github.io/js/lotwDxcc.json&query=dxcc_confirmed)

<!-- QSO 总数徽章 -->

![LoTW QSOs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSO&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qso)

<!-- QSL 确认数徽章 -->

![LoTW QSLs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSL&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qsl)
```

## ⭐ 支持项目

本项目在AI工具辅助下完成。我正在尝试把我在业余无线电活动中遇到的需求，做成一些有趣的应用。如果你有兴趣，可以在项目里给我留言。你的赞助，也是让我维持这些工作的动力。如果这个项目对你有帮助，请给它一个 ⭐！

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/T6T01D9CDW)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [Logbook of the World (LoTW)](https://lotw.arrl.org)
- [DXCC Program](https://www.arrl.org/dxcc)
- [ADIF Specification](https://www.adif.org)
- [Shields.io](https://shields.io)
