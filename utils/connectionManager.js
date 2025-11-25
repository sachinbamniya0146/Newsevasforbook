import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

// Session storage
const sessions = new Map();
const sessionInfo = {};

/**
 * Register a session
 */
export function registerSession(name, sock) {
  sessions.set(name, sock);
  sessionInfo[name] = {
    state: 'connecting',
    lastStatus: 'Initializing...',
    retry: 0,
    errors: 0,
    connectedAt: null,
    hasPairingCode: false
  };
  logger.info(`[ConnectionManager] Registered: ${name}`);
}

/**
 * Unregister a session
 */
export function unregisterSession(name) {
  sessions.delete(name);
  delete sessionInfo[name];
  logger.info(`[ConnectionManager] Unregistered: ${name}`);
}

/**
 * Update session state
 */
export function updateSessionState(name, state, status) {
  if (sessionInfo[name]) {
    sessionInfo[name].state = state;
    sessionInfo[name].lastStatus = status;
    
    if (state === 'connected') {
      sessionInfo[name].connectedAt = new Date().toISOString();
      sessionInfo[name].retry = 0;
      sessionInfo[name].errors = 0;
    }
    
    logger.info(`[${name}] State: ${state} - ${status}`);
  }
}

/**
 * Increment retry count
 */
export function incrementRetry(name) {
  if (sessionInfo[name]) {
    sessionInfo[name].retry++;
    logger.warn(`[${name}] Retry count: ${sessionInfo[name].retry}`);
  }
}

/**
 * Increment error count
 */
export function incrementErrors(name) {
  if (sessionInfo[name]) {
    sessionInfo[name].errors++;
    logger.warn(`[${name}] Error count: ${sessionInfo[name].errors}`);
  }
}

/**
 * Get session info
 */
export function getSessionInfo(name) {
  return sessionInfo[name] || null;
}

/**
 * Get all session info
 */
export function getAllSessionInfo() {
  return sessionInfo;
}

/**
 * Get active sessions count
 */
export function getActiveSessionsCount() {
  return sessions.size;
}

/**
 * Get active session names
 */
export function getActiveSessions() {
  return Array.from(sessions.keys());
}

/**
 * Check if session is connected
 */
export function isSessionConnected(name) {
  const info = sessionInfo[name];
  return info && info.state === 'connected';
}

/**
 * Get session socket
 */
export function getSocket(name) {
  return sessions.get(name);
}

/**
 * Shutdown a session
 */
export function shutdownSession(name) {
  const sock = sessions.get(name);
  if (sock) {
    try {
      sock.end();
    } catch (e) {
      logger.warn(`[${name}] Shutdown error: ${e.message}`);
    }
    sessions.delete(name);
    delete sessionInfo[name];
    logger.success(`[ConnectionManager] Shutdown: ${name}`);
    return { success: true, name };
  }
  return { success: false, error: 'Session not found' };
}

/**
 * Mark session as having pairing code
 */
export function markPairingCode(name) {
  if (sessionInfo[name]) {
    sessionInfo[name].hasPairingCode = true;
  }
}

/**
 * Get session statistics
 */
export function getSessionStats() {
  const stats = {
    total: Object.keys(sessionInfo).length,
    connected: 0,
    connecting: 0,
    disconnected: 0,
    error: 0,
    reconnecting: 0
  };

  for (const info of Object.values(sessionInfo)) {
    if (stats[info.state] !== undefined) {
      stats[info.state]++;
    }
  }

  return stats;
}

/**
 * Get detailed session report
 */
export function getSessionReport() {
  const report = [];
  
  for (const [name, info] of Object.entries(sessionInfo)) {
    const sock = sessions.get(name);
    const phone = sock?.user?.id ? sock.user.id.split(':')[0] : 'Unknown';
    
    report.push({
      name,
      phone,
      state: info.state,
      status: info.lastStatus,
      retries: info.retry,
      errors: info.errors,
      connectedAt: info.connectedAt,
      hasPairingCode: info.hasPairingCode
    });
  }
  
  return report;
}

/**
 * Clear all sessions (for cleanup)
 */
export function clearAllSessions() {
  sessions.clear();
  for (const name in sessionInfo) {
    delete sessionInfo[name];
  }
  logger.info('[ConnectionManager] All sessions cleared');
}

// Export for use in other modules
export default {
  registerSession,
  unregisterSession,
  updateSessionState,
  getSessionInfo,
  getAllSessionInfo,
  getActiveSessionsCount,
  getActiveSessions,
  isSessionConnected,
  getSocket,
  shutdownSession,
  incrementRetry,
  incrementErrors,
  markPairingCode,
  getSessionStats,
  getSessionReport,
  clearAllSessions
};
