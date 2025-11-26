import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { getFirstActiveSession } from './sessionHelper.js';
import CONFIG from '../config.js';

/**
 * Enhanced Pairing Manager
 * - Tracks all pairing attempts with detailed history
 * - Forwards pairing codes to admin WhatsApp
 * - Success/failure rate analytics
 * - Persistent storage for session recovery
 * - Auto-cleanup old pairings
 */
class PairingManager {
  constructor() {
    this.pairings = new Map();
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      expired: 0
    };
    this.history = [];
    this.maxHistorySize = 100;
    this.dataFile = './data/pairing_history.json';
    this.autoCleanupEnabled = true;
    this.cleanupInterval = null;
    
    this.loadPersistentData();
    this.startAutoCleanup();
    
    logger.info('[PairingManager] Initialized with persistent storage');
  }

  /**
   * Load pairing data from disk
   */
  loadPersistentData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        
        // Restore pairings
        if (data.pairings) {
          this.pairings = new Map(Object.entries(data.pairings));
        }
        
        // Restore stats
        if (data.stats) {
          this.stats = { ...this.stats, ...data.stats };
        }
        
        // Restore history
        if (data.history) {
          this.history = data.history;
        }
        
        logger.success(`[PairingManager] Loaded ${this.pairings.size} pairings from disk`);
      }
    } catch (error) {
      logger.error(`[PairingManager] Load error: ${error.message}`);
    }
  }

  /**
   * Save pairing data to disk
   */
  savePersistentData() {
    try {
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const data = {
        pairings: Object.fromEntries(this.pairings),
        stats: this.stats,
        history: this.history,
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`[PairingManager] Save error: ${error.message}`);
    }
  }

  /**
   * Start automatic cleanup of old pairings
   */
  startAutoCleanup() {
    if (this.cleanupInterval) return;
    
    // Run cleanup every 6 hours
    this.cleanupInterval = setInterval(() => {
      if (this.autoCleanupEnabled) {
        this.cleanup(7); // Remove pairings older than 7 days
      }
    }, 21600000);
    
    logger.info('[PairingManager] Auto-cleanup started (every 6 hours)');
  }

  /**
   * Register a new pairing attempt
   */
  registerPairing(sessionName, phone) {
    const existing = this.pairings.get(sessionName);
    
    if (existing) {
      existing.attempts = (existing.attempts || 1) + 1;
      existing.lastAttemptAt = new Date().toISOString();
      this.pairings.set(sessionName, existing);
      logger.info(`[PairingManager] Updated: ${sessionName} (attempt ${existing.attempts})`);
      return existing;
    }
    
    const pairing = {
      sessionName,
      phone,
      status: 'pending',
      code: null,
      timestamp: new Date().toISOString(),
      attempts: 1,
      createdAt: new Date().toISOString()
    };
    
    this.pairings.set(sessionName, pairing);
    this.stats.total++;
    this.stats.pending++;
    
    this.addToHistory({
      action: 'registered',
      sessionName,
      phone,
      timestamp: new Date().toISOString()
    });
    
    this.savePersistentData();
    
    logger.info(`[PairingManager] Registered: ${sessionName} (${phone})`);
    return pairing;
  }

  /**
   * Forward pairing code to admin WhatsApp
   */
  async forwardPairingCode(sessionName, code, phone) {
    try {
      let pairing = this.pairings.get(sessionName);
      
      if (!pairing) {
        pairing = this.registerPairing(sessionName, phone);
      }
      
      pairing.code = code;
      pairing.status = 'code_sent';
      pairing.codeSentAt = new Date().toISOString();
      this.pairings.set(sessionName, pairing);
      
      this.addToHistory({
        action: 'code_sent',
        sessionName,
        code,
        phone,
        timestamp: new Date().toISOString()
      });
      
      this.savePersistentData();
      
      logger.success(`[PairingManager] Code forwarded: ${sessionName} -> ${code}`);
      return { success: true, code };
    } catch (error) {
      logger.error(`[PairingManager] Forward error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark pairing as successful
   */
  markPairingSuccess(sessionName) {
    const pairing = this.pairings.get(sessionName);
    
    if (!pairing) {
      logger.warn(`[PairingManager] Session not found: ${sessionName}`);
      return { success: false, error: 'Session not found' };
    }
    
    // Update stats
    if (pairing.status === 'pending') {
      this.stats.pending--;
    } else if (pairing.status === 'failed') {
      this.stats.failed--;
    }
    
    pairing.status = 'success';
    pairing.completedAt = new Date().toISOString();
    pairing.duration = this.calculateDuration(pairing.timestamp, pairing.completedAt);
    this.pairings.set(sessionName, pairing);
    
    this.stats.successful++;
    
    this.addToHistory({
      action: 'success',
      sessionName,
      phone: pairing.phone,
      duration: pairing.duration,
      timestamp: new Date().toISOString()
    });
    
    this.savePersistentData();
    
    logger.success(`[PairingManager] Success: ${sessionName} (${pairing.duration})`);
    
    // Notify admin
    const message = `✅ *Pairing Successful*\n\n` +
      `Session: *${sessionName}*\n` +
      `Phone: ${pairing.phone}\n` +
      `Duration: ${pairing.duration}\n` +
      `Attempts: ${pairing.attempts}\n` +
      `Time: ${this.formatDateTime()}`;
    
    this.notifyAdmin(message);
    
    return { success: true };
  }

  /**
   * Mark pairing as failed
   */
  markPairingFailed(sessionName, reason = 'Unknown') {
    const pairing = this.pairings.get(sessionName);
    
    if (!pairing) {
      logger.warn(`[PairingManager] Session not found: ${sessionName}`);
      return { success: false, error: 'Session not found' };
    }
    
    // Update stats
    if (pairing.status === 'pending') {
      this.stats.pending--;
    }
    
    pairing.status = 'failed';
    pairing.failedAt = new Date().toISOString();
    pairing.failureReason = reason;
    this.pairings.set(sessionName, pairing);
    
    this.stats.failed++;
    
    this.addToHistory({
      action: 'failed',
      sessionName,
      phone: pairing.phone,
      reason,
      timestamp: new Date().toISOString()
    });
    
    this.savePersistentData();
    
    logger.error(`[PairingManager] Failed: ${sessionName} (${reason})`);
    
    // Notify admin
    const message = `❌ *Pairing Failed*\n\n` +
      `Session: *${sessionName}*\n` +
      `Phone: ${pairing.phone}\n` +
      `Reason: ${reason}\n` +
      `Attempts: ${pairing.attempts}\n` +
      `Time: ${this.formatDateTime()}`;
    
    this.notifyAdmin(message);
    
    return { success: true };
  }

  /**
   * Mark pairing as expired (code timeout)
   */
  markPairingExpired(sessionName) {
    const pairing = this.pairings.get(sessionName);
    
    if (!pairing) {
      return { success: false, error: 'Session not found' };
    }
    
    if (pairing.status === 'pending') {
      this.stats.pending--;
    }
    
    pairing.status = 'expired';
    pairing.expiredAt = new Date().toISOString();
    this.pairings.set(sessionName, pairing);
    
    this.stats.expired++;
    
    this.addToHistory({
      action: 'expired',
      sessionName,
      phone: pairing.phone,
      timestamp: new Date().toISOString()
    });
    
    this.savePersistentData();
    
    logger.warn(`[PairingManager] Expired: ${sessionName}`);
    return { success: true };
  }

  /**
   * Get pairing info for a session
   */
  getPairingInfo(sessionName) {
    return this.pairings.get(sessionName) || null;
  }

  /**
   * Get all pairings
   */
  getAllPairings() {
    const pairings = {};
    for (const [name, data] of this.pairings) {
      pairings[name] = { ...data };
    }
    return pairings;
  }

  /**
   * Get statistics with enhanced metrics
   */
  getStats() {
    const successRate = this.stats.total > 0 
      ? `${((this.stats.successful / this.stats.total) * 100).toFixed(1)}%`
      : '0%';
    
    const failureRate = this.stats.total > 0
      ? `${((this.stats.failed / this.stats.total) * 100).toFixed(1)}%`
      : '0%';
    
    const avgAttempts = this.calculateAverageAttempts();
    
    return {
      total: this.stats.total,
      successful: this.stats.successful,
      failed: this.stats.failed,
      pending: this.stats.pending,
      expired: this.stats.expired,
      successRate,
      failureRate,
      avgAttempts: avgAttempts.toFixed(1)
    };
  }

  /**
   * Calculate average pairing attempts
   */
  calculateAverageAttempts() {
    if (this.pairings.size === 0) return 0;
    
    let totalAttempts = 0;
    for (const [, data] of this.pairings) {
      totalAttempts += data.attempts || 1;
    }
    
    return totalAttempts / this.pairings.size;
  }

  /**
   * Get pending pairings (waiting for code entry)
   */
  getPendingPairings() {
    const pending = [];
    
    for (const [name, data] of this.pairings) {
      if (data.status === 'pending' || data.status === 'code_sent') {
        pending.push({ name, ...data });
      }
    }
    
    return pending;
  }

  /**
   * Get recent history
   */
  getRecentHistory(limit = 10) {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Retry a failed pairing
   */
  retryPairing(sessionName) {
    const pairing = this.pairings.get(sessionName);
    
    if (!pairing) {
      return { success: false, error: 'Pairing not found' };
    }
    
    // Update stats
    if (pairing.status === 'failed') {
      this.stats.failed--;
    } else if (pairing.status === 'pending') {
      this.stats.pending--;
    } else if (pairing.status === 'expired') {
      this.stats.expired--;
    }
    
    pairing.status = 'pending';
    pairing.attempts = (pairing.attempts || 1) + 1;
    pairing.lastRetryAt = new Date().toISOString();
    this.pairings.set(sessionName, pairing);
    
    this.stats.pending++;
    
    this.addToHistory({
      action: 'retry',
      sessionName,
      attempt: pairing.attempts,
      timestamp: new Date().toISOString()
    });
    
    this.savePersistentData();
    
    logger.info(`[PairingManager] Retry attempt ${pairing.attempts}: ${sessionName}`);
    return { success: true, attempts: pairing.attempts };
  }

  /**
   * Clear old/completed pairings (cleanup)
   */
  cleanup(olderThanDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let removed = 0;
    
    for (const [name, data] of this.pairings) {
      const pairingDate = new Date(data.timestamp);
      
      if (pairingDate < cutoffDate && (data.status === 'success' || data.status === 'failed')) {
        this.pairings.delete(name);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.savePersistentData();
      logger.info(`[PairingManager] Cleanup: removed ${removed} old pairings`);
    }
    
    return removed;
  }

  /**
   * Clear all pairing data (reset)
   */
  clearAll() {
    this.pairings.clear();
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      expired: 0
    };
    this.history = [];
    this.savePersistentData();
    
    logger.warn('[PairingManager] All data cleared');
    return { success: true };
  }

  /**
   * Add entry to history
   */
  addToHistory(entry) {
    this.history.push(entry);
    
    // Keep only recent history
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Calculate duration between two timestamps
   */
  calculateDuration(start, end) {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diff = endTime - startTime;
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Format current date/time in IST
   */
  formatDateTime() {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Send notification to admin WhatsApp
   */
  async notifyAdmin(message) {
    try {
      const sock = getFirstActiveSession();
      
      if (sock && CONFIG.ADMIN && CONFIG.ADMIN.JID) {
        await sock.sendMessage(CONFIG.ADMIN.JID, { text: message });
        logger.info('[PairingManager] Admin notified');
      }
    } catch (error) {
      logger.error(`[PairingManager] Notification error: ${error.message}`);
    }
  }

  /**
   * Get detailed report for admin
   */
  getReport() {
    const stats = this.getStats();
    const pending = this.getPendingPairings();
    const recent = this.getRecentHistory(5);
    
    let report = `📊 *PAIRING REPORT*\n\n`;
    
    // Statistics
    report += `📈 *Statistics*\n`;
    report += `Total Attempts: ${stats.total}\n`;
    report += `✅ Successful: ${stats.successful}\n`;
    report += `❌ Failed: ${stats.failed}\n`;
    report += `⏳ Pending: ${stats.pending}\n`;
    report += `⌛ Expired: ${stats.expired}\n`;
    report += `Success Rate: ${stats.successRate}\n`;
    report += `Avg Attempts: ${stats.avgAttempts}\n\n`;
    
    // Pending pairings
    if (pending.length > 0) {
      report += `⏳ *Pending Pairings:*\n`;
      pending.forEach((p, i) => {
        report += `${i + 1}. ${p.name} (${p.phone})\n`;
        if (p.code) {
          report += `   Code: \`${p.code}\`\n`;
        }
        report += `   Status: ${p.status}\n`;
        report += `   Attempts: ${p.attempts}\n`;
      });
      report += `\n`;
    } else {
      report += `No pending pairings\n\n`;
    }
    
    // Recent activity
    if (recent.length > 0) {
      report += `🕐 *Recent Activity:*\n`;
      recent.forEach((h, i) => {
        const time = new Date(h.timestamp).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        });
        report += `${i + 1}. ${h.action.toUpperCase()} - ${h.sessionName} (${time})\n`;
      });
    }
    
    return report;
  }

  /**
   * Get report in JSON format
   */
  getJsonReport() {
    return {
      stats: this.getStats(),
      pending: this.getPendingPairings(),
      recent: this.getRecentHistory(10),
      totalPairings: this.pairings.size,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Export all data to file
   */
  exportData(filename = null) {
    try {
      const exportFile = filename || `./data/pairing_export_${Date.now()}.json`;
      const data = {
        pairings: Object.fromEntries(this.pairings),
        stats: this.stats,
        history: this.history,
        exportedAt: new Date().toISOString()
      };
      
      const dir = path.dirname(exportFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(exportFile, JSON.stringify(data, null, 2));
      
      logger.success(`[PairingManager] Data exported to ${exportFile}`);
      return { success: true, file: exportFile };
    } catch (error) {
      logger.error(`[PairingManager] Export error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.savePersistentData();
    logger.info('[PairingManager] Destroyed gracefully');
  }
}

// ==================== SINGLETON INSTANCE ====================
let pairingManagerInstance = null;

/**
 * Get singleton instance of PairingManager
 */
export function getPairingManager() {
  if (!pairingManagerInstance) {
    pairingManagerInstance = new PairingManager();
    logger.info('[PairingManager] Instance created');
  }
  return pairingManagerInstance;
}

export default getPairingManager;
