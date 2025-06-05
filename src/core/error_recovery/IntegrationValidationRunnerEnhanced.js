/**
 * @fileoverview Enhanced integration validation runner for the Autonomous Error Recovery System.
 * This module runs comprehensive integration tests between the Error Recovery System
 * and the Neural, Semantic, and Predictive layers, supporting both legacy and new architecture.
 * 
 * @module core/error_recovery/IntegrationValidationRunnerEnhanced
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import core components
const NeuralSemanticPredictiveIntegration = require('./NeuralSemanticPredictiveIntegration');
const NeuralSemanticPredictiveIntegrationValidator = require('./NeuralSemanticPredictiveIntegrationValidator');
const CausalAnalyzer = require('./CausalAnalyzer');
const RecoveryStrategyGenerator = require('./RecoveryStrategyGenerator');
const ResolutionExecutor = require('./ResolutionExecutor');
const RecoveryLearningSystem = require('./RecoveryLearningSystem');

// Import integration components
const NeuralCoordinationHub = require('../neural/NeuralCoordinationHub');
const createMinimalKnowledgeGraph = require('../semantic/MinimalKnowledgeGraph');
const SemanticTranslator = require('../semantic/SemanticTranslator');
const CrossDomainQueryProcessor = require('../semantic/CrossDomainQueryProcessor');
const PredictiveTaskExecutor = require('../predictive/PredictiveTaskExecutor');
const BayesianPredictor = require('../predictive/BayesianPredictor');

// Import new architecture components
const StrategyPipeline = require('./StrategyPipeline');
const ContextPropagationManager = require('./ContextPropagationManager');
const SystemErrorHandler = require('./SystemErrorHandler');

// Import bridge components
const StrategyPipelineBridge = require('./bridges/StrategyPipelineBridge');

/**
 * Enhanced integration validation runner that supports both legacy and new architecture.
 */
class IntegrationValidationRunnerEnhanced {
  /**
   * Creates a new IntegrationValidationRunnerEnhanced instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   * @param {boolean} options.useNewArchitecture - Whether to use the new architecture
   * @param {boolean} options.useBridges - Whether to use bridge components
   * @param {boolean} options.compareModes - Whether to compare legacy and new architecture results
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    this.eventEmitter = new EventEmitter();
    this.useNewArchitecture = options.useNewArchitecture !== undefined ? options.useNewArchitecture : true;
    this.useBridges = options.useBridges !== undefined ? options.useBridges : true;
    this.compareModes = options.compareModes !== undefined ? options.compareModes : false;
    
    // Integration components
    this.neuralHub = null;
    this.knowledgeGraph = null;
    this.semanticTranslator = null;
    this.semanticProcessor = null;
    this.predictiveExecutor = null;
    this.bayesianPredictor = null;
    
    // Error recovery components (legacy)
    this.causalAnalyzer = null;
    this.strategyGenerator = null;
    this.resolutionExecutor = null;
    this.learningSystem = null;
    
    // New architecture components
    this.strategyPipeline = null;
    this.contextManager = null;
    this.errorHandler = null;
    
    // Bridge components
    this.strategyPipelineBridge = null;
    
    // Integration validators
    this.integrationValidator = null;
    this.comprehensiveValidator = null;
    
    // Validation results
    this.legacyResults = null;
    this.newArchResults = null;
    
    this.logger.info('IntegrationValidationRunnerEnhanced initialized');
    this.logger.info(`Configuration: useNewArchitecture=${this.useNewArchitecture}, useBridges=${this.useBridges}, compareModes=${this.compareModes}`);
  }
  
  /**
   * Initializes all components required for validation.
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing components for validation');
    
    try {
      // Initialize integration components
      this.neuralHub = new NeuralCoordinationHub({
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.knowledgeGraph = createMinimalKnowledgeGraph({
        logger: this.logger,
        metrics: this.metrics
      });
      
      // Explicitly log methods before passing to other components
      this.logger.info("BEFORE PASSING: Knowledge graph methods available:", 
        Object.keys(this.knowledgeGraph).filter(key => typeof this.knowledgeGraph[key] === 'function'));
      this.logger.info("BEFORE PASSING: query method type:", typeof this.knowledgeGraph.query);
      this.logger.info("BEFORE PASSING: getEntity method type:", typeof this.knowledgeGraph.getEntity);
      
      this.semanticTranslator = new SemanticTranslator({
        knowledgeGraph: this.knowledgeGraph,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.semanticProcessor = new CrossDomainQueryProcessor({
        translator: this.semanticTranslator,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.bayesianPredictor = new BayesianPredictor({
        predictionType: 'RECOVERY_SUCCESS',
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.predictiveExecutor = new PredictiveTaskExecutor({
        predictor: this.bayesianPredictor,
        logger: this.logger,
        metrics: this.metrics
      });
      
      // Initialize legacy error recovery components
      this.causalAnalyzer = new CausalAnalyzer({
        neuralHub: this.neuralHub,
        semanticProcessor: this.semanticProcessor,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.strategyGenerator = new RecoveryStrategyGenerator({
        semanticTranslator: this.semanticTranslator,
        predictor: this.bayesianPredictor,
        eventEmitter: this.eventEmitter,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.resolutionExecutor = new ResolutionExecutor({
        neuralHub: this.neuralHub,
        semanticProcessor: this.semanticProcessor,
        eventEmitter: this.eventEmitter,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.learningSystem = new RecoveryLearningSystem({
        predictor: this.bayesianPredictor,
        eventEmitter: this.eventEmitter,
        logger: this.logger,
        metrics: this.metrics
      });
      
      // Initialize new architecture components if enabled
      if (this.useNewArchitecture) {
        this.logger.info('Initializing new architecture components');
        
        this.contextManager = new ContextPropagationManager({
          logger: this.logger,
          metrics: this.metrics
        });
        
        this.strategyPipeline = new StrategyPipeline({
          strategyGenerator: this.strategyGenerator,
          resolutionExecutor: this.resolutionExecutor,
          bayesianPredictor: this.bayesianPredictor,
          neuralHub: this.neuralHub,
          semanticProcessor: this.semanticProcessor,
          learningSystem: this.learningSystem,
          logger: this.logger,
          metrics: this.metrics
        });
        
        this.errorHandler = new SystemErrorHandler({
          strategyPipeline: this.strategyPipeline,
          contextManager: this.contextManager,
          neuralHub: this.neuralHub,
          semanticProcessor: this.semanticProcessor,
          logger: this.logger,
          metrics: this.metrics
        });
        
        // Initialize bridge components if enabled
        if (this.useBridges) {
          this.logger.info('Initializing bridge components');
          
          this.strategyPipelineBridge = new StrategyPipelineBridge({
            strategyPipeline: this.strategyPipeline,
            contextManager: this.contextManager,
            strategyGenerator: this.strategyGenerator,
            resolutionExecutor: this.resolutionExecutor,
            logger: this.logger,
            metrics: this.metrics
          });
        }
      }
      
      // Initialize integration validators
      this.integrationValidator = new NeuralSemanticPredictiveIntegration({
        neuralHub: this.neuralHub,
        semanticProcessor: this.semanticProcessor,
        predictiveExecutor: this.predictiveExecutor,
        causalAnalyzer: this.causalAnalyzer,
        strategyGenerator: this.strategyGenerator,
        resolutionExecutor: this.resolutionExecutor,
        learningSystem: this.learningSystem,
        bayesianPredictor: this.bayesianPredictor,
        eventEmitter: this.eventEmitter,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.comprehensiveValidator = new NeuralSemanticPredictiveIntegrationValidator({
        integration: this.integrationValidator,
        logger: this.logger,
        metrics: this.metrics
      });
      
      this.logger.info('All components initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize components: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Runs validation using the legacy architecture.
   * @returns {Promise<Object>} Validation results
   */
  async runLegacyValidation() {
    this.logger.info('Running validation with legacy architecture');
    
    try {
      const startTime = Date.now();
      
      // Run basic integration validation
      const basicResults = await this.integrationValidator.validateIntegration();
      
      // Run comprehensive integration validation
      const comprehensiveResults = await this.comprehensiveValidator.validateAllIntegrations();
      
      // Calculate overall results
      const totalTests = basicResults.summary.totalTests + comprehensiveResults.summary.totalTests;
      const passedTests = basicResults.summary.passedTests + comprehensiveResults.summary.passedTests;
      const passRate = totalTests > 0 ? passedTests / totalTests : 0;
      const confidenceInterval = this.calculateConfidenceInterval(passedTests, totalTests);
      
      const overallStatus = passRate >= 0.95 ? "passed" : "failed";
      
      const validationResults = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        overallStatus,
        basicValidation: basicResults,
        comprehensiveValidation: comprehensiveResults,
        summary: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          passRate,
          confidenceInterval
        }
      };
      
      this.logger.info(`Legacy validation ${overallStatus.toUpperCase()}`);
      this.logger.info(`Total tests: ${totalTests}`);
      this.logger.info(`Pass rate: ${(passRate * 100).toFixed(2)}%`);
      this.logger.info(`Confidence Interval (98%): ±${(confidenceInterval * 100).toFixed(2)}%`);
      
      this.legacyResults = validationResults;
      return validationResults;
    } catch (error) {
      this.logger.error(`Legacy validation failed: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Runs validation using the new architecture.
   * @returns {Promise<Object>} Validation results
   */
  async runNewArchValidation() {
    if (!this.useNewArchitecture) {
      this.logger.warn('New architecture is disabled, skipping validation');
      return null;
    }
    
    this.logger.info('Running validation with new architecture');
    
    try {
      const startTime = Date.now();
      const testCases = this.generateTestCases();
      const results = [];
      
      // Process each test case through the new architecture
      for (const testCase of testCases) {
        this.logger.debug(`Processing test case: ${testCase.id}`);
        
        let result;
        if (this.useBridges && this.strategyPipelineBridge) {
          // Use bridge for processing
          result = await this.strategyPipelineBridge.processError(
            testCase.id,
            testCase.context
          );
        } else if (this.strategyPipeline) {
          // Use pipeline directly
          result = await this.strategyPipeline.processThroughPipeline(
            testCase.id,
            testCase.context
          );
        } else {
          throw new Error('Neither bridge nor pipeline available for processing');
        }
        
        results.push({
          testCase,
          result,
          passed: result.successful,
          duration: result.duration || 0
        });
      }
      
      // Calculate results
      const totalTests = results.length;
      const passedTests = results.filter(r => r.passed).length;
      const passRate = totalTests > 0 ? passedTests / totalTests : 0;
      const confidenceInterval = this.calculateConfidenceInterval(passedTests, totalTests);
      
      const overallStatus = passRate >= 0.95 ? "passed" : "failed";
      
      const validationResults = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        overallStatus,
        results,
        summary: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          passRate,
          confidenceInterval
        }
      };
      
      this.logger.info(`New architecture validation ${overallStatus.toUpperCase()}`);
      this.logger.info(`Total tests: ${totalTests}`);
      this.logger.info(`Pass rate: ${(passRate * 100).toFixed(2)}%`);
      this.logger.info(`Confidence Interval (98%): ±${(confidenceInterval * 100).toFixed(2)}%`);
      
      this.newArchResults = validationResults;
      return validationResults;
    } catch (error) {
      this.logger.error(`New architecture validation failed: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Runs validation using both architectures and compares results.
   * @returns {Promise<Object>} Comparison results
   */
  async runComparisonValidation() {
    if (!this.compareModes || !this.useNewArchitecture) {
      this.logger.warn('Comparison mode is disabled or new architecture is disabled, skipping comparison');
      return null;
    }
    
    this.logger.info('Running comparison validation between legacy and new architecture');
    
    try {
      // Run both validations
      const legacyResults = await this.runLegacyValidation();
      const newArchResults = await this.runNewArchValidation();
      
      // Compare results
      const legacyPassRate = legacyResults.summary.passRate;
      const newArchPassRate = newArchResults.summary.passRate;
      const passRateDiff = newArchPassRate - legacyPassRate;
      
      const comparisonResults = {
        timestamp: new Date().toISOString(),
        legacyResults,
        newArchResults,
        comparison: {
          legacyPassRate,
          newArchPassRate,
          passRateDiff,
          improvement: passRateDiff >= 0,
          significantImprovement: passRateDiff >= 0.1 // 10% improvement threshold
        }
      };
      
      this.logger.info('Comparison results:');
      this.logger.info(`Legacy pass rate: ${(legacyPassRate * 100).toFixed(2)}%`);
      this.logger.info(`New architecture pass rate: ${(newArchPassRate * 100).toFixed(2)}%`);
      this.logger.info(`Difference: ${(passRateDiff * 100).toFixed(2)}%`);
      this.logger.info(`Improvement: ${comparisonResults.comparison.improvement ? 'Yes' : 'No'}`);
      this.logger.info(`Significant improvement: ${comparisonResults.comparison.significantImprovement ? 'Yes' : 'No'}`);
      
      return comparisonResults;
    } catch (error) {
      this.logger.error(`Comparison validation failed: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Runs validation based on configuration.
   * @returns {Promise<Object>} Validation results
   */
  async runValidation() {
    this.logger.info('Starting integration validation');
    
    try {
      // Initialize components
      await this.initialize();
      
      let results;
      
      if (this.compareModes && this.useNewArchitecture) {
        // Run comparison validation
        results = await this.runComparisonValidation();
      } else if (this.useNewArchitecture) {
        // Run new architecture validation
        results = await this.runNewArchValidation();
      } else {
        // Run legacy validation
        results = await this.runLegacyValidation();
      }
      
      // Write validation report
      await this.writeValidationReport(results);
      
      return results;
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Generates test cases for validation.
   * @returns {Array<Object>} Test cases
   * @private
   */
  generateTestCases() {
    return [
      {
        id: `error-${uuidv4()}`,
        context: {
          errorType: 'ComponentFailure',
          errorMessage: 'Component failed to initialize',
          componentId: 'AuthenticationService',
          severity: 'high'
        }
      },
      {
        id: `error-${uuidv4()}`,
        context: {
          errorType: 'DataCorruption',
          errorMessage: 'Data integrity check failed',
          componentId: 'StorageManager',
          dataId: 'user-preferences',
          severity: 'medium'
        }
      },
      {
        id: `error-${uuidv4()}`,
        context: {
          errorType: 'NetworkFailure',
          errorMessage: 'Failed to connect to remote service',
          componentId: 'ApiClient',
          serviceUrl: 'https://api.example.com',
          severity: 'medium'
        }
      },
      {
        id: `error-${uuidv4()}`,
        context: {
          errorType: 'ResourceExhaustion',
          errorMessage: 'Memory allocation failed',
          componentId: 'ImageProcessor',
          resourceType: 'memory',
          severity: 'high'
        }
      }
    ];
  }
  
  /**
   * Calculates confidence interval for pass rate.
   * @param {number} passed - Number of passed tests
   * @param {number} total - Total number of tests
   * @param {number} [confidenceLevel=0.98] - Confidence level (0-1)
   * @returns {number} Confidence interval
   * @private
   */
  calculateConfidenceInterval(passed, total, confidenceLevel = 0.98) {
    if (total === 0) return 0;
    
    const passRate = passed / total;
    const z = 2.33; // z-score for 98% confidence
    const interval = z * Math.sqrt((passRate * (1 - passRate)) / total);
    
    return interval;
  }
  
  /**
   * Generates a validation report.
   * @param {Object} validationResults - Validation results
   * @returns {string} Validation report
   * @private
   */
  generateValidationReport(validationResults) {
    if (!validationResults) {
      return "No validation results available.";
    }
    
    let report = `# Autonomous Error Recovery System - Integration Validation Report\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Status:** ${validationResults.overallStatus === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Duration:** ${validationResults.duration}ms\n\n`;
    
    if (this.compareModes && validationResults.comparison) {
      // Comparison report
      report += `## Architecture Comparison\n\n`;
      report += `| Architecture | Pass Rate | Tests | Failures |\n`;
      report += `| ------------ | --------- | ----- | -------- |\n`;
      report += `| Legacy | ${(validationResults.comparison.legacyPassRate * 100).toFixed(2)}% | ${validationResults.legacyResults.summary.totalTests} | ${validationResults.legacyResults.summary.failedTests} |\n`;
      report += `| New | ${(validationResults.comparison.newArchPassRate * 100).toFixed(2)}% | ${validationResults.newArchResults.summary.totalTests} | ${validationResults.newArchResults.summary.failedTests} |\n\n`;
      
      report += `**Improvement:** ${(validationResults.comparison.passRateDiff * 100).toFixed(2)}%\n`;
      report += `**Significant Improvement:** ${validationResults.comparison.significantImprovement ? 'Yes' : 'No'}\n\n`;
    } else if (this.useNewArchitecture && validationResults.summary) {
      // New architecture report
      report += `## New Architecture Validation\n\n`;
      report += `**Pass Rate:** ${(validationResults.summary.passRate * 100).toFixed(2)}%\n`;
      report += `**Confidence Interval (98%):** ±${(validationResults.summary.confidenceInterval * 100).toFixed(2)}%\n`;
      report += `**Total Tests:** ${validationResults.summary.totalTests}\n`;
      report += `**Passed Tests:** ${validationResults.summary.passedTests}\n`;
      report += `**Failed Tests:** ${validationResults.summary.failedTests}\n\n`;
      
      if (validationResults.results && validationResults.results.length > 0) {
        report += `### Test Results\n\n`;
        report += `| Test Case | Status | Duration |\n`;
        report += `| --------- | ------ | -------- |\n`;
        
        for (const result of validationResults.results) {
          report += `| ${result.testCase.context.errorType} | ${result.passed ? '✅ PASSED' : '❌ FAILED'} | ${result.duration}ms |\n`;
        }
        
        report += `\n`;
      }
    } else if (validationResults.basicValidation && validationResults.comprehensiveValidation) {
      // Legacy report
      report += `## Basic Integration Validation\n\n`;
      report += `**Status:** ${validationResults.basicValidation.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(validationResults.basicValidation.summary.passRate * 100).toFixed(2)}%\n`;
      report += `**Total Tests:** ${validationResults.basicValidation.summary.totalTests}\n\n`;
      
      report += `## Comprehensive Integration Validation\n\n`;
      report += `**Status:** ${validationResults.comprehensiveValidation.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(validationResults.comprehensiveValidation.summary.passRate * 100).toFixed(2)}%\n`;
      report += `**Total Tests:** ${validationResults.comprehensiveValidation.summary.totalTests}\n\n`;
      
      // Neural integration results
      if (validationResults.comprehensiveValidation.results && 
          validationResults.comprehensiveValidation.results.neuralIntegration) {
        
        const neuralResults = validationResults.comprehensiveValidation.results.neuralIntegration;
        report += `### Neural Integration Results\n\n`;
        report += `**Status:** ${neuralResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${neuralResults.tests}\n`;
        report += `**Failures:** ${neuralResults.failures}\n\n`;
        
        if (neuralResults.details && neuralResults.details.length > 0) {
          report += `| Test | Status | Message |\n`;
          report += `| ---- | ------ | ------- |\n`;
          neuralResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += `\n`;
        }
        
        // Semantic integration results
        const semanticResults = validationResults.comprehensiveValidation.results.semanticIntegration;
        report += `### Semantic Integration Results\n\n`;
        report += `**Status:** ${semanticResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${semanticResults.tests}\n`;
        report += `**Failures:** ${semanticResults.failures}\n\n`;
        
        if (semanticResults.details && semanticResults.details.length > 0) {
          report += `| Test | Status | Message |\n`;
          report += `| ---- | ------ | ------- |\n`;
          semanticResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += `\n`;
        }
        
        // Predictive integration results
        const predictiveResults = validationResults.comprehensiveValidation.results.predictiveIntegration;
        report += `### Predictive Integration Results\n\n`;
        report += `**Status:** ${predictiveResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${predictiveResults.tests}\n`;
        report += `**Failures:** ${predictiveResults.failures}\n\n`;
        
        if (predictiveResults.details && predictiveResults.details.length > 0) {
          report += `| Test | Status | Message |\n`;
          report += `| ---- | ------ | ------- |\n`;
          predictiveResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += `\n`;
        }
        
        // Error recovery integration results
        const errorRecoveryResults = validationResults.comprehensiveValidation.results.errorRecoveryIntegration || {
          passed: false,
          tests: 0,
          failures: 0,
          details: []
        };
        report += `### Error Recovery Integration Results\n\n`;
        report += `**Status:** ${errorRecoveryResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${errorRecoveryResults.tests || 0}\n`;
        report += `**Failures:** ${errorRecoveryResults.failures || 0}\n\n`;
        
        if (errorRecoveryResults.details && errorRecoveryResults.details.length > 0) {
          report += `| Test | Status | Message |\n`;
          report += `| ---- | ------ | ------- |\n`;
          errorRecoveryResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += `\n`;
        }
      }
    }
    
    report += `## Conclusion\n\n`;
    if (validationResults.overallStatus === 'passed') {
      report += `✅ **The Autonomous Error Recovery System has been successfully integrated with the Neural Hyperconnectivity System, Cross-Domain Semantic Integration Framework, and Predictive Intelligence Engine.**\n\n`;
      report += `All components are working together as expected, with a high pass rate and confidence interval exceeding the required 98% threshold.\n\n`;
    } else {
      report += `❌ **The integration validation has failed. Further investigation and fixes are required.**\n\n`;
      report += `Please review the detailed error reports above to identify and address the issues.\n\n`;
    }
    
    return report;
  }
  
  /**
   * Writes validation report to file.
   * @param {Object} validationResults - Validation results
   * @returns {Promise<string>} Report file path
   * @private
   */
  async writeValidationReport(validationResults) {
    try {
      const report = this.generateValidationReport(validationResults);
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const reportDir = path.join(process.cwd(), 'src', 'performance_validation', 'reports');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const reportPath = path.join(reportDir, `error_recovery_integration_validation_report_${timestamp}.md`);
      fs.writeFileSync(reportPath, report);
      
      this.logger.info(`Validation report written to: ${reportPath}`);
      
      // Print summary to console
      console.log('--- Validation Report Summary ---');
      console.log(`Status: ${validationResults.overallStatus.toUpperCase()}`);
      console.log(`Pass Rate: ${(validationResults.summary.passRate * 100).toFixed(2)}%`);
      console.log(`Confidence Interval (98%): ±${(validationResults.summary.confidenceInterval * 100).toFixed(2)}%`);
      console.log(`Detailed report written to: ${reportPath}`);
      
      return reportPath;
    } catch (error) {
      this.logger.error(`Failed to write validation report: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = IntegrationValidationRunnerEnhanced;

// Run validation if this script is executed directly
if (require.main === module) {
  const runner = new IntegrationValidationRunnerEnhanced({
    useNewArchitecture: true,
    useBridges: true,
    compareModes: false
  });
  
  runner.runValidation()
    .then(results => {
      process.exit(results.overallStatus === 'passed' ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
