/**
 * @fileoverview Tests for the Advanced Error Recovery system.
 * 
 * @module core/error/ErrorTests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');
const ErrorRecoveryManager = require('./ErrorRecoveryManager');

class ErrorTestSuite {
  constructor() {
    this.testDir = path.join(os.tmpdir(), 'aideon-error-test-' + Date.now());
    fs.mkdirSync(this.testDir, { recursive: true });
    
    this.tests = [
      this.testErrorTypeRegistration,
      this.testRecoveryStrategyRegistration,
      this.testErrorHandling,
      this.testRecoveryAttempt,
      this.testErrorLogging,
      this.testErrorQuerying,
      this.testPatternAnalysis,
      this.testEventSubscription,
      this.testErrorReporting,
      this.testConfigIntegration,
      this.testMetricsIntegration
    ];
    
    // Set up global error handler for tests
    this.errorHandler = (event) => {
      // This handler prevents "Unhandled error" failures in tests
      // console.log('Test caught error event:', event.id);
    };
  }
  
  async run() {
    console.log('Running Advanced Error Recovery Tests...');
    
    const results = {
      total: this.tests.length,
      passed: 0,
      failed: 0,
      details: []
    };
    
    for (const test of this.tests) {
      const testName = test.name;
      console.log(`Running test: ${testName}`);
      
      try {
        // Create a new error manager for each test to avoid cross-test interference
        const errorManager = test.call(this);
        
        // Register global error handler if the test creates an error manager
        if (errorManager && typeof errorManager.subscribeToErrors === 'function') {
          const unsubscribe = errorManager.subscribeToErrors(this.errorHandler);
          // Wait for any async operations to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          // Clean up
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          if (typeof errorManager.stop === 'function') {
            await errorManager.stop();
          }
        }
        
        results.passed++;
        results.details.push({
          name: testName,
          status: 'passed'
        });
        console.log(`✓ ${testName} passed`);
      } catch (error) {
        results.failed++;
        results.details.push({
          name: testName,
          status: 'failed',
          error: error.message
        });
        console.error(`✗ ${testName} failed: ${error.message}`);
      }
    }
    
    // Clean up test directory
    try {
      this.cleanupTestDir();
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
    
    // Calculate confidence interval
    const passRate = results.passed / results.total;
    const z = 1.96; // 95% confidence
    const interval = z * Math.sqrt((passRate * (1 - passRate)) / results.total);
    
    results.passRate = passRate * 100;
    results.confidenceInterval = interval * 100;
    
    console.log('\nTest Results:');
    console.log(`Total: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Pass Rate: ${results.passRate.toFixed(2)}%`);
    console.log(`Confidence Interval: ±${results.confidenceInterval.toFixed(2)}%`);
    
    return results;
  }
  
  cleanupTestDir() {
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };
    
    deleteRecursive(this.testDir);
  }
  
  async testErrorTypeRegistration() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error1')
    });
    
    // Test valid error type registration
    assert.strictEqual(
      errorManager.registerErrorType('test.error', {
        description: 'Test error type',
        severity: 'medium'
      }),
      true,
      'Should return true for valid error type registration'
    );
    
    // Test error type registration with missing type
    assert.throws(
      () => errorManager.registerErrorType(null, {
        description: 'Test error type',
        severity: 'medium'
      }),
      /Error type is required/,
      'Should throw error for missing error type'
    );
    
    // Test error type registration with missing options
    assert.throws(
      () => errorManager.registerErrorType('test.error', null),
      /Error description and severity are required/,
      'Should throw error for missing options'
    );
    
    // Test error type registration with invalid severity
    assert.throws(
      () => errorManager.registerErrorType('test.error', {
        description: 'Test error type',
        severity: 'invalid'
      }),
      /Invalid severity level/,
      'Should throw error for invalid severity'
    );
    
    // Test error type exists in registry
    assert.strictEqual(
      errorManager.errorRegistry['test.error'].description,
      'Test error type',
      'Error type should be stored in registry'
    );
    
    return errorManager;
  }
  
  async testRecoveryStrategyRegistration() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error2')
    });
    
    // Register error type
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    // Test valid recovery strategy registration
    assert.strictEqual(
      errorManager.registerRecoveryStrategy('test.error', {
        name: 'test.strategy',
        description: 'Test recovery strategy',
        action: async () => ({ success: true })
      }),
      true,
      'Should return true for valid recovery strategy registration'
    );
    
    // Test recovery strategy registration with missing error type
    assert.throws(
      () => errorManager.registerRecoveryStrategy(null, {
        name: 'test.strategy',
        description: 'Test recovery strategy',
        action: async () => ({ success: true })
      }),
      /Error type is required/,
      'Should throw error for missing error type'
    );
    
    // Test recovery strategy registration with missing options
    assert.throws(
      () => errorManager.registerRecoveryStrategy('test.error', null),
      /Strategy name, description, and action are required/,
      'Should throw error for missing options'
    );
    
    // Test recovery strategy registration with invalid action
    assert.throws(
      () => errorManager.registerRecoveryStrategy('test.error', {
        name: 'test.strategy',
        description: 'Test recovery strategy',
        action: 'not a function'
      }),
      /Strategy action must be a function/,
      'Should throw error for invalid action'
    );
    
    // Test strategy exists in registry
    assert.strictEqual(
      errorManager.recoveryStrategies['test.error'][0].name,
      'test.strategy',
      'Recovery strategy should be stored in registry'
    );
    
    // Test strategy priority sorting
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'high.priority',
      description: 'High priority strategy',
      action: async () => ({ success: true }),
      priority: 10
    });
    
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'low.priority',
      description: 'Low priority strategy',
      action: async () => ({ success: true }),
      priority: 1
    });
    
    assert.strictEqual(
      errorManager.recoveryStrategies['test.error'][0].name,
      'high.priority',
      'Strategies should be sorted by priority (descending)'
    );
    
    return errorManager;
  }
  
  async testErrorHandling() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error3'),
      enableAutoRecovery: false
    });
    
    // Register error type
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    // Test error handling
    const result = await errorManager.handleError({
      error: new Error('Test error message'),
      type: 'test.error',
      component: 'test.component',
      context: {
        testKey: 'testValue'
      }
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert.strictEqual(
      result.status,
      'detected',
      'Error status should be "detected"'
    );
    
    assert.strictEqual(
      result.recoveryAttempted,
      false,
      'Recovery should not be attempted when auto-recovery is disabled'
    );
    
    // Test error is in active errors
    const errorId = result.errorId;
    const errorInfo = errorManager.getErrorInfo(errorId);
    
    assert.strictEqual(
      errorInfo.type,
      'test.error',
      'Error type should be stored correctly'
    );
    
    assert.strictEqual(
      errorInfo.component,
      'test.component',
      'Error component should be stored correctly'
    );
    
    assert.strictEqual(
      errorInfo.error.message,
      'Test error message',
      'Error message should be stored correctly'
    );
    
    // Test error is in error history
    const history = errorManager.getErrorHistory();
    
    assert.strictEqual(
      history.length > 0,
      true,
      'Error should be added to history'
    );
    
    assert.strictEqual(
      history[0].type,
      'test.error',
      'Error type should be in history'
    );
    
    await errorManager.stop();
  }
  
  async testRecoveryAttempt() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error4'),
      enableAutoRecovery: false
    });
    
    // Register error type
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    // Register recovery strategies
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'failing.strategy',
      description: 'Strategy that fails',
      action: async () => {
        throw new Error('Strategy failure');
      },
      priority: 10
    });
    
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'successful.strategy',
      description: 'Strategy that succeeds',
      action: async () => ({ success: true, data: 'recovered' }),
      priority: 5
    });
    
    // Handle error
    const handleResult = await errorManager.handleError({
      error: new Error('Test error message'),
      type: 'test.error',
      component: 'test.component'
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Attempt recovery manually
    const recoveryResult = await errorManager.attemptRecovery(handleResult.errorId);
    
    assert.strictEqual(
      recoveryResult.status,
      'recovered',
      'Recovery status should be "recovered"'
    );
    
    assert.strictEqual(
      recoveryResult.strategy,
      'successful.strategy',
      'Successful strategy should be used'
    );
    
    assert.strictEqual(
      recoveryResult.attempts,
      1,
      'Should record recovery attempt count'
    );
    
    // Test error with no recovery strategies
    errorManager.registerErrorType('no.recovery', {
      description: 'Error with no recovery',
      severity: 'low'
    });
    
    const noRecoveryResult = await errorManager.handleError({
      error: new Error('No recovery error'),
      type: 'no.recovery',
      component: 'test.component'
    });
    
    const noStrategyResult = await errorManager.attemptRecovery(noRecoveryResult.errorId);
    
    assert.strictEqual(
      noStrategyResult.status,
      'no_recovery_strategy',
      'Should report no recovery strategy available'
    );
    
    await errorManager.stop();
  }
  
  async testErrorLogging() {
    const errorLogDir = path.join(this.testDir, 'error5');
    
    const errorManager = new ErrorRecoveryManager({
      errorLogDir,
      enableAutoRecovery: false
    });
    
    // Register error type
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    // Handle error
    await errorManager.handleError({
      error: new Error('Test error message'),
      type: 'test.error',
      component: 'test.component'
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if log file was created
    const files = fs.readdirSync(errorLogDir);
    
    assert.strictEqual(
      files.length > 0,
      true,
      'Error log file should be created'
    );
    
    // Check log file content
    const logFile = path.join(errorLogDir, files[0]);
    const logContent = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    
    assert.strictEqual(
      logContent.type,
      'test.error',
      'Log should contain error type'
    );
    
    assert.strictEqual(
      logContent.message,
      'Test error message',
      'Log should contain error message'
    );
    
    assert.strictEqual(
      logContent.component,
      'test.component',
      'Log should contain component'
    );
    
    // Test cleanup
    const deletedCount = await errorManager.cleanupErrorLogs();
    
    assert.strictEqual(
      deletedCount,
      0,
      'No files should be deleted (all are recent)'
    );
    
    await errorManager.stop();
  }
  
  async testErrorQuerying() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error6'),
      enableAutoRecovery: false
    });
    
    // Register error types
    errorManager.registerErrorType('error.type1', {
      description: 'Error type 1',
      severity: 'low'
    });
    
    errorManager.registerErrorType('error.type2', {
      description: 'Error type 2',
      severity: 'medium'
    });
    
    errorManager.registerErrorType('error.type3', {
      description: 'Error type 3',
      severity: 'high'
    });
    
    // Handle multiple errors
    await errorManager.handleError({
      error: new Error('Error 1'),
      type: 'error.type1',
      component: 'component1'
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await errorManager.handleError({
      error: new Error('Error 2'),
      type: 'error.type2',
      component: 'component1'
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await errorManager.handleError({
      error: new Error('Error 3'),
      type: 'error.type3',
      component: 'component2'
    });
    
    // Prevent test from continuing until error event is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test getActiveErrors with no filters
    const allErrors = errorManager.getActiveErrors();
    
    assert.strictEqual(
      allErrors.length,
      3,
      'Should return all active errors'
    );
    
    // Test getActiveErrors with type filter
    const type2Errors = errorManager.getActiveErrors({ type: 'error.type2' });
    
    assert.strictEqual(
      type2Errors.length,
      1,
      'Should filter errors by type'
    );
    
    assert.strictEqual(
      type2Errors[0].error.message,
      'Error 2',
      'Should return correct filtered error'
    );
    
    // Test getActiveErrors with component filter
    const component1Errors = errorManager.getActiveErrors({ component: 'component1' });
    
    assert.strictEqual(
      component1Errors.length,
      2,
      'Should filter errors by component'
    );
    
    // Test getErrorHistory
    const history = errorManager.getErrorHistory({ limit: 2 });
    
    assert.strictEqual(
      history.length,
      2,
      'Should respect limit parameter'
    );
    
    assert.strictEqual(
      history[0].type,
      'error.type3',
      'History should be sorted by timestamp (descending)'
    );
    
    await errorManager.stop();
  }
  
  async testPatternAnalysis() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error7'),
      enableAutoRecovery: false
    });
    
    // Register error types
    errorManager.registerErrorType('error.type1', {
      description: 'Error type 1',
      severity: 'low'
    });
    
    errorManager.registerErrorType('error.type2', {
      description: 'Error type 2',
      severity: 'medium'
    });
    
    // Create pattern of recurring errors
    for (let i = 0; i < 5; i++) {
      await errorManager.handleError({
        error: new Error(`Error ${i}`),
        type: 'error.type1',
        component: 'component1'
      });
      // Prevent test from continuing until error event is processed
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    for (let i = 0; i < 3; i++) {
      await errorManager.handleError({
        error: new Error(`Error ${i}`),
        type: 'error.type2',
        component: 'component2'
      });
      // Prevent test from continuing until error event is processed
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Test pattern analysis
    const patterns = errorManager.analyzeErrorPatterns();
    
    assert.strictEqual(
      patterns.length > 0,
      true,
      'Should identify error patterns'
    );
    
    // Find frequent error type pattern
    const frequentTypePattern = patterns.find(p => p.type === 'frequent_error_type' && p.errorType === 'error.type1');
    
    assert.strictEqual(
      frequentTypePattern !== undefined,
      true,
      'Should identify frequent error type'
    );
    
    assert.strictEqual(
      frequentTypePattern.count,
      5,
      'Should count occurrences correctly'
    );
    
    // Find problematic component pattern
    const problematicComponentPattern = patterns.find(p => p.type === 'problematic_component' && p.component === 'component1');
    
    assert.strictEqual(
      problematicComponentPattern !== undefined,
      true,
      'Should identify problematic component'
    );
    
    // Test error report generation
    const report = errorManager.generateErrorReport();
    
    assert.strictEqual(
      report.summary.totalErrors,
      8,
      'Report should include correct error count'
    );
    
    assert.strictEqual(
      report.recommendations.length > 0,
      true,
      'Report should include recommendations'
    );
    
    await errorManager.stop();
  }
  
  async testEventSubscription() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error8'),
      enableAutoRecovery: false
    });
    
    // Register error type and recovery strategy
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'test.strategy',
      description: 'Test strategy',
      action: async () => ({ success: true })
    });
    
    // Set up event subscriptions
    let errorEvent = null;
    const errorUnsubscribe = errorManager.subscribeToErrors((event) => {
      errorEvent = event;
    });
    
    let successEvent = null;
    const successUnsubscribe = errorManager.subscribeToRecoverySuccess((event) => {
      successEvent = event;
    });
    
    let failureEvent = null;
    const failureUnsubscribe = errorManager.subscribeToRecoveryFailure((event) => {
      failureEvent = event;
    });
    
    // Handle error
    const handleResult = await errorManager.handleError({
      error: new Error('Test error'),
      type: 'test.error',
      component: 'test.component'
    });
    
    // Verify error event
    assert.strictEqual(
      errorEvent !== null,
      true,
      'Error event should be emitted'
    );
    
    assert.strictEqual(
      errorEvent.type,
      'test.error',
      'Error event should contain error type'
    );
    
    // Attempt recovery
    await errorManager.attemptRecovery(handleResult.errorId);
    
    // Verify success event
    assert.strictEqual(
      successEvent !== null,
      true,
      'Recovery success event should be emitted'
    );
    
    assert.strictEqual(
      successEvent.strategy,
      'test.strategy',
      'Success event should contain strategy name'
    );
    
    // Test unsubscribe
    errorEvent = null;
    errorUnsubscribe();
    
    await errorManager.handleError({
      error: new Error('Another error'),
      type: 'test.error',
      component: 'test.component'
    });
    
    assert.strictEqual(
      errorEvent,
      null,
      'No event should be received after unsubscribe'
    );
    
    // Test failure event
    errorManager.registerErrorType('failing.error', {
      description: 'Failing error type',
      severity: 'high'
    });
    
    // No recovery strategy for this error type
    const failingResult = await errorManager.handleError({
      error: new Error('Failing error'),
      type: 'failing.error',
      component: 'test.component'
    });
    
    // Mock maxRecoveryAttempts to force failure
    errorManager.activeErrors[failingResult.errorId].recoveryAttempts = 3;
    
    await errorManager.attemptRecovery(failingResult.errorId);
    
    assert.strictEqual(
      failureEvent !== null,
      true,
      'Recovery failure event should be emitted'
    );
    
    successUnsubscribe();
    failureUnsubscribe();
    
    await errorManager.stop();
  }
  
  async testErrorReporting() {
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error9'),
      enableAutoRecovery: false
    });
    
    // Register error types
    errorManager.registerErrorType('error.type1', {
      description: 'Error type 1',
      severity: 'low'
    });
    
    errorManager.registerErrorType('error.type2', {
      description: 'Error type 2',
      severity: 'high'
    });
    
    // Create some errors
    for (let i = 0; i < 3; i++) {
      await errorManager.handleError({
        error: new Error(`Error ${i}`),
        type: 'error.type1',
        component: 'component1'
      });
    }
    
    for (let i = 0; i < 2; i++) {
      await errorManager.handleError({
        error: new Error(`Critical error ${i}`),
        type: 'error.type2',
        component: 'component2'
      });
    }
    
    // Test report generation
    const report = errorManager.generateErrorReport({
      includeDetails: true
    });
    
    assert.strictEqual(
      report.summary.totalErrors,
      5,
      'Report should include all errors'
    );
    
    assert.strictEqual(
      report.distribution.byType['error.type1'],
      3,
      'Report should count errors by type'
    );
    
    assert.strictEqual(
      report.distribution.byComponent['component1'],
      3,
      'Report should count errors by component'
    );
    
    assert.strictEqual(
      report.distribution.bySeverity['high'],
      2,
      'Report should count errors by severity'
    );
    
    assert.strictEqual(
      report.details.errors.length,
      5,
      'Report should include error details'
    );
    
    // Test report without details
    const summaryReport = errorManager.generateErrorReport({
      includeDetails: false
    });
    
    assert.strictEqual(
      summaryReport.details,
      undefined,
      'Report should not include details when not requested'
    );
    
    await errorManager.stop();
  }
  
  async testConfigIntegration() {
    // Create mock config manager
    const mockConfig = {
      configs: {
        errorRecovery: {
          enableAutoRecovery: true,
          maxRecoveryAttempts: 3,
          recoveryTimeout: 5000,
          errorLogRetention: 7,
          notifyUserOnCritical: true,
          detailedErrorReporting: true
        }
      },
      schemas: {},
      events: new EventEmitter(),
      
      defineConfigSchema(namespace, schema) {
        this.schemas[namespace] = schema;
        return true;
      },
      
      loadConfig(namespace) {
        return this.configs[namespace];
      },
      
      get(namespace, key) {
        if (!key) {
          return this.configs[namespace];
        }
        return this.configs[namespace][key];
      },
      
      subscribeToChanges(callback, namespace) {
        const handler = (event) => {
          if (!namespace || event.namespace === namespace) {
            callback(event);
          }
        };
        
        this.events.on('configChanged', handler);
        
        return () => {
          this.events.off('configChanged', handler);
        };
      },
      
      registerContextProvider() {
        return true;
      },
      
      defineContextOverride() {
        return true;
      }
    };
    
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error10'),
      configManager: mockConfig
    });
    
    // Verify config schema was defined
    assert.strictEqual(
      mockConfig.schemas.errorRecovery !== undefined,
      true,
      'Error recovery config schema should be defined'
    );
    
    // Test config value retrieval
    assert.strictEqual(
      errorManager.options.enableAutoRecovery,
      true,
      'Should use config value for enableAutoRecovery'
    );
    
    // Test config change handling
    mockConfig.configs.errorRecovery.enableAutoRecovery = false;
    
    // Simulate config change event
    mockConfig.events.emit('configChanged', {
      namespace: 'errorRecovery',
      changes: {
        enableAutoRecovery: {
          oldValue: true,
          newValue: false
        }
      },
      config: mockConfig.configs.errorRecovery
    });
    
    assert.strictEqual(
      errorManager.options.enableAutoRecovery,
      false,
      'Should update option when config changes'
    );
    
    await errorManager.stop();
  }
  
  async testMetricsIntegration() {
    // Create mock metrics collector
    const mockMetrics = {
      recordedMetrics: [],
      definedMetrics: [],
      definedDimensions: [],
      
      defineMetric(name, type, description, options) {
        this.definedMetrics.push({ name, type, description, options });
        return true;
      },
      
      defineDimension(name, description, allowedValues) {
        this.definedDimensions.push({ name, description, allowedValues });
        return true;
      },
      
      recordMetric(name, value, dimensions) {
        this.recordedMetrics.push({ name, value, dimensions });
        return true;
      }
    };
    
    const errorManager = new ErrorRecoveryManager({
      errorLogDir: path.join(this.testDir, 'error11'),
      metricsCollector: mockMetrics,
      enableAutoRecovery: false
    });
    
    // Verify metrics were defined
    assert.strictEqual(
      mockMetrics.definedMetrics.length > 0,
      true,
      'Error metrics should be defined'
    );
    
    assert.strictEqual(
      mockMetrics.definedDimensions.length > 0,
      true,
      'Error dimensions should be defined'
    );
    
    // Register error type and recovery strategy
    errorManager.registerErrorType('test.error', {
      description: 'Test error type',
      severity: 'medium'
    });
    
    errorManager.registerRecoveryStrategy('test.error', {
      name: 'test.strategy',
      description: 'Test strategy',
      action: async () => ({ success: true })
    });
    
    // Handle error and verify metric recording
    const handleResult = await errorManager.handleError({
      error: new Error('Test error'),
      type: 'test.error',
      component: 'test.component'
    });
    
    const errorMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'error.occurrence'
    );
    
    assert.strictEqual(
      errorMetric !== undefined,
      true,
      'Error occurrence metric should be recorded'
    );
    
    assert.strictEqual(
      errorMetric.dimensions['error.type'],
      'test.error',
      'Error metric should have correct type dimension'
    );
    
    // Clear recorded metrics
    mockMetrics.recordedMetrics = [];
    
    // Attempt recovery and verify metrics
    await errorManager.attemptRecovery(handleResult.errorId);
    
    const attemptMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'error.recovery.attempt'
    );
    
    assert.strictEqual(
      attemptMetric !== undefined,
      true,
      'Recovery attempt metric should be recorded'
    );
    
    const successMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'error.recovery.success'
    );
    
    assert.strictEqual(
      successMetric !== undefined,
      true,
      'Recovery success metric should be recorded'
    );
    
    assert.strictEqual(
      successMetric.dimensions['error.recovery.strategy'],
      'test.strategy',
      'Success metric should have correct strategy dimension'
    );
    
    const timeMetric = mockMetrics.recordedMetrics.find(
      m => m.name === 'error.recovery.time'
    );
    
    assert.strictEqual(
      timeMetric !== undefined,
      true,
      'Recovery time metric should be recorded'
    );
    
    await errorManager.stop();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new ErrorTestSuite();
  testSuite.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = ErrorTestSuite;
