/**
 * @fileoverview Mock Logger for testing.
 */
class MockLogger {
  constructor() {
    this.logs = [];
  }
  
  debug(message, meta) {
    this.logs.push({ level: 'debug', message, meta, timestamp: Date.now() });
  }
  
  info(message, meta) {
    this.logs.push({ level: 'info', message, meta, timestamp: Date.now() });
  }
  
  warn(message, meta) {
    this.logs.push({ level: 'warn', message, meta, timestamp: Date.now() });
  }
  
  error(message, meta) {
    this.logs.push({ level: 'error', message, meta, timestamp: Date.now() });
  }
  
  getLogs(level) {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }
}

module.exports = MockLogger;
