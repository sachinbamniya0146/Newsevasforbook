import fs from 'fs';
import { logger } from './logger.js';

/**
 * Clean corrupted session data that causes Bad MAC errors
 */
export function cleanCorruptedSessions(sessionName) {
  try {
    const sessionPath = `./sessions/${sessionName}`;
    
    if (!fs.existsSync(sessionPath)) {
      return { success: false, error: 'Session not found' };
    }

    // Backup before cleaning
    const backupPath = `./sessions/backup_${sessionName}_${Date.now()}`;
    fs.cpSync(sessionPath, backupPath, { recursive: true });
    
    // Remove problematic files
    const filesToClean = [
      'app-state-sync-version-critical_unblock_low.json',
      'app-state-sync-version-regular_high.json',
      'app-state-sync-version-regular_low.json',
      'app-state-sync-version-regular.json'
    ];

    let cleaned = 0;
    filesToClean.forEach(file => {
      const filePath = `${sessionPath}/${file}`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });

    logger.success(`[SessionCleaner] Cleaned ${cleaned} files from ${sessionName}`);
    logger.info(`[SessionCleaner] Backup saved: ${backupPath}`);

    return { 
      success: true, 
      cleaned, 
      backup: backupPath 
    };
  } catch (error) {
    logger.error(`[SessionCleaner] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function cleanAllCorruptedSessions() {
  try {
    const sessionsDir = './sessions';
    if (!fs.existsSync(sessionsDir)) {
      return { success: false, error: 'Sessions directory not found' };
    }

    const sessions = fs.readdirSync(sessionsDir)
      .filter(d => !d.startsWith('backup_'));

    let totalCleaned = 0;
    sessions.forEach(session => {
      const result = cleanCorruptedSessions(session);
      if (result.success) {
        totalCleaned += result.cleaned;
      }
    });

    logger.success(`[SessionCleaner] Cleaned ${totalCleaned} files from ${sessions.length} sessions`);
    return { success: true, totalCleaned, sessions: sessions.length };
  } catch (error) {
    logger.error(`[SessionCleaner] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}
