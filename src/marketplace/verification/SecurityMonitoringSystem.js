/**
 * @fileoverview Security Monitoring System for the Aideon Tentacle Marketplace
 * 
 * This module provides functionality for continuous security monitoring of
 * published tentacles, detecting anomalies, and responding to security incidents.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../core/logging/Logger');
const { EventEmitter } = require('../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

/**
 * SecurityMonitoringSystem class - Manages security monitoring for tentacles
 */
class SecurityMonitoringSystem {
  /**
   * Create a new SecurityMonitoringSystem instance
   * @param {Object} options - Configuration options
   * @param {Object} options.alertManager - Reference to the alert manager
   * @param {Object} options.telemetryCollector - Reference to the telemetry collector
   * @param {Object} options.anomalyDetector - Reference to the anomaly detector
   * @param {string} options.storagePath - Path to store monitoring data
   */
  constructor(options = {}) {
    this.options = options;
    this.alertManager = options.alertManager;
    this.telemetryCollector = options.telemetryCollector;
    this.anomalyDetector = options.anomalyDetector;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'security-monitoring-data');
    this.logger = new Logger('SecurityMonitoringSystem');
    this.events = new EventEmitter();
    this.monitoredTentacles = new Map();
    this.securityIncidents = new Map();
    this.initialized = false;
    
    // Define monitoring intervals
    this.monitoringIntervals = {
      telemetryCollection: options.telemetryInterval || 15 * 60 * 1000, // 15 minutes
      anomalyDetection: options.anomalyInterval || 60 * 60 * 1000, // 1 hour
      vulnerabilityScan: options.vulnerabilityInterval || 24 * 60 * 60 * 1000 // 1 day
    };
    
    // Define alert thresholds
    this.alertThresholds = {
      anomalyScore: options.anomalyThreshold || 0.7, // 0.0 to 1.0
      vulnerabilitySeverity: options.vulnerabilityThreshold || 'medium', // critical, high, medium, low
      incidentCount: options.incidentThreshold || 3 // Number of incidents before escalation
    };
    
    // Define monitoring jobs
    this.monitoringJobs = new Map();
  }

  /**
   * Initialize the security monitoring system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('SecurityMonitoringSystem already initialized');
      return true;
    }

    this.logger.info('Initializing SecurityMonitoringSystem');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'tentacles'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'incidents'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'telemetry'), { recursive: true });
      
      // Initialize alert manager if available
      if (this.alertManager) {
        await this.alertManager.initialize();
      } else {
        this.logger.warn('AlertManager not provided, using built-in alert manager');
        this.alertManager = this._createBuiltInAlertManager();
      }
      
      // Initialize telemetry collector if available
      if (this.telemetryCollector) {
        await this.telemetryCollector.initialize();
      } else {
        this.logger.warn('TelemetryCollector not provided, using built-in telemetry collector');
        this.telemetryCollector = this._createBuiltInTelemetryCollector();
      }
      
      // Initialize anomaly detector if available
      if (this.anomalyDetector) {
        await this.anomalyDetector.initialize();
      } else {
        this.logger.warn('AnomalyDetector not provided, using built-in anomaly detector');
        this.anomalyDetector = this._createBuiltInAnomalyDetector();
      }
      
      // Load previously monitored tentacles
      await this._loadMonitoredTentacles();
      
      // Restart monitoring for previously monitored tentacles
      for (const [tentacleId, tentacle] of this.monitoredTentacles.entries()) {
        if (tentacle.status === 'monitoring') {
          await this._startMonitoringJobs(tentacleId);
        }
      }
      
      this.initialized = true;
      this.logger.info('SecurityMonitoringSystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize SecurityMonitoringSystem', error);
      throw error;
    }
  }

  /**
   * Create a built-in alert manager
   * @returns {Object} - Built-in alert manager
   * @private
   */
  _createBuiltInAlertManager() {
    return {
      name: 'BuiltInAlertManager',
      description: 'Basic built-in alert manager for security monitoring',
      
      initialize: async () => {
        return true;
      },
      
      createAlert: async (alert) => {
        this.logger.info(`Alert created: ${alert.title}`);
        
        return {
          id: `alert_${crypto.randomBytes(8).toString('hex')}`,
          ...alert,
          status: 'created',
          createdAt: new Date().toISOString()
        };
      },
      
      updateAlert: async (alertId, update) => {
        this.logger.info(`Alert updated: ${alertId}`);
        
        return {
          id: alertId,
          ...update,
          status: update.status || 'updated',
          updatedAt: new Date().toISOString()
        };
      },
      
      closeAlert: async (alertId, resolution) => {
        this.logger.info(`Alert closed: ${alertId}`);
        
        return {
          id: alertId,
          status: 'closed',
          resolution,
          closedAt: new Date().toISOString()
        };
      },
      
      getAlert: async (alertId) => {
        return {
          id: alertId,
          title: 'Mock Alert',
          description: 'This is a mock alert',
          severity: 'medium',
          status: 'created',
          createdAt: new Date().toISOString()
        };
      },
      
      shutdown: async () => {
        return true;
      }
    };
  }

  /**
   * Create a built-in telemetry collector
   * @returns {Object} - Built-in telemetry collector
   * @private
   */
  _createBuiltInTelemetryCollector() {
    return {
      name: 'BuiltInTelemetryCollector',
      description: 'Basic built-in telemetry collector for security monitoring',
      
      initialize: async () => {
        return true;
      },
      
      collectTelemetry: async (tentacleId) => {
        // Generate mock telemetry data
        return {
          tentacleId,
          timestamp: new Date().toISOString(),
          metrics: {
            cpu: Math.floor(Math.random() * 100),
            memory: Math.floor(Math.random() * 100),
            disk: Math.floor(Math.random() * 100),
            network: Math.floor(Math.random() * 100)
          },
          events: [
            {
              type: 'api_call',
              api: `aideon.api.${['core', 'ui', 'data', 'network'][Math.floor(Math.random() * 4)]}.${['get', 'set', 'create', 'delete'][Math.floor(Math.random() * 4)]}`,
              timestamp: new Date().toISOString()
            },
            {
              type: 'file_access',
              path: `/path/to/file${Math.floor(Math.random() * 10)}.txt`,
              operation: ['read', 'write', 'delete'][Math.floor(Math.random() * 3)],
              timestamp: new Date().toISOString()
            }
          ],
          logs: [
            {
              level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)],
              message: `Log message ${Math.floor(Math.random() * 100)}`,
              timestamp: new Date().toISOString()
            }
          ]
        };
      },
      
      getTelemetryHistory: async (tentacleId, startTime, endTime) => {
        // Generate mock telemetry history
        const history = [];
        const now = Date.now();
        const interval = (endTime - startTime) / 10;
        
        for (let i = 0; i < 10; i++) {
          history.push({
            tentacleId,
            timestamp: new Date(now - (interval * i)).toISOString(),
            metrics: {
              cpu: Math.floor(Math.random() * 100),
              memory: Math.floor(Math.random() * 100),
              disk: Math.floor(Math.random() * 100),
              network: Math.floor(Math.random() * 100)
            }
          });
        }
        
        return history.reverse();
      },
      
      shutdown: async () => {
        return true;
      }
    };
  }

  /**
   * Create a built-in anomaly detector
   * @returns {Object} - Built-in anomaly detector
   * @private
   */
  _createBuiltInAnomalyDetector() {
    return {
      name: 'BuiltInAnomalyDetector',
      description: 'Basic built-in anomaly detector for security monitoring',
      
      initialize: async () => {
        return true;
      },
      
      detectAnomalies: async (tentacleId, telemetry) => {
        // Generate mock anomaly detection results
        const anomalies = [];
        
        // 10% chance of detecting an anomaly
        if (Math.random() < 0.1) {
          anomalies.push({
            id: `anomaly_${crypto.randomBytes(8).toString('hex')}`,
            tentacleId,
            type: 'resource_usage',
            description: 'Unusual resource usage pattern detected',
            score: Math.random(),
            timestamp: new Date().toISOString(),
            details: {
              metric: ['cpu', 'memory', 'disk', 'network'][Math.floor(Math.random() * 4)],
              value: Math.floor(Math.random() * 100),
              threshold: 80
            }
          });
        }
        
        // 5% chance of detecting another anomaly
        if (Math.random() < 0.05) {
          anomalies.push({
            id: `anomaly_${crypto.randomBytes(8).toString('hex')}`,
            tentacleId,
            type: 'api_usage',
            description: 'Unusual API usage pattern detected',
            score: Math.random(),
            timestamp: new Date().toISOString(),
            details: {
              api: `aideon.api.${['core', 'ui', 'data', 'network'][Math.floor(Math.random() * 4)]}.${['get', 'set', 'create', 'delete'][Math.floor(Math.random() * 4)]}`,
              callCount: Math.floor(Math.random() * 100),
              threshold: 50
            }
          });
        }
        
        return anomalies;
      },
      
      shutdown: async () => {
        return true;
      }
    };
  }

  /**
   * Load previously monitored tentacles
   * @returns {Promise<void>}
   * @private
   */
  async _loadMonitoredTentacles() {
    const tentaclesDir = path.join(this.storagePath, 'tentacles');
    
    try {
      const files = await fs.readdir(tentaclesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(tentaclesDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const tentacle = JSON.parse(data);
            
            this.monitoredTentacles.set(tentacle.id, tentacle);
          } catch (error) {
            this.logger.error(`Failed to load tentacle from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.monitoredTentacles.size} previously monitored tentacles`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load monitored tentacles', error);
      }
    }
  }

  /**
   * Save monitored tentacle information
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} tentacle - Tentacle information
   * @returns {Promise<void>}
   * @private
   */
  async _saveTentacleInfo(tentacleId, tentacle) {
    const tentaclePath = path.join(this.storagePath, 'tentacles', `${tentacleId}.json`);
    
    await fs.writeFile(tentaclePath, JSON.stringify(tentacle, null, 2));
  }

  /**
   * Start monitoring jobs for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<void>}
   * @private
   */
  async _startMonitoringJobs(tentacleId) {
    // Cancel existing jobs if any
    this._cancelMonitoringJobs(tentacleId);
    
    // Start telemetry collection job
    const telemetryJob = setInterval(async () => {
      try {
        await this._collectTelemetry(tentacleId);
      } catch (error) {
        this.logger.error(`Failed to collect telemetry for tentacle: ${tentacleId}`, error);
      }
    }, this.monitoringIntervals.telemetryCollection);
    
    // Start anomaly detection job
    const anomalyJob = setInterval(async () => {
      try {
        await this._detectAnomalies(tentacleId);
      } catch (error) {
        this.logger.error(`Failed to detect anomalies for tentacle: ${tentacleId}`, error);
      }
    }, this.monitoringIntervals.anomalyDetection);
    
    // Start vulnerability scan job
    const vulnerabilityJob = setInterval(async () => {
      try {
        await this._scanForVulnerabilities(tentacleId);
      } catch (error) {
        this.logger.error(`Failed to scan for vulnerabilities for tentacle: ${tentacleId}`, error);
      }
    }, this.monitoringIntervals.vulnerabilityScan);
    
    // Store jobs
    this.monitoringJobs.set(tentacleId, {
      telemetry: telemetryJob,
      anomaly: anomalyJob,
      vulnerability: vulnerabilityJob
    });
    
    // Run initial jobs immediately
    try {
      await this._collectTelemetry(tentacleId);
      await this._detectAnomalies(tentacleId);
      await this._scanForVulnerabilities(tentacleId);
    } catch (error) {
      this.logger.error(`Failed to run initial monitoring jobs for tentacle: ${tentacleId}`, error);
    }
  }

  /**
   * Cancel monitoring jobs for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @private
   */
  _cancelMonitoringJobs(tentacleId) {
    const jobs = this.monitoringJobs.get(tentacleId);
    
    if (jobs) {
      clearInterval(jobs.telemetry);
      clearInterval(jobs.anomaly);
      clearInterval(jobs.vulnerability);
      
      this.monitoringJobs.delete(tentacleId);
    }
  }

  /**
   * Collect telemetry for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Object>} - Promise resolving to telemetry data
   * @private
   */
  async _collectTelemetry(tentacleId) {
    this.logger.info(`Collecting telemetry for tentacle: ${tentacleId}`);
    
    try {
      // Collect telemetry
      const telemetry = await this.telemetryCollector.collectTelemetry(tentacleId);
      
      // Save telemetry
      const telemetryPath = path.join(
        this.storagePath,
        'telemetry',
        `${tentacleId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );
      
      await fs.writeFile(telemetryPath, JSON.stringify(telemetry, null, 2));
      
      // Update tentacle information
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      if (tentacle) {
        tentacle.lastTelemetryCollection = new Date().toISOString();
        await this._saveTentacleInfo(tentacleId, tentacle);
      }
      
      // Emit event
      this.events.emit('telemetry:collected', { tentacleId, telemetry });
      
      return telemetry;
    } catch (error) {
      this.logger.error(`Failed to collect telemetry for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Detect anomalies for a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Array<Object>>} - Promise resolving to array of anomalies
   * @private
   */
  async _detectAnomalies(tentacleId) {
    this.logger.info(`Detecting anomalies for tentacle: ${tentacleId}`);
    
    try {
      // Get recent telemetry
      const now = Date.now();
      const startTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
      
      const telemetryHistory = await this.telemetryCollector.getTelemetryHistory(
        tentacleId,
        startTime,
        now
      );
      
      // Detect anomalies
      const anomalies = await this.anomalyDetector.detectAnomalies(tentacleId, telemetryHistory);
      
      // Process anomalies
      for (const anomaly of anomalies) {
        if (anomaly.score >= this.alertThresholds.anomalyScore) {
          // Create security incident
          await this._createSecurityIncident(tentacleId, {
            type: 'anomaly',
            severity: anomaly.score >= 0.9 ? 'high' : anomaly.score >= 0.8 ? 'medium' : 'low',
            description: anomaly.description,
            details: anomaly,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Update tentacle information
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      if (tentacle) {
        tentacle.lastAnomalyDetection = new Date().toISOString();
        tentacle.anomalyCount = (tentacle.anomalyCount || 0) + anomalies.length;
        await this._saveTentacleInfo(tentacleId, tentacle);
      }
      
      // Emit event
      this.events.emit('anomalies:detected', { tentacleId, anomalies });
      
      return anomalies;
    } catch (error) {
      this.logger.error(`Failed to detect anomalies for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Scan for vulnerabilities in a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @returns {Promise<Array<Object>>} - Promise resolving to array of vulnerabilities
   * @private
   */
  async _scanForVulnerabilities(tentacleId) {
    this.logger.info(`Scanning for vulnerabilities in tentacle: ${tentacleId}`);
    
    try {
      // Mock vulnerability scan
      // In a real implementation, this would download the tentacle package and scan it
      
      const vulnerabilities = [];
      
      // 20% chance of finding a vulnerability
      if (Math.random() < 0.2) {
        const severity = ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)];
        
        vulnerabilities.push({
          id: `vuln_${crypto.randomBytes(8).toString('hex')}`,
          tentacleId,
          type: 'security_vulnerability',
          name: 'Mock Vulnerability',
          description: 'This is a mock vulnerability for demonstration purposes',
          severity,
          cve: `CVE-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Process vulnerabilities
      for (const vulnerability of vulnerabilities) {
        const severityIndex = ['low', 'medium', 'high', 'critical'].indexOf(vulnerability.severity);
        const thresholdIndex = ['low', 'medium', 'high', 'critical'].indexOf(this.alertThresholds.vulnerabilitySeverity);
        
        if (severityIndex >= thresholdIndex) {
          // Create security incident
          await this._createSecurityIncident(tentacleId, {
            type: 'vulnerability',
            severity: vulnerability.severity,
            description: `Vulnerability detected: ${vulnerability.name}`,
            details: vulnerability,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Update tentacle information
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      if (tentacle) {
        tentacle.lastVulnerabilityScan = new Date().toISOString();
        tentacle.vulnerabilityCount = (tentacle.vulnerabilityCount || 0) + vulnerabilities.length;
        await this._saveTentacleInfo(tentacleId, tentacle);
      }
      
      // Emit event
      this.events.emit('vulnerabilities:detected', { tentacleId, vulnerabilities });
      
      return vulnerabilities;
    } catch (error) {
      this.logger.error(`Failed to scan for vulnerabilities in tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Create a security incident
   * @param {string} tentacleId - Tentacle ID
   * @param {Object} incident - Incident information
   * @returns {Promise<Object>} - Promise resolving to the created incident
   * @private
   */
  async _createSecurityIncident(tentacleId, incident) {
    this.logger.info(`Creating security incident for tentacle: ${tentacleId}`);
    
    try {
      // Generate incident ID
      const incidentId = `incident_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create incident object
      const securityIncident = {
        id: incidentId,
        tentacleId,
        ...incident,
        status: 'open',
        createdAt: new Date().toISOString()
      };
      
      // Store incident
      this.securityIncidents.set(incidentId, securityIncident);
      
      // Save incident to file
      const incidentPath = path.join(this.storagePath, 'incidents', `${incidentId}.json`);
      await fs.writeFile(incidentPath, JSON.stringify(securityIncident, null, 2));
      
      // Create alert
      const alert = await this.alertManager.createAlert({
        title: `Security incident detected for tentacle: ${tentacleId}`,
        description: incident.description,
        severity: incident.severity,
        source: 'SecurityMonitoringSystem',
        tentacleId,
        incidentId
      });
      
      // Update incident with alert ID
      securityIncident.alertId = alert.id;
      await fs.writeFile(incidentPath, JSON.stringify(securityIncident, null, 2));
      
      // Update tentacle information
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      if (tentacle) {
        tentacle.incidentCount = (tentacle.incidentCount || 0) + 1;
        
        // Check if incident count exceeds threshold
        if (tentacle.incidentCount >= this.alertThresholds.incidentCount) {
          // Escalate
          await this._escalateTentacle(tentacleId, 'Too many security incidents');
        }
        
        await this._saveTentacleInfo(tentacleId, tentacle);
      }
      
      // Emit event
      this.events.emit('incident:created', { tentacleId, incident: securityIncident });
      
      return securityIncident;
    } catch (error) {
      this.logger.error(`Failed to create security incident for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Escalate a tentacle
   * @param {string} tentacleId - Tentacle ID
   * @param {string} reason - Reason for escalation
   * @returns {Promise<Object>} - Promise resolving to the escalation result
   * @private
   */
  async _escalateTentacle(tentacleId, reason) {
    this.logger.info(`Escalating tentacle: ${tentacleId}, reason: ${reason}`);
    
    try {
      // Update tentacle status
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      if (!tentacle) {
        throw new Error(`Tentacle ${tentacleId} not found`);
      }
      
      // Create high-priority alert
      const alert = await this.alertManager.createAlert({
        title: `Tentacle escalated: ${tentacleId}`,
        description: reason,
        severity: 'critical',
        source: 'SecurityMonitoringSystem',
        tentacleId
      });
      
      // Update tentacle information
      tentacle.status = 'escalated';
      tentacle.escalatedAt = new Date().toISOString();
      tentacle.escalationReason = reason;
      tentacle.escalationAlertId = alert.id;
      
      await this._saveTentacleInfo(tentacleId, tentacle);
      
      // Emit event
      this.events.emit('tentacle:escalated', { tentacleId, reason });
      
      return {
        tentacleId,
        status: 'escalated',
        reason,
        alertId: alert.id,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to escalate tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Start monitoring a tentacle
   * @param {string} tentacleId - ID of the tentacle to monitor
   * @returns {Promise<Object>} - Promise resolving to the monitored tentacle
   */
  async startMonitoring(tentacleId) {
    if (!this.initialized) {
      throw new Error('SecurityMonitoringSystem not initialized');
    }
    
    this.logger.info(`Starting monitoring for tentacle: ${tentacleId}`);
    
    try {
      // Check if tentacle is already being monitored
      if (this.monitoredTentacles.has(tentacleId)) {
        const tentacle = this.monitoredTentacles.get(tentacleId);
        
        if (tentacle.status === 'monitoring') {
          this.logger.warn(`Tentacle ${tentacleId} is already being monitored`);
          return tentacle;
        }
        
        // Update tentacle status
        tentacle.status = 'monitoring';
        tentacle.startedAt = new Date().toISOString();
        
        // Save tentacle information
        await this._saveTentacleInfo(tentacleId, tentacle);
        
        // Start monitoring jobs
        await this._startMonitoringJobs(tentacleId);
        
        // Emit event
        this.events.emit('monitoring:started', { tentacleId });
        
        return tentacle;
      }
      
      // Create new tentacle monitoring entry
      const tentacle = {
        id: tentacleId,
        status: 'monitoring',
        startedAt: new Date().toISOString(),
        incidentCount: 0,
        anomalyCount: 0,
        vulnerabilityCount: 0
      };
      
      // Store tentacle
      this.monitoredTentacles.set(tentacleId, tentacle);
      
      // Save tentacle information
      await this._saveTentacleInfo(tentacleId, tentacle);
      
      // Start monitoring jobs
      await this._startMonitoringJobs(tentacleId);
      
      // Emit event
      this.events.emit('monitoring:started', { tentacleId });
      
      return tentacle;
    } catch (error) {
      this.logger.error(`Failed to start monitoring for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a tentacle
   * @param {string} tentacleId - ID of the tentacle to stop monitoring
   * @returns {Promise<Object>} - Promise resolving to the tentacle
   */
  async stopMonitoring(tentacleId) {
    if (!this.initialized) {
      throw new Error('SecurityMonitoringSystem not initialized');
    }
    
    this.logger.info(`Stopping monitoring for tentacle: ${tentacleId}`);
    
    try {
      // Check if tentacle is being monitored
      if (!this.monitoredTentacles.has(tentacleId)) {
        throw new Error(`Tentacle ${tentacleId} is not being monitored`);
      }
      
      const tentacle = this.monitoredTentacles.get(tentacleId);
      
      // Cancel monitoring jobs
      this._cancelMonitoringJobs(tentacleId);
      
      // Update tentacle status
      tentacle.status = 'stopped';
      tentacle.stoppedAt = new Date().toISOString();
      
      // Save tentacle information
      await this._saveTentacleInfo(tentacleId, tentacle);
      
      // Emit event
      this.events.emit('monitoring:stopped', { tentacleId });
      
      return tentacle;
    } catch (error) {
      this.logger.error(`Failed to stop monitoring for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Get monitoring status for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @returns {Promise<Object>} - Promise resolving to the monitoring status
   */
  async getMonitoringStatus(tentacleId) {
    if (!this.initialized) {
      throw new Error('SecurityMonitoringSystem not initialized');
    }
    
    // Check if tentacle is being monitored
    if (!this.monitoredTentacles.has(tentacleId)) {
      return {
        tentacleId,
        status: 'not_monitored'
      };
    }
    
    const tentacle = this.monitoredTentacles.get(tentacleId);
    
    return {
      tentacleId,
      status: tentacle.status,
      startedAt: tentacle.startedAt,
      stoppedAt: tentacle.stoppedAt,
      escalatedAt: tentacle.escalatedAt,
      incidentCount: tentacle.incidentCount || 0,
      anomalyCount: tentacle.anomalyCount || 0,
      vulnerabilityCount: tentacle.vulnerabilityCount || 0,
      lastTelemetryCollection: tentacle.lastTelemetryCollection,
      lastAnomalyDetection: tentacle.lastAnomalyDetection,
      lastVulnerabilityScan: tentacle.lastVulnerabilityScan
    };
  }

  /**
   * Get security incidents for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @returns {Promise<Array<Object>>} - Promise resolving to array of security incidents
   */
  async getSecurityIncidents(tentacleId) {
    if (!this.initialized) {
      throw new Error('SecurityMonitoringSystem not initialized');
    }
    
    const incidents = [];
    
    for (const incident of this.securityIncidents.values()) {
      if (incident.tentacleId === tentacleId) {
        incidents.push(incident);
      }
    }
    
    return incidents;
  }

  /**
   * Resolve a security incident
   * @param {string} incidentId - ID of the incident to resolve
   * @param {string} resolution - Resolution description
   * @returns {Promise<Object>} - Promise resolving to the resolved incident
   */
  async resolveSecurityIncident(incidentId, resolution) {
    if (!this.initialized) {
      throw new Error('SecurityMonitoringSystem not initialized');
    }
    
    this.logger.info(`Resolving security incident: ${incidentId}`);
    
    try {
      // Check if incident exists
      if (!this.securityIncidents.has(incidentId)) {
        throw new Error(`Security incident ${incidentId} not found`);
      }
      
      const incident = this.securityIncidents.get(incidentId);
      
      // Check if incident is already resolved
      if (incident.status === 'resolved') {
        this.logger.warn(`Security incident ${incidentId} is already resolved`);
        return incident;
      }
      
      // Update incident status
      incident.status = 'resolved';
      incident.resolvedAt = new Date().toISOString();
      incident.resolution = resolution;
      
      // Save incident to file
      const incidentPath = path.join(this.storagePath, 'incidents', `${incidentId}.json`);
      await fs.writeFile(incidentPath, JSON.stringify(incident, null, 2));
      
      // Close alert if exists
      if (incident.alertId) {
        await this.alertManager.closeAlert(incident.alertId, resolution);
      }
      
      // Emit event
      this.events.emit('incident:resolved', { incident });
      
      return incident;
    } catch (error) {
      this.logger.error(`Failed to resolve security incident: ${incidentId}`, error);
      throw error;
    }
  }

  /**
   * Get the status of the security monitoring system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      monitoredTentacles: this.monitoredTentacles.size,
      securityIncidents: this.securityIncidents.size,
      componentsStatus: {
        alertManager: this.alertManager ? 'available' : 'unavailable',
        telemetryCollector: this.telemetryCollector ? 'available' : 'unavailable',
        anomalyDetector: this.anomalyDetector ? 'available' : 'unavailable'
      }
    };
  }

  /**
   * Shutdown the security monitoring system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('SecurityMonitoringSystem not initialized');
      return true;
    }
    
    this.logger.info('Shutting down SecurityMonitoringSystem');
    
    // Stop monitoring for all tentacles
    for (const tentacleId of this.monitoredTentacles.keys()) {
      try {
        await this.stopMonitoring(tentacleId);
      } catch (error) {
        this.logger.error(`Failed to stop monitoring for tentacle: ${tentacleId}`, error);
      }
    }
    
    // Shutdown components
    if (this.alertManager && typeof this.alertManager.shutdown === 'function') {
      await this.alertManager.shutdown();
    }
    
    if (this.telemetryCollector && typeof this.telemetryCollector.shutdown === 'function') {
      await this.telemetryCollector.shutdown();
    }
    
    if (this.anomalyDetector && typeof this.anomalyDetector.shutdown === 'function') {
      await this.anomalyDetector.shutdown();
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { SecurityMonitoringSystem };
