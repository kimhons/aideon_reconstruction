/**
 * @fileoverview Metrics Integration for Enhanced Configuration System
 * 
 * The ConfigurationMetricsIntegration provides integration between the Enhanced
 * Configuration System and Aideon's metrics system, tracking configuration changes,
 * feature flag usage, and performance metrics.
 * 
 * This component is part of the Enhanced Configuration System designed
 * to improve Aideon's GAIA Score by enhancing reliability and adaptability.
 */

'use strict';

/**
 * Configuration Metrics Integration class
 * 
 * Provides integration between the Enhanced Configuration System and
 * Aideon's metrics system.
 */
class ConfigurationMetricsIntegration {
  /**
   * Creates a new ConfigurationMetricsIntegration instance
   * 
   * @param {Object} options - Integration options
   * @param {Object} options.configManager - Configuration manager instance
   * @param {Object} options.featureFlagManager - Feature flag manager instance
   * @param {Object} options.environmentManager - Environment manager instance
   * @param {Object} options.metricsCollector - Metrics collector instance
   */
  constructor(options = {}) {
    this.configManager = options.configManager;
    this.featureFlagManager = options.featureFlagManager;
    this.environmentManager = options.environmentManager;
    this.metricsCollector = options.metricsCollector;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.sampleRate = options.sampleRate || 1.0; // 1.0 = 100% sampling
    this.lastPerformanceReport = Date.now();
    this.performanceReportInterval = options.performanceReportInterval || 300000; // 5 minutes
    this.configChangeCount = 0;
    this.featureFlagEvaluationCount = 0;
    this.transactionCount = 0;
    this.errorCount = 0;
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start performance reporting
    this.startPerformanceReporting();
  }

  /**
   * Sets up event listeners for metrics collection
   * 
   * @private
   */
  setupEventListeners() {
    if (!this.enabled || !this.metricsCollector) {
      return;
    }
    
    // Configuration change events
    if (this.configManager && this.configManager.eventEmitter) {
      this.configManager.eventEmitter.on('configChange', (event) => {
        this.trackConfigChange(event);
      });
      
      this.configManager.eventEmitter.on('transaction', (event) => {
        this.trackTransaction(event);
      });
      
      this.configManager.eventEmitter.on('error', (event) => {
        this.trackError('configManager', event);
      });
    }
    
    // Feature flag events
    if (this.featureFlagManager && this.featureFlagManager.eventEmitter) {
      this.featureFlagManager.on('flagAdded', (event) => {
        this.trackFeatureFlagChange('added', event);
      });
      
      this.featureFlagManager.on('flagUpdated', (event) => {
        this.trackFeatureFlagChange('updated', event);
      });
      
      this.featureFlagManager.on('flagRemoved', (event) => {
        this.trackFeatureFlagChange('removed', event);
      });
      
      // Set up analytics callback for feature flag evaluations
      this.featureFlagManager.setAnalyticsCallback((data) => {
        this.trackFeatureFlagEvaluation(data);
      });
    }
    
    // Environment events
    if (this.environmentManager && this.environmentManager.eventEmitter) {
      this.environmentManager.on('environmentChange', (event) => {
        this.trackEnvironmentChange(event);
      });
      
      this.environmentManager.on('overrideSet', (event) => {
        this.trackEnvironmentOverride('set', event);
      });
      
      this.environmentManager.on('overrideRemoved', (event) => {
        this.trackEnvironmentOverride('removed', event);
      });
    }
  }

  /**
   * Tracks a configuration change
   * 
   * @param {Object} event - Change event
   * @private
   */
  trackConfigChange(event) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.configChangeCount++;
    
    this.metricsCollector.trackEvent('configuration.change', {
      path: event.path,
      timestamp: event.timestamp,
      source: event.source || 'api',
      transactionId: event.transaction || null
    });
    
    // Track in GAIA metrics
    this.metricsCollector.updateGAIAMetric('configuration.changes', this.configChangeCount);
    this.metricsCollector.updateGAIAMetric('configuration.last_change_time', event.timestamp);
  }

  /**
   * Tracks a transaction
   * 
   * @param {Object} event - Transaction event
   * @private
   */
  trackTransaction(event) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.transactionCount++;
    
    this.metricsCollector.trackEvent('configuration.transaction', {
      id: event.id,
      timestamp: event.timestamp,
      changeCount: event.changes ? event.changes.length : 0,
      metadata: event.metadata || {}
    });
    
    // Track in GAIA metrics
    this.metricsCollector.updateGAIAMetric('configuration.transactions', this.transactionCount);
  }

  /**
   * Tracks a feature flag change
   * 
   * @param {string} action - Change action
   * @param {Object} event - Change event
   * @private
   */
  trackFeatureFlagChange(action, event) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.metricsCollector.trackEvent('feature_flag.change', {
      action,
      key: event.key,
      timestamp: event.timestamp,
      enabled: event.flag ? event.flag.enabled : null,
      rolloutPercentage: event.flag ? event.flag.rolloutPercentage : null
    });
  }

  /**
   * Tracks a feature flag evaluation
   * 
   * @param {Object} data - Evaluation data
   * @private
   */
  trackFeatureFlagEvaluation(data) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.featureFlagEvaluationCount++;
    
    this.metricsCollector.trackEvent('feature_flag.evaluation', {
      key: data.key,
      enabled: data.enabled,
      timestamp: data.timestamp,
      userId: data.context && data.context.userId ? data.context.userId : 'anonymous',
      segments: data.context && data.context.segments ? data.context.segments : []
    });
    
    // Track in GAIA metrics
    this.metricsCollector.updateGAIAMetric('feature_flag.evaluations', this.featureFlagEvaluationCount);
    
    // Track feature usage
    if (data.enabled) {
      this.metricsCollector.trackFeatureUsage(data.key);
    }
  }

  /**
   * Tracks an environment change
   * 
   * @param {Object} event - Change event
   * @private
   */
  trackEnvironmentChange(event) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.metricsCollector.trackEvent('environment.change', {
      oldEnvironment: event.oldEnvironment,
      newEnvironment: event.newEnvironment,
      timestamp: event.timestamp
    });
    
    // Track in GAIA metrics
    this.metricsCollector.updateGAIAMetric('environment.current', event.newEnvironment);
    this.metricsCollector.updateGAIAMetric('environment.last_change_time', event.timestamp);
  }

  /**
   * Tracks an environment override
   * 
   * @param {string} action - Override action
   * @param {Object} event - Override event
   * @private
   */
  trackEnvironmentOverride(action, event) {
    if (!this.shouldSample() || !this.metricsCollector) {
      return;
    }
    
    this.metricsCollector.trackEvent('environment.override', {
      action,
      environment: event.environment,
      path: event.path,
      timestamp: event.timestamp
    });
  }

  /**
   * Tracks an error
   * 
   * @param {string} source - Error source
   * @param {Object} event - Error event
   * @private
   */
  trackError(source, event) {
    if (!this.metricsCollector) {
      return;
    }
    
    this.errorCount++;
    
    this.metricsCollector.trackEvent('configuration.error', {
      source,
      message: event.message || 'Unknown error',
      timestamp: event.timestamp || Date.now(),
      path: event.path || null,
      code: event.code || null
    });
    
    // Track in GAIA metrics
    this.metricsCollector.updateGAIAMetric('configuration.errors', this.errorCount);
  }

  /**
   * Reports performance metrics
   * 
   * @private
   */
  reportPerformanceMetrics() {
    if (!this.metricsCollector) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastReport = now - this.lastPerformanceReport;
    this.lastPerformanceReport = now;
    
    // Collect performance metrics
    const metrics = {
      configCount: this.configManager ? Object.keys(this.configManager.getAll()).length : 0,
      flagCount: this.featureFlagManager ? Object.keys(this.featureFlagManager.getAllFlags()).length : 0,
      configChangeRate: this.configChangeCount / (timeSinceLastReport / 1000),
      flagEvaluationRate: this.featureFlagEvaluationCount / (timeSinceLastReport / 1000),
      transactionRate: this.transactionCount / (timeSinceLastReport / 1000),
      errorRate: this.errorCount / (timeSinceLastReport / 1000),
      timestamp: now
    };
    
    // Track performance metrics
    this.metricsCollector.trackEvent('configuration.performance', metrics);
    
    // Update GAIA metrics
    this.metricsCollector.updateGAIAMetric('configuration.count', metrics.configCount);
    this.metricsCollector.updateGAIAMetric('feature_flag.count', metrics.flagCount);
    this.metricsCollector.updateGAIAMetric('configuration.change_rate', metrics.configChangeRate);
    this.metricsCollector.updateGAIAMetric('feature_flag.evaluation_rate', metrics.flagEvaluationRate);
    this.metricsCollector.updateGAIAMetric('configuration.transaction_rate', metrics.transactionRate);
    this.metricsCollector.updateGAIAMetric('configuration.error_rate', metrics.errorRate);
    
    // Reset counters
    this.configChangeCount = 0;
    this.featureFlagEvaluationCount = 0;
    this.transactionCount = 0;
    this.errorCount = 0;
  }

  /**
   * Starts performance reporting
   * 
   * @private
   */
  startPerformanceReporting() {
    if (!this.enabled || !this.metricsCollector) {
      return;
    }
    
    // Report initial metrics
    this.reportPerformanceMetrics();
    
    // Set up interval for reporting
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, this.performanceReportInterval);
  }

  /**
   * Determines whether to sample a metric
   * 
   * @returns {boolean} Whether to sample
   * @private
   */
  shouldSample() {
    if (!this.enabled) {
      return false;
    }
    
    if (this.sampleRate >= 1.0) {
      return true;
    }
    
    return Math.random() < this.sampleRate;
  }

  /**
   * Enables metrics collection
   * 
   * @returns {boolean} Success status
   */
  enable() {
    this.enabled = true;
    return true;
  }

  /**
   * Disables metrics collection
   * 
   * @returns {boolean} Success status
   */
  disable() {
    this.enabled = false;
    return true;
  }

  /**
   * Sets the sample rate
   * 
   * @param {number} rate - Sample rate (0.0 - 1.0)
   * @returns {boolean} Success status
   */
  setSampleRate(rate) {
    if (rate < 0.0 || rate > 1.0) {
      throw new Error('Sample rate must be between 0.0 and 1.0');
    }
    
    this.sampleRate = rate;
    return true;
  }

  /**
   * Gets metrics collection status
   * 
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.enabled,
      sampleRate: this.sampleRate,
      configChangeCount: this.configChangeCount,
      featureFlagEvaluationCount: this.featureFlagEvaluationCount,
      transactionCount: this.transactionCount,
      errorCount: this.errorCount,
      lastPerformanceReport: this.lastPerformanceReport,
      performanceReportInterval: this.performanceReportInterval
    };
  }

  /**
   * Calculates the GAIA Score impact
   * 
   * @returns {Object} GAIA Score impact
   */
  calculateGAIAScoreImpact() {
    if (!this.metricsCollector) {
      return {
        total: 0,
        reliability: 0,
        adaptability: 0,
        performance: 0,
        intelligence: 0
      };
    }
    
    // Get current metrics
    const configCount = this.configManager ? Object.keys(this.configManager.getAll()).length : 0;
    const flagCount = this.featureFlagManager ? Object.keys(this.featureFlagManager.getAllFlags()).length : 0;
    const errorRate = this.errorCount > 0 ? this.errorCount / (this.performanceReportInterval / 1000) : 0;
    
    // Calculate impact factors
    const reliabilityFactor = Math.min(0.01 * (1.0 - errorRate * 10), 0.01);
    const adaptabilityFactor = Math.min(0.008 * Math.log10(1 + flagCount), 0.008);
    const performanceFactor = Math.min(0.006 * (1.0 - (this.configChangeCount / 1000)), 0.006);
    const intelligenceFactor = Math.min(0.006 * Math.log10(1 + configCount), 0.006);
    
    // Calculate total impact
    const totalImpact = reliabilityFactor + adaptabilityFactor + performanceFactor + intelligenceFactor;
    
    return {
      total: totalImpact,
      reliability: reliabilityFactor,
      adaptability: adaptabilityFactor,
      performance: performanceFactor,
      intelligence: intelligenceFactor
    };
  }
}

module.exports = ConfigurationMetricsIntegration;
