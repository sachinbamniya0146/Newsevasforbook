import { logger } from './logger.js';

// Global session storage
const activeSessions = new Map();
const sessionMetadata = new Map();

/**
 * Register a new active session
 * @param {string} sessionId - Session identifier
 * @param {object} socket - WhatsApp socket connection
 */
export function registerActiveSession(sessionId, socket) {
  if (!sessionId || !socket) {
    logger.error('[SessionHelper] Invalid session registration attempt');
    return false;
  }
  
  activeSessions.set(sessionId, socket);
  
  // Initialize metadata
  sessionMetadata.set(sessionId, {
    id: sessionId,
    registeredAt: new Date().toISOString(),
    status: 'active',
    messagesSent: 0,
    messagesReceived: 0,
    lastActivity: new Date().toISOString(),
    errors: 0
  });
  
  logger.success(`[SessionHelper] Session registered: ${sessionId}`);
  return true;
}

/**
 * Unregister/remove a session
 * @param {string} sessionId - Session identifier
 */
export function unregisterActiveSession(sessionId) {
  if (!sessionId) {
    return false;
  }
  
  const existed = activeSessions.has(sessionId);
  activeSessions.delete(sessionId);
  sessionMetadata.delete(sessionId);
  
  if (existed) {
    logger.info(`[SessionHelper] Session unregistered: ${sessionId}`);
  }
  
  return existed;
}

/**
 * Get first available active session
 * @returns {object|null} Socket connection or null
 */
export function getFirstActiveSession() {
  if (activeSessions.size === 0) {
    logger.warn('[SessionHelper] No active sessions available');
    return null;
  }
  
  const firstSocket = activeSessions.values().next().value;
  return firstSocket || null;
}

/**
 * Get all active sessions as Map
 * @returns {Map} Map of sessionId -> socket
 */
export function getAllActiveSessions() {
  return activeSessions;
}

/**
 * Get array of active session IDs
 * @returns {Array} Array of session IDs
 */
export function getActiveSessions() {
  return Array.from(activeSessions.keys());
}

/**
 * Get specific session by ID
 * @param {string} sessionId - Session identifier
 * @returns {object|null} Socket or null
 */
export function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

/**
 * Check if session exists and is active
 * @param {string} sessionId - Session identifier
 * @returns {boolean}
 */
export function isSessionActive(sessionId) {
  return activeSessions.has(sessionId);
}

/**
 * Get session count
 * @returns {number}
 */
export function getSessionCount() {
  return activeSessions.size;
}

/**
 * Get session metadata
 * @param {string} sessionId - Session identifier
 * @returns {object|null}
 */
export function getSessionMetadata(sessionId) {
  return sessionMetadata.get(sessionId) || null;
}

/**
 * Get all sessions metadata
 * @returns {object} Object with all metadata
 */
export function getAllSessionInfo() {
  const info = {};
  
  for (const [sessionId, metadata] of sessionMetadata) {
    info[sessionId] = { ...metadata };
  }
  
  return info;
}

/**
 * Update session activity timestamp
 * @param {string} sessionId - Session identifier
 */
export function updateSessionActivity(sessionId) {
  const metadata = sessionMetadata.get(sessionId);
  
  if (metadata) {
    metadata.lastActivity = new Date().toISOString();
    sessionMetadata.set(sessionId, metadata);
  }
}

/**
 * Increment session message counter
 * @param {string} sessionId - Session identifier
 * @param {string} type - 'sent' or 'received'
 */
export function incrementMessageCount(sessionId, type = 'sent') {
  const metadata = sessionMetadata.get(sessionId);
  
  if (metadata) {
    if (type === 'sent') {
      metadata.messagesSent++;
    } else if (type === 'received') {
      metadata.messagesReceived++;
    }
    
    metadata.lastActivity = new Date().toISOString();
    sessionMetadata.set(sessionId, metadata);
  }
}

/**
 * Increment error count for session
 * @param {string} sessionId - Session identifier
 */
export function incrementErrorCount(sessionId) {
  const metadata = sessionMetadata.get(sessionId);
  
  if (metadata) {
    metadata.errors++;
    sessionMetadata.set(sessionId, metadata);
  }
}

/**
 * Update session status
 * @param {string} sessionId - Session identifier
 * @param {string} status - Status string
 */
export function updateSessionStatus(sessionId, status) {
  const metadata = sessionMetadata.get(sessionId);
  
  if (metadata) {
    metadata.status = status;
    metadata.lastActivity = new Date().toISOString();
    sessionMetadata.set(sessionId, metadata);
  }
}

/**
 * Get session statistics
 * @returns {object} Statistics object
 */
export function getSessionStats() {
  let totalSent = 0;
  let totalReceived = 0;
  let totalErrors = 0;
  
  for (const metadata of sessionMetadata.values()) {
    totalSent += metadata.messagesSent || 0;
    totalReceived += metadata.messagesReceived || 0;
    totalErrors += metadata.errors || 0;
  }
  
  return {
    totalSessions: activeSessions.size,
    activeSessions: getActiveSessions(),
    totalMessagesSent: totalSent,
    totalMessagesReceived: totalReceived,
    totalErrors: totalErrors,
    avgMessagesPerSession: activeSessions.size > 0 ? 
      Math.round(totalSent / activeSessions.size) : 0
  };
}

/**
 * Get healthy sessions (active with no recent errors)
 * @returns {Array} Array of healthy session IDs
 */
export function getHealthySessions() {
  const healthy = [];
  
  for (const [sessionId, metadata] of sessionMetadata) {
    if (metadata.status === 'active' && metadata.errors < 5) {
      healthy.push(sessionId);
    }
  }
  
  return healthy;
}

/**
 * Rotate to next available session (load balancing)
 * @param {string} currentSessionId - Current session ID
 * @returns {string|null} Next session ID or null
 */
export function getNextSession(currentSessionId) {
  const sessions = getActiveSessions();
  
  if (sessions.length <= 1) {
    return currentSessionId;
  }
  
  const currentIndex = sessions.indexOf(currentSessionId);
  const nextIndex = (currentIndex + 1) % sessions.length;
  
  return sessions[nextIndex];
}

/**
 * Get least busy session (for load balancing)
 * @returns {string|null} Session ID with least messages sent
 */
export function getLeastBusySession() {
  if (activeSessions.size === 0) {
    return null;
  }
  
  let leastBusy = null;
  let minMessages = Infinity;
  
  for (const [sessionId, metadata] of sessionMetadata) {
    const totalMessages = (metadata.messagesSent || 0);
    
    if (totalMessages < minMessages && metadata.status === 'active') {
      minMessages = totalMessages;
      leastBusy = sessionId;
    }
  }
  
  return leastBusy || getActiveSessions()[0];
}

/**
 * Clear all sessions (emergency/shutdown)
 */
export function clearAllSessions() {
  const count = activeSessions.size;
  activeSessions.clear();
  sessionMetadata.clear();
  logger.warn(`[SessionHelper] Cleared ${count} sessions`);
  return count;
}

/**
 * Get session uptime in seconds
 * @param {string} sessionId - Session identifier
 * @returns {number} Uptime in seconds
 */
export function getSessionUptime(sessionId) {
  const metadata = sessionMetadata.get(sessionId);
  
  if (!metadata || !metadata.registeredAt) {
    return 0;
  }
  
  const registered = new Date(metadata.registeredAt);
  const now = new Date();
  const uptimeMs = now - registered;
  
  return Math.floor(uptimeMs / 1000);
}

/**
 * Export all functions and state
 */
export default {
  registerActiveSession,
  unregisterActiveSession,
  getFirstActiveSession,
  getAllActiveSessions,
  getActiveSessions,
  getSession,
  isSessionActive,
  getSessionCount,
  getSessionMetadata,
  getAllSessionInfo,
  updateSessionActivity,
  incrementMessageCount,
  incrementErrorCount,
  updateSessionStatus,
  getSessionStats,
  getHealthySessions,
  getNextSession,
  getLeastBusySession,
  clearAllSessions,
  getSessionUptime
};
