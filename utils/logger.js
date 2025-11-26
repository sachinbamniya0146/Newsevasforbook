import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log directory
const LOG_DIR = path.resolve(__dirname, '../logs');

// Initialize log directory
try {
  fs.ensureDirSync(LOG_DIR, { recursive: true });
} catch (error) {
  console.error('❌ Failed to create logs directory:', error.message);
}

// Color codes for terminal (optional, works in Termux)
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m'
};

// Get log file name (daily rotation)
function getLogFile() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `bot_${date}.log`);
}

// Get timestamp in IST
function getTimestamp() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().replace('T', ' ').slice(0, 19);
}

// Get caller info (file and line number)
function getCallerInfo() {
  try {
    const err = new Error();
    if (err.stack) {
      const lines = err.stack.split('\n');
      // Find the first line that's not from logger.js
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('logger.js')) {
          // Extract filename and line number
          const match = line.match(/\((.+):(\d+):(\d+)\)/);
          if (match) {
            const filepath = match[1];
            const filename = path.basename(filepath);
            const lineNum = match[2];
            return `[${filename}:${lineNum}]`;
          }
        }
      }
    }
  } catch (e) {
    // Ignore errors in getting caller info
  }
  return '';
}

// Format log message
function formatMessage(level, message, includeColor = true) {
  const timestamp = getTimestamp();
  const caller = getCallerInfo();
  
  let colorCode = COLORS.WHITE;
  let emoji = '';
  
  switch (level) {
    case 'INFO':
      colorCode = COLORS.CYAN;
      emoji = 'ℹ️';
      break;
    case 'SUCCESS':
      colorCode = COLORS.GREEN;
      emoji = '✅';
      break;
    case 'WARN':
      colorCode = COLORS.YELLOW;
      emoji = '⚠️';
      break;
    case 'ERROR':
      colorCode = COLORS.RED;
      emoji = '❌';
      break;
    case 'DEBUG':
      colorCode = COLORS.GRAY;
      emoji = '🔍';
      break;
    case 'TRACE':
      colorCode = COLORS.MAGENTA;
      emoji = '📍';
      break;
    default:
      colorCode = COLORS.WHITE;
      emoji = '📝';
  }
  
  // Plain text for file
  const plainText = `[${timestamp}] [${level}] ${caller} ${message}`;
  
  // Colored text for console
  const coloredText = includeColor 
    ? `${colorCode}${emoji} [${timestamp}] [${level}] ${caller} ${message}${COLORS.RESET}`
    : plainText;
  
  return { plainText, coloredText };
}

// Write to log file with rotation
function writeToFile(plainText) {
  try {
    const logFile = getLogFile();
    fs.appendFileSync(logFile, plainText + '\n', 'utf8');
    
    // Check file size and rotate if needed (max 50MB)
    const stats = fs.statSync(logFile);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > 50) {
      const archiveFile = logFile.replace('.log', `_${Date.now()}.log`);
      fs.renameSync(logFile, archiveFile);
    }
  } catch (error) {
    // Fallback to console if file write fails
    console.error('⚠️ Logger file write error:', error.message);
    
    // Try fallback file
    try {
      const fallbackFile = path.join(LOG_DIR, 'fallback.log');
      fs.appendFileSync(fallbackFile, plainText + '\n', 'utf8');
    } catch (e) {
      // Last resort - just console
      console.error('❌ Fallback log write failed:', e.message);
    }
  }
}

// Main logging function
function log(level, ...args) {
  try {
    // Join all arguments into a single message
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    const { plainText, coloredText } = formatMessage(level, message);
    
    // Console output (colored)
    console.log(coloredText);
    
    // File output (plain text)
    writeToFile(plainText);
  } catch (error) {
    console.error('❌ Logger error:', error.message);
  }
}

// Clean old logs (keep last 30 days)
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted old log: ${file}`);
      }
    });
  } catch (error) {
    console.error('⚠️ Failed to clean old logs:', error.message);
  }
}

// Create logger object
function createLogger() {
  return {
    // Main log methods
    info: (...args) => log('INFO', ...args),
    success: (...args) => log('SUCCESS', ...args),
    warn: (...args) => log('WARN', ...args),
    error: (...args) => log('ERROR', ...args),
    debug: (...args) => log('DEBUG', ...args),
    trace: (...args) => log('TRACE', ...args),
    
    // Baileys compatibility
    child: (options) => {
      // Baileys uses .child() for namespaced loggers
      // We return the same logger instance for simplicity
      return createLogger();
    },
    
    // Utility methods
    cleanOldLogs,
    getLogFile,
    
    // Session-specific logging
    session: (sessionName, level, ...args) => {
      log(level, `[${sessionName}]`, ...args);
    },
    
    // Bulk sending logs
    bulk: (sessionName, ...args) => {
      log('INFO', `[BULK:${sessionName}]`, ...args);
    },
    
    // Connection logs
    connection: (sessionName, status, ...args) => {
      const level = status === 'connected' ? 'SUCCESS' : 
                    status === 'disconnected' ? 'WARN' : 'INFO';
      log(level, `[${sessionName}]`, ...args);
    }
  };
}

// Export singleton logger
export const logger = createLogger();

// Auto-clean old logs on initialization (async, non-blocking)
setTimeout(() => {
  try {
    logger.cleanOldLogs();
  } catch (e) {
    // Ignore cleanup errors
  }
}, 5000); // 5 seconds after startup

// Export createLogger for custom instances if needed
export { createLogger };
