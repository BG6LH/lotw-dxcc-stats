# LoTW DXCC Stats

![DXCC Confirmed](https://img.shields.io/badge/dynamic/json?label=DXCC%20Confirmed&url=https://bg6lh.github.io/js/lotwDxcc.json&query=dxcc_confirmed)
![LoTW QSOs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSO&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qso)
![LoTW QSLs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSL&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qsl)

Above are my [Logbook of the World (LoTW)](https://lotw.arrl.org) DXCC statistics badges. If you want to have your own set, you can try my project.

This is an amateur radio LoTW DXCC statistics tool that automatically fetches and processes QSO/QSL records from LoTW, generates detailed DXCC statistics data, and saves them in JSON format on GitHub.

## ✨ Core Features

- 🏆 **Automatic DXCC Data Sync**: Automatically download and parse ADIF format data from LoTW
- 📊 **Complete Statistical Analysis**: Generate detailed statistics including DXCC confirmations, total QSOs, QSL confirmations, and more
- 🔄 **Smart Incremental Updates**: Support both full and incremental update strategies to save bandwidth and time
- ⚡ **GitHub Actions Automation**: Automated scheduled updates and deployment via GitHub workflows
- 🛡️ **Data Integrity Validation**: Use JSON Schema to ensure data format correctness
- 🔒 **Private Data Protection**: Support private repository deployment to protect personal LoTW credentials
- 📈 **Badge Support**: Generate data interfaces compatible with shields.io
- 🚀 **High Performance Processing**: Optimized ADIF parsing algorithms supporting large file processing

## How to Use?

This project offers two usage methods:

1. Run in your Node.js environment to generate statistics data.
2. Deploy on GitHub Actions for automatic periodic statistics generation, mainly for various online services. For example, combine with Shields.io badge service to generate your DXCC badges.

I also plan to publish it as an npm package, so you can install and use it in your projects via npm.

## Local Installation

```bash
npm install lotw-dxcc-stats
```

### Basic Configuration

1. **Configuration File**

Edit `lotw-dxcc-stats.config.js` in your project root:

```javascript
export default {
    lotwUrl: 'https://lotw.arrl.org/lotwuser/lotwreport.adi', // LoTW RESTful query interface, no need to change
    localDataPath: './local-data', // Local output directory for statistics data when running locally
    lotwDataFile: 'lotwDxcc.json', // JSON statistics data filename
    qsoDataFile: 'lotwQso.adif', // ADIF statistics data filename
    qsoDataFileBackup: true,  // true: backup ADIF file on update; false: no backup
    qsoBeginDate: '2018-01-01',
    queryTimeout: 60000,
    timestampCheckInterval: 0,
    
    // Retry configuration for LoTW request timeout handling
    retryConfig: {
        maxRetries: 3, // Maximum retry attempts
        baseDelay: 5000, // Base delay time (milliseconds)
        retryOn503: true, // Whether to retry on LoTW 503 errors
        retryOnTimeout: true // Whether to retry on timeout errors
    }
};
```

2. **Set Environment Variables**

Create `.env` file to store LoTW username and password:

```env
LOTW_USERNAME=your_lotw_username
LOTW_PASSWORD=your_lotw_password
```
Note:
- By default, queries all QSO data associated with the LOTW_USERNAME account.
- Remember to add the `.env` file to `.gitignore` to avoid uploading your LoTW credentials to public repositories.

### Command Line Usage

On first run, the script will perform a full update, synchronizing LoTW contact records to local storage and creating statistics files.

```bash
# Manually update DXCC data
npm run update-dxcc

# Force full update (re-download all data)
npm run update-dxcc --full
```

### Statistics Results

After update completion, three main data files are generated according to the directory and filenames specified in the configuration file:

```bash
# For example: in configuration file lotw-dxcc-stats.config.js
# localDataPath: './local-data', 
# lotwDataFile: 'lotwDxcc.json', 
# qsoDataFile: 'lotwQso.adif',
local-data/
├── lotwDxcc.json    # Latest DXCC contact statistics
├── lotwQsl.adif     # All QSO/QSL records as of last statistics update
└── lotwQso_<timestamp>.bak.adif # Backup data from last statistics update
```

## GitHub Deployment for Automatic Updates

### Recommended Deployment Strategy

Since this project synchronizes your LoTW QSO records, we strongly recommend deploying this project using a **private repository**, then accessing statistics data from other projects through GitHub's PAT mechanism.

1. **Create Private GitHub Repository**
   - Fork or copy this project to your private repository
   - Set repository visibility to Private

2. **Configure GitHub Secrets**
   - `LOTW_USERNAME`: Your LoTW username
   - `LOTW_PASSWORD`: Your LoTW password

3. **Enable GitHub Actions**
   - Automatic scheduled updates (daily execution)
   - Manual trigger updates
   - Automatic deployment to GitHub Pages

### 🔧 GitHub Actions Configuration

The project includes a pre-configured GitHub Actions workflow script.

```zsh
# GitHub Workflow YAML
.github/workflows/update-dxcc.yml
```

### Manual Update

In GitHub Actions, running this workflow will manually execute the LoTW update.

When performing a manual update, you can check the --Full option to perform a full update.

### Automatic Update

If you want to run updates automatically on a schedule, you can uncomment the following code.

```yaml
#  schedule:
#  - cron: '0 2 * * *' # Execute daily at UTC 02:00 AM
```

### Statistics Results

After Action update completion, a `stats` branch will be automatically created in the repository, and three main data files will be saved in the branch root directory, along with a README.md file:

```bash
# After Action execution, data will be generated in the stats branch root directory
lotwDxcc.json     # Latest DXCC contact statistics
lotwQsl.adif      # All QSO/QSL records as of last statistics update
lotwQso_<timestamp>.bak.adif  # Backup data from last statistics update
README.md         # Documentation file
```

## Statistics Data Applications

If your statistics repository is private, when accessing this repository's statistics data from other GitHub projects, you need to configure PAT strategy and corresponding permissions. This is not detailed here.

The following only explains the application of this project's statistics data.

### 📊 Statistics Data Structure

The generated JSON data contains complete DXCC contact statistics:

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
    "...": "More DXCC entity statistics"
  }
}
```

**Field Descriptions:**

- `total_qso`: Total number of QSO contacts
- `total_qsl`: Total number of QSL confirmations
- `dxcc_confirmed`: Number of confirmed DXCC entities
- `app_lotw_lastQsoRx`: Timestamp of last received QSO
- `app_lotw_lastQsl`: Timestamp of last received QSL
- `dxcc_stats`: Detailed statistics for each DXCC entity

#### Generate Shields.io Badges

Combining with Shields.io service, you can use the JSON file generated by this project to render badges in the following format. The specific reference path of the JSON file needs to be adjusted according to your deployment strategy.

```markdown
<!-- DXCC Confirmed Badge -->
![DXCC Confirmed](https://img.shields.io/badge/dynamic/json?label=DXCC%20Confirmed&url=https://bg6lh.github.io/js/lotwDxcc.json&query=dxcc_confirmed)

<!-- QSO Total Badge -->
![LoTW QSOs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSO&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qso)

<!-- QSL Confirmed Badge -->
![LoTW QSLs](https://img.shields.io/badge/dynamic/json?label=LoTW%20QSL&url=https://bg6lh.github.io/js/lotwDxcc.json&query=total_qsl)
```

## ⭐ Support the Project

This project was completed with the assistance of AI tools. I am trying to turn the needs I encounter in amateur radio activities into some interesting applications. If you are interested, you can leave me a message in the project. Your sponsorship is also the motivation for me to maintain this work. If this project helps you, please give it a ⭐!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/T6T01D9CDW)

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🔗 Related Links

- [Logbook of the World (LoTW)](https://lotw.arrl.org)
- [DXCC Program](https://www.arrl.org/dxcc)
- [ADIF Specification](https://www.adif.org)
- [Shields.io](https://shields.io)
