// ═══════════════════════════════════════════════════════════════════════════
// 📊 REAL-TIME LOGGER v2.0 - WebSocket + File + Console
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

class RealtimeLogger {
  constructor() {
    this.clients = new Set();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.logFile = './logs/system.log';
    this.stats = { total: 0, success: 0, warning: 0, error: 0, info: 0 };
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  addClient(ws) {
    this.clients.add(ws);
    ws.send(JSON.stringify({
      type: 'history',
      logs: this.logBuffer,
      stats: this.stats
    }));
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  log(level, category, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };

    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    this.stats.total++;
    this.stats[level.toLowerCase()]++;

    this.writeToFile(logEntry);
    this.broadcast(logEntry);
    this.consoleLog(logEntry);
  }

  broadcast(logEntry) {
    const message = JSON.stringify({ type: 'log', log: logEntry });
    this.clients.forEach(client => {
      try {
        if (client.readyState === 1) client.send(message);
      } catch (err) {}
    });
  }

  writeToFile(logEntry) {
    try {
      const logLine = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.category}] ${logEntry.message}\n`;
      fs.appendFileSync(this.logFile, logLine);
    } catch (err) {}
  }

  consoleLog(logEntry) {
    const colors = {
      INFO: '\x1b[36m',
      SUCCESS: '\x1b[32m',
      WARNING: '\x1b[33m',
      ERROR: '\x1b[31m',
      DEBUG: '\x1b[35m',
      PROGRESS: '\x1b[34m'
    };
    const reset = '\x1b[0m';
    const color = colors[logEntry.level] || reset;
    const time = new Date(logEntry.timestamp).toLocaleTimeString();
    console.log(`${color}[${time}] [${logEntry.level}] ${logEntry.message}${reset}`);
  }

  info(category, message, data) { this.log('INFO', category, message, data); }
  success(category, message, data) { this.log('SUCCESS', category, message, data); }
  warning(category, message, data) { this.log('WARNING', category, message, data); }
  error(category, message, data) { this.log('ERROR', category, message, data); }
  debug(category, message, data) { this.log('DEBUG', category, message, data); }
  progress(category, message, data) { this.log('PROGRESS', category, message, data); }
}

export const logger = new RealtimeLogger();
