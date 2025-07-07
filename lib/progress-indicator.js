/**
 * Simple console progress indicator
 */
export class ProgressIndicator {
  constructor(message = "Loading") {
    this.message = message;
    this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.currentFrame = 0;
    this.interval = null;
    this.isActive = false;
    // 检测是否在CI环境中
    this.isCI =
      process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  }

  start() {
    if (this.isActive) return;

    this.isActive = true;
    this.currentFrame = 0;

    if (this.isCI) {
      // 在CI环境中，只显示一次初始消息
      console.log(`[LoTW-DXCC] ${this.message}...`);
      return;
    }

    // Hide cursor
    process.stdout.write("\x1B[?25l");

    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      process.stdout.write(`\r${frame} ${this.message}...`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 100);
  }

  updateMessage(message) {
    this.message = message;
    if (this.isCI) {
      // 在CI环境中，只在重要更新时输出
      const isImportantUpdate =
        message.includes("(") &&
        (message.includes("KB") || message.includes("MB"));
      if (isImportantUpdate) {
        console.log(`[LoTW-DXCC] ${message}`);
      }
    }
  }

  stop(finalMessage = null) {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.isCI) {
      // 在CI环境中，显示完成消息
      if (finalMessage) {
        console.log(`[LoTW-DXCC] ✓ ${finalMessage}`);
      }
      return;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Clear current line and show final message
    process.stdout.write("\r\x1B[K");
    if (finalMessage) {
      console.log(`[LoTW-DXCC] ✓ ${finalMessage}`);
    }

    // Show cursor
    process.stdout.write("\x1B[?25h");
  }

  error(errorMessage) {
    this.stop();
    console.log(`[LoTW-DXCC] ✗ ${errorMessage}`);
  }

  /**
   * Format file size display
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted size string
   */
  static formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Create download progress callback function
   * @param {string} baseMessage - Base message
   * @returns {function} Progress callback function
   */
  createDownloadProgressCallback(baseMessage = "Downloading data") {
    return (progressEvent) => {
      const sizeInfo = ProgressIndicator.formatFileSize(progressEvent.loaded);
      this.updateMessage(`${baseMessage} (${sizeInfo})`);
    };
  }
}
