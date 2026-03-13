/**
 * Security Audit Logger — V16.3 Security Hardening
 * Append-only JSONL logging with daily rotation.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_LOG_DIR = path.join(__dirname, '..', 'logs');

class SecurityAuditLog {
  constructor(options = {}) {
    this.logDir = options.logDir || DEFAULT_LOG_DIR;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _getLogPath() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `security-audit-${date}.jsonl`);
  }

  _truncate(str, max = 100) {
    if (!str || typeof str !== 'string') return str || '';
    return str.length > max ? str.substring(0, max) + '...' : str;
  }

  _write(entry) {
    const logPath = this._getLogPath();
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(logPath, line, 'utf8');
  }

  logSanitization(details) {
    this._write({
      type: 'sanitization',
      sessionId: details.sessionId || null,
      field: details.field || null,
      originalValue: this._truncate(details.originalValue),
      actions: details.actions || [],
      rule: details.rule || null,
    });
  }

  logOutputValidation(details) {
    this._write({
      type: 'output_validation',
      sessionId: details.sessionId || null,
      response: this._truncate(details.response),
      valid: details.valid,
      reason: details.reason || null,
      rulesTriggered: details.rulesTriggered || [],
    });
  }

  logRateLimit(details) {
    this._write({
      type: 'rate_limit',
      phone: details.phone || null,
      ip: details.ip || null,
      reason: details.reason || null,
      blocked: details.blocked !== undefined ? details.blocked : true,
    });
  }

  logAnomaly(details) {
    this._write({
      type: 'anomaly',
      sessionId: details.sessionId || null,
      reasons: details.reasons || [],
      flagged: details.flagged !== undefined ? details.flagged : true,
    });
  }

  logHoneypot(details) {
    this._write({
      type: 'honeypot',
      field: details.field || null,
      value: this._truncate(details.value),
      leadData: details.leadData ? { name: details.leadData.name, phone: details.leadData.phone } : null,
    });
  }
}

// Singleton
const defaultAuditLog = new SecurityAuditLog();

module.exports = {
  SecurityAuditLog,
  defaultAuditLog,
  logSanitization: (d) => defaultAuditLog.logSanitization(d),
  logOutputValidation: (d) => defaultAuditLog.logOutputValidation(d),
  logRateLimit: (d) => defaultAuditLog.logRateLimit(d),
  logAnomaly: (d) => defaultAuditLog.logAnomaly(d),
  logHoneypot: (d) => defaultAuditLog.logHoneypot(d),
};
