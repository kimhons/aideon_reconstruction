/**
 * Testing Tentacle for the Aideon AI Desktop Agent
 * 
 * Provides comprehensive testing capabilities for AI model robustness
 * and enterprise-grade security and compliance validation.
 * 
 * @module tentacles/testing/TestingTentacle
 */

const EventEmitter = require('events');

// Import core services
const ConfigurationService = require('./core/ConfigurationService');
const TestRegistry = require('./core/TestRegistry');
const TestExecutionEngine = require('./core/TestExecutionEngine');
const ResultCollectionSystem = require('./core/ResultCollectionSystem');
const ReportingFramework = require('./core/ReportingFramework');

// Import subsystems
const ModelRobustnessTesting = require('./model/ModelRobustnessTesting');
const EnterpriseTesting = require('./enterprise/EnterpriseTesting');

/**
 * TestingTentacle class provides comprehensive testing capabilities
 * for AI model robustness and enterprise-grade security validation.
 */
class TestingTentacle extends EventEmitter {
  /**
   * Create a new TestingTentacle instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.configService - Configuration service (optional)
   * @param {Object} options.eventBus - Event bus for system-wide events
   * @param {Object} options.securityManager - Security manager for access control
   * @param {Object} options.modelRegistry - Model registry for accessing AI models
   * @param {Object} options.resilienceTentacle - Resilience tentacle for data integrity
   */
  constructor(options = {}) {
    super();
    
    this.initialized = false;
    this.logger = options.logger || console;
    this.eventBus = options.eventBus;
    this.securityManager = options.securityManager;
    this.modelRegistry = options.modelRegistry;
    this.resilienceTentacle = options.resilienceTentacle;
    
    // Initialize configuration
    this.configService = options.configService || new ConfigurationService({
      logger: this.logger,
      configPath: options.configPath || 'testing',
    });
    
    // Initialize core components
    this.testRegistry = null;
    this.testExecutionEngine = null;
    this.resultCollectionSystem = null;
    this.reportingFramework = null;
    
    // Initialize subsystems
    this.modelRobustnessTesting = null;
    this.enterpriseTesting = null;
    
    this.logger.info('TestingTentacle created');
  }
  
  /**
   * Initialize the TestingTentacle and all its components
   * 
   * @returns {Promise<void>} - Resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('TestingTentacle already initialized');
      return;
    }
    
    this.logger.info('Initializing TestingTentacle');
    
    try {
      // Initialize configuration service
      await this.configService.initialize();
      const config = this.configService.getConfig();
      
      // Initialize core components
      this.testRegistry = new TestRegistry({
        logger: this.logger,
        configService: this.configService,
        securityManager: this.securityManager,
      });
      
      this.testExecutionEngine = new TestExecutionEngine({
        logger: this.logger,
        configService: this.configService,
        testRegistry: this.testRegistry,
        securityManager: this.securityManager,
      });
      
      this.resultCollectionSystem = new ResultCollectionSystem({
        logger: this.logger,
        configService: this.configService,
        securityManager: this.securityManager,
        resilienceTentacle: this.resilienceTentacle,
      });
      
      this.reportingFramework = new ReportingFramework({
        logger: this.logger,
        configService: this.configService,
        resultCollectionSystem: this.resultCollectionSystem,
        securityManager: this.securityManager,
      });
      
      // Initialize core components
      await this.testRegistry.initialize();
      await this.testExecutionEngine.initialize();
      await this.resultCollectionSystem.initialize();
      await this.reportingFramework.initialize();
      
      // Initialize subsystems based on configuration
      if (config.modelRobustnessTesting?.enabled !== false) {
        this.modelRobustnessTesting = new ModelRobustnessTesting({
          logger: this.logger,
          configService: this.configService,
          testRegistry: this.testRegistry,
          testExecutionEngine: this.testExecutionEngine,
          resultCollectionSystem: this.resultCollectionSystem,
          reportingFramework: this.reportingFramework,
          modelRegistry: this.modelRegistry,
          securityManager: this.securityManager,
          eventBus: this.eventBus,
        });
        
        await this.modelRobustnessTesting.initialize();
      }
      
      if (config.enterpriseTesting?.enabled !== false) {
        this.enterpriseTesting = new EnterpriseTesting({
          logger: this.logger,
          configService: this.configService,
          testRegistry: this.testRegistry,
          testExecutionEngine: this.testExecutionEngine,
          resultCollectionSystem: this.resultCollectionSystem,
          reportingFramework: this.reportingFramework,
          securityManager: this.securityManager,
          eventBus: this.eventBus,
        });
        
        await this.enterpriseTesting.initialize();
      }
      
      // Register event handlers
      this._registerEventHandlers();
      
      this.initialized = true;
      this.logger.info('TestingTentacle initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize TestingTentacle', error);
      throw error;
    }
  }
  
  /**
   * Register event handlers for system-wide events
   * 
   * @private
   */
  _registerEventHandlers() {
    if (this.eventBus) {
      // Model-related events
      this.eventBus.subscribe('model:registered', this._handleModelRegistered.bind(this));
      this.eventBus.subscribe('model:updated', this._handleModelUpdated.bind(this));
      this.eventBus.subscribe('model:unregistered', this._handleModelUnregistered.bind(this));
      
      // Security-related events
      this.eventBus.subscribe('security:policy:updated', this._handleSecurityPolicyUpdated.bind(this));
      this.eventBus.subscribe('security:incident', this._handleSecurityIncident.bind(this));
      
      // System-wide events
      this.eventBus.subscribe('system:config:updated', this._handleConfigUpdated.bind(this));
    }
  }
  
  /**
   * Handle model registered event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleModelRegistered(data) {
    if (this.modelRobustnessTesting && this.initialized) {
      this.logger.debug('Handling model:registered event', { modelId: data.modelId });
      await this.modelRobustnessTesting.handleModelRegistered(data);
    }
  }
  
  /**
   * Handle model updated event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleModelUpdated(data) {
    if (this.modelRobustnessTesting && this.initialized) {
      this.logger.debug('Handling model:updated event', { modelId: data.modelId });
      await this.modelRobustnessTesting.handleModelUpdated(data);
    }
  }
  
  /**
   * Handle model unregistered event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleModelUnregistered(data) {
    if (this.modelRobustnessTesting && this.initialized) {
      this.logger.debug('Handling model:unregistered event', { modelId: data.modelId });
      await this.modelRobustnessTesting.handleModelUnregistered(data);
    }
  }
  
  /**
   * Handle security policy updated event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleSecurityPolicyUpdated(data) {
    if (this.enterpriseTesting && this.initialized) {
      this.logger.debug('Handling security:policy:updated event', { policyId: data.policyId });
      await this.enterpriseTesting.handleSecurityPolicyUpdated(data);
    }
  }
  
  /**
   * Handle security incident event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleSecurityIncident(data) {
    if (this.enterpriseTesting && this.initialized) {
      this.logger.debug('Handling security:incident event', { incidentId: data.incidentId });
      await this.enterpriseTesting.handleSecurityIncident(data);
    }
  }
  
  /**
   * Handle configuration updated event
   * 
   * @private
   * @param {Object} data - Event data
   */
  async _handleConfigUpdated(data) {
    if (this.initialized && data.section === 'testing') {
      this.logger.debug('Handling system:config:updated event for testing section');
      await this.configService.reload();
      
      // Update components with new configuration
      const config = this.configService.getConfig();
      
      if (this.testRegistry) {
        await this.testRegistry.updateConfig(config);
      }
      
      if (this.testExecutionEngine) {
        await this.testExecutionEngine.updateConfig(config);
      }
      
      if (this.resultCollectionSystem) {
        await this.resultCollectionSystem.updateConfig(config);
      }
      
      if (this.reportingFramework) {
        await this.reportingFramework.updateConfig(config);
      }
      
      if (this.modelRobustnessTesting) {
        await this.modelRobustnessTesting.updateConfig(config);
      }
      
      if (this.enterpriseTesting) {
        await this.enterpriseTesting.updateConfig(config);
      }
    }
  }
  
  /**
   * Run a test suite
   * 
   * @param {Object} options - Test options
   * @param {string} options.suiteId - ID of the test suite to run
   * @param {Object} options.parameters - Test parameters
   * @param {boolean} options.async - Whether to run asynchronously
   * @returns {Promise<Object>} - Test results
   */
  async runTestSuite(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.info('Running test suite', { suiteId: options.suiteId });
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:run', {
          suiteId: options.suiteId,
          parameters: options.parameters,
        });
      }
      
      // Run the test suite
      const testRun = await this.testExecutionEngine.runTestSuite({
        suiteId: options.suiteId,
        parameters: options.parameters,
        async: options.async,
      });
      
      if (!options.async) {
        // Collect and process results
        const results = await this.resultCollectionSystem.collectResults({
          runId: testRun.runId,
        });
        
        // Generate report
        const report = await this.reportingFramework.generateReport({
          runId: testRun.runId,
          results,
        });
        
        return {
          runId: testRun.runId,
          status: 'completed',
          results,
          report,
        };
      } else {
        return {
          runId: testRun.runId,
          status: 'running',
        };
      }
    } catch (error) {
      this.logger.error('Failed to run test suite', {
        suiteId: options.suiteId,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Get test suite status
   * 
   * @param {Object} options - Options
   * @param {string} options.runId - Test run ID
   * @returns {Promise<Object>} - Test run status
   */
  async getTestRunStatus(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.debug('Getting test run status', { runId: options.runId });
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:status', {
          runId: options.runId,
        });
      }
      
      // Get test run status
      const status = await this.testExecutionEngine.getTestRunStatus({
        runId: options.runId,
      });
      
      if (status.status === 'completed') {
        // Collect results if completed
        const results = await this.resultCollectionSystem.collectResults({
          runId: options.runId,
        });
        
        // Generate report
        const report = await this.reportingFramework.generateReport({
          runId: options.runId,
          results,
        });
        
        return {
          ...status,
          results,
          report,
        };
      }
      
      return status;
    } catch (error) {
      this.logger.error('Failed to get test run status', {
        runId: options.runId,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Register a test suite
   * 
   * @param {Object} options - Registration options
   * @param {string} options.name - Test suite name
   * @param {string} options.description - Test suite description
   * @param {string} options.type - Test suite type (model, enterprise)
   * @param {Array<Object>} options.testCases - Test cases
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} - Registered test suite
   */
  async registerTestSuite(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.info('Registering test suite', { name: options.name, type: options.type });
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:register', {
          type: options.type,
        });
      }
      
      // Register the test suite
      const suite = await this.testRegistry.registerTestSuite({
        name: options.name,
        description: options.description,
        type: options.type,
        testCases: options.testCases,
        metadata: options.metadata,
      });
      
      // Publish event
      if (this.eventBus) {
        this.eventBus.publish('testing:suite:registered', {
          suiteId: suite.id,
          name: suite.name,
          type: suite.type,
        });
      }
      
      return suite;
    } catch (error) {
      this.logger.error('Failed to register test suite', {
        name: options.name,
        type: options.type,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Get registered test suites
   * 
   * @param {Object} options - Query options
   * @param {string} options.type - Filter by test suite type
   * @param {Object} options.metadata - Filter by metadata
   * @returns {Promise<Array<Object>>} - Matching test suites
   */
  async getTestSuites(options = {}) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.debug('Getting test suites', options);
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:list', {});
      }
      
      // Get test suites
      return await this.testRegistry.getTestSuites(options);
    } catch (error) {
      this.logger.error('Failed to get test suites', {
        options,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Get test results
   * 
   * @param {Object} options - Query options
   * @param {string} options.runId - Filter by test run ID
   * @param {string} options.suiteId - Filter by test suite ID
   * @param {string} options.status - Filter by status
   * @param {Date} options.startDate - Filter by start date
   * @param {Date} options.endDate - Filter by end date
   * @returns {Promise<Array<Object>>} - Matching test results
   */
  async getTestResults(options = {}) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.debug('Getting test results', options);
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:results', {});
      }
      
      // Get test results
      return await this.resultCollectionSystem.getResults(options);
    } catch (error) {
      this.logger.error('Failed to get test results', {
        options,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Generate a report for test results
   * 
   * @param {Object} options - Report options
   * @param {string} options.runId - Test run ID
   * @param {string} options.format - Report format (html, pdf, json)
   * @param {boolean} options.detailed - Whether to include detailed results
   * @returns {Promise<Object>} - Generated report
   */
  async generateReport(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    this.logger.info('Generating report', { runId: options.runId, format: options.format });
    
    try {
      // Validate access
      if (this.securityManager) {
        await this.securityManager.checkPermission('testing:report', {
          runId: options.runId,
        });
      }
      
      // Get test results
      const results = await this.resultCollectionSystem.collectResults({
        runId: options.runId,
      });
      
      // Generate report
      return await this.reportingFramework.generateReport({
        runId: options.runId,
        results,
        format: options.format,
        detailed: options.detailed,
      });
    } catch (error) {
      this.logger.error('Failed to generate report', {
        runId: options.runId,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Run model robustness tests
   * 
   * @param {Object} options - Test options
   * @param {string} options.modelId - Model ID to test
   * @param {Array<string>} options.testTypes - Types of tests to run
   * @param {Object} options.parameters - Test parameters
   * @param {boolean} options.async - Whether to run asynchronously
   * @returns {Promise<Object>} - Test results
   */
  async runModelRobustnessTests(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    if (!this.modelRobustnessTesting) {
      throw new Error('Model robustness testing not enabled');
    }
    
    this.logger.info('Running model robustness tests', { 
      modelId: options.modelId,
      testTypes: options.testTypes,
    });
    
    try {
      return await this.modelRobustnessTesting.runTests(options);
    } catch (error) {
      this.logger.error('Failed to run model robustness tests', {
        modelId: options.modelId,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Run enterprise security tests
   * 
   * @param {Object} options - Test options
   * @param {Array<string>} options.testTypes - Types of tests to run
   * @param {Object} options.parameters - Test parameters
   * @param {boolean} options.async - Whether to run asynchronously
   * @returns {Promise<Object>} - Test results
   */
  async runEnterpriseSecurityTests(options) {
    if (!this.initialized) {
      throw new Error('TestingTentacle not initialized');
    }
    
    if (!this.enterpriseTesting) {
      throw new Error('Enterprise testing not enabled');
    }
    
    this.logger.info('Running enterprise security tests', { 
      testTypes: options.testTypes,
    });
    
    try {
      return await this.enterpriseTesting.runTests(options);
    } catch (error) {
      this.logger.error('Failed to run enterprise security tests', {
        testTypes: options.testTypes,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Shutdown the TestingTentacle and all its components
   * 
   * @returns {Promise<void>} - Resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('TestingTentacle not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down TestingTentacle');
    
    try {
      // Unregister event handlers
      if (this.eventBus) {
        this.eventBus.unsubscribe('model:registered', this._handleModelRegistered);
        this.eventBus.unsubscribe('model:updated', this._handleModelUpdated);
        this.eventBus.unsubscribe('model:unregistered', this._handleModelUnregistered);
        this.eventBus.unsubscribe('security:policy:updated', this._handleSecurityPolicyUpdated);
        this.eventBus.unsubscribe('security:incident', this._handleSecurityIncident);
        this.eventBus.unsubscribe('system:config:updated', this._handleConfigUpdated);
      }
      
      // Shutdown subsystems
      if (this.modelRobustnessTesting) {
        await this.modelRobustnessTesting.shutdown();
      }
      
      if (this.enterpriseTesting) {
        await this.enterpriseTesting.shutdown();
      }
      
      // Shutdown core components
      if (this.reportingFramework) {
        await this.reportingFramework.shutdown();
      }
      
      if (this.resultCollectionSystem) {
        await this.resultCollectionSystem.shutdown();
      }
      
      if (this.testExecutionEngine) {
        await this.testExecutionEngine.shutdown();
      }
      
      if (this.testRegistry) {
        await this.testRegistry.shutdown();
      }
      
      // Shutdown configuration service
      if (this.configService) {
        await this.configService.shutdown();
      }
      
      this.initialized = false;
      this.logger.info('TestingTentacle shut down successfully');
      this.emit('shutdown');
      
    } catch (error) {
      this.logger.error('Failed to shut down TestingTentacle', error);
      throw error;
    }
  }
  
  /**
   * Get the status of the TestingTentacle
   * 
   * @returns {Object} - Status information
   */
  getStatus() {
    const status = {
      initialized: this.initialized,
      components: {
        testRegistry: this.testRegistry ? this.testRegistry.getStatus() : null,
        testExecutionEngine: this.testExecutionEngine ? this.testExecutionEngine.getStatus() : null,
        resultCollectionSystem: this.resultCollectionSystem ? this.resultCollectionSystem.getStatus() : null,
        reportingFramework: this.reportingFramework ? this.reportingFramework.getStatus() : null,
      },
      subsystems: {
        modelRobustnessTesting: this.modelRobustnessTesting ? this.modelRobustnessTesting.getStatus() : null,
        enterpriseTesting: this.enterpriseTesting ? this.enterpriseTesting.getStatus() : null,
      },
    };
    
    return status;
  }
}

module.exports = TestingTentacle;
