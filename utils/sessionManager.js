import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import CONFIG from '../config.js';

class SessionManager {
  constructor() {
    this.forwardAdmins = {};
    this.sessionAdmins = {};
    this.loadMappings();
  }

  loadMappings() {
    try {
      const file = './data/sessionAdmins.json';
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.forwardAdmins = data.forwardAdmins || {};
        this.sessionAdmins = data.sessionAdmins || {};
      }
    } catch (e) {
      logger.error('[SessionManager] Load error:', e.message);
    }
  }

  saveMappings() {
    try {
      const dir = './data';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync('./data/sessionAdmins.json', JSON.stringify({
        forwardAdmins: this.forwardAdmins,
        sessionAdmins: this.sessionAdmins
      }, null, 2));
    } catch (e) {
      logger.error('[SessionManager] Save error:', e.message);
    }
  }

  setForwardAdmin(session, adminPhone) {
    this.forwardAdmins[session] = adminPhone;
    this.saveMappings();
    logger.info(`[SessionManager] Forward admin set: ${session} → ${adminPhone}`);
  }

  removeForwardAdmin(session) {
    delete this.forwardAdmins[session];
    this.saveMappings();
    logger.info(`[SessionManager] Forward admin removed: ${session}`);
  }

  getForwardAdmin(session) {
    return this.forwardAdmins[session] || null;
  }

  listForwardAdmins() {
    return {...this.forwardAdmins};
  }

  isAdmin(jid) {
    return jid === CONFIG.ADMIN.JID || Object.values(this.sessionAdmins).includes(jid);
  }
}

let sessionManagerInstance = null;
export function getSessionManager() {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
export function getSessionAdminManager() { return getSessionManager(); }
