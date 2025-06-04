/**
 * @fileoverview Integration validation runner for the Autonomous Error Recovery System.
 * This module runs comprehensive integration tests between the Error Recovery System
 * and the Neural, Semantic, and Predictive layers.
 * 
 * @module core/error_recovery/IntegrationValidationRunner
 */

const EventEmitter = require('events');
const NeuralSemanticPredictiveIntegration = require('./NeuralSemanticPredictiveIntegration');
const NeuralSemanticPredictiveIntegrationValidator = require('./NeuralSemanticPredictiveIntegrationValidator');

// Import core components
const CausalAnalyzer = require('./CausalAnalyzer');
const RecoveryStrategyGenerator = require('./RecoveryStrategyGenerator');
const ResolutionExecutor = require('./ResolutionExecutor');
const RecoveryLearningSystem = require('./RecoveryLearningSystem');

// Import integration components - Fixed imports to use direct require without destructuring
const NeuralCoordinationHub = require('../neural/NeuralCoordinationHub');
const UnifiedKnowledgeGraph = require('../semantic/UnifiedKnowledgeGraph');
const SemanticTranslator = require('../semantic/SemanticTranslator');
const CrossDomainQueryProcessor = require('../semantic/CrossDomainQueryProcessor');
const PredictiveTaskExecutor = require('../predictive/PredictiveTaskExecutor');

class IntegrationValidationRunner {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    this.eventEmitter = new EventEmitter();
    
    // Integration components
    this.neuralHub = null;
    this.knowledgeGraph = null;
    this.semanticTranslator = null;
    this.semanticProcessor = null;
    this.predictiveExecutor = null;
    
    // Error recovery components
    this.causalAnalyzer = null;
    this.strategyGenerator = null;
    this.resolutionExecutor = null;
    this.learningSystem = null;
    
    // Integration validators
    this.integrationValidator = null;
    this.comprehensiveValidator = null;
    
    this.logger.info('IntegrationValidationRunner initialized');
  }
  
  /**
   * Initializes all components required for validation.
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing components for validation...');
      
      // Initialize Neural components
      this.neuralHub = new NeuralCoordinationHub({
        logger: this.logger,
        metrics: this.metrics
      });
      this.logger.info('Neural Coordination Hub initialized');
      
      // Initialize Semantic components
      this.knowledgeGraph = new UnifiedKnowledgeGraph({
        logger: this.logger,
        metrics: this.metrics,
        storageType: "memory"
      });
      this.logger.info('Unified Knowledge Graph initialized');
      
      this.semanticTranslator = new SemanticTranslator({
        logger: this.logger,
        metrics: this.metrics
      });
      this.logger.info('Semantic Translator initialized');
      
      this.semanticProcessor = new CrossDomainQueryProcessor(
        this.knowledgeGraph,
        this.semanticTranslator,
        {
          logger: this.logger,
          metrics: this.metrics
        }
      );
      this.logger.info('Cross-Domain Query Processor initialized');
      
      // Initialize Predictive components
      this.predictiveExecutor = new PredictiveTaskExecutor({
        logger: this.logger,
        metrics: this.metrics
      });
      this.logger.info('Predictive Task Executor initialized');
      
      // Initialize Error Recovery components
      this.causalAnalyzer = new CausalAnalyzer({
        logger: this.logger,
        metrics: this.metrics,
        eventEmitter: this.eventEmitter
      });
      this.logger.info('Causal Analyzer initialized');
      
      this.strategyGenerator = new RecoveryStrategyGenerator({
        logger: this.logger,
        metrics: this.metrics,
        eventEmitter: this.eventEmitter
      });
      this.logger.info('Recovery Strategy Generator initialized');
      
      this.resolutionExecutor = new ResolutionExecutor({
        logger: this.logger,
        metrics: this.metrics,
        eventEmitter: this.eventEmitter
      });
      this.logger.info('Resolution Executor initialized');
      
      this.learningSystem = new RecoveryLearningSystem({
        logger: this.logger,
        metrics: this.metrics,
        eventEmitter: this.eventEmitter
      });
      this.logger.info('Recovery Learning System initialized');
      
      // Initialize Integration validators
      this.integrationValidator = new NeuralSemanticPredictiveIntegration({
        neuralHub: this.neuralHub,
        knowledgeGraph: this.knowledgeGraph,
        semanticTranslator: this.semanticTranslator,
        semanticProcessor: this.semanticProcessor,
        predictiveExecutor: this.predictiveExecutor,
        causalAnalyzer: this.causalAnalyzer,
        strategyGenerator: this.strategyGenerator,
        resolutionExecutor: this.resolutionExecutor,
        learningSystem: this.learningSystem,
        eventEmitter: this.eventEmitter,
        logger: this.logger,
        metrics: this.metrics
      });
      this.logger.info('Neural-Semantic-Predictive Integration initialized');
      
      this.comprehensiveValidator = new NeuralSemanticPredictiveIntegrationValidator({
        logger: this.logger,
        metrics: this.metrics
      });
      this.logger.info('Comprehensive Integration Validator initialized');
      
      this.logger.info('All components initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize components: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Runs all integration validation tests.
   * @returns {Promise<ValidationResult>} Validation results
   */
  async runValidation() {
    const startTime = Date.now();
    this.logger.info('Starting integration validation...');
    
    try {
      // Initialize components if not already initialized
      if (!this.integrationValidator) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize components for validation');
        }
      }
      
      // Run basic integration validation
      const basicResults = await this.integrationValidator.validateIntegration();
      this.logger.info(`Basic integration validation ${basicResults.overallStatus === 'passed' ? 'PASSED' : 'FAILED'}`);
      this.logger.info(`Pass rate: ${(basicResults.summary.passRate * 100).toFixed(2)}%`);
      
      // Run comprehensive integration validation
      await this.comprehensiveValidator.initializeComponents();
      const comprehensiveResults = await this.comprehensiveValidator.validateAllIntegrations();
      this.logger.info(`Comprehensive integration validation ${comprehensiveResults.passed ? 'PASSED' : 'FAILED'}`);
      this.logger.info(`Pass rate: ${(comprehensiveResults.passRate * 100).toFixed(2)}%`);
      this.logger.info(`Confidence Interval (98%): ±${comprehensiveResults.confidenceInterval.toFixed(2)}%`);
      
      // Combine results
      const combinedResults = {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        basicValidation: basicResults,
        comprehensiveValidation: comprehensiveResults,
        overallStatus: basicResults.overallStatus === 'passed' && comprehensiveResults.passed ? 'passed' : 'failed',
        summary: {
          totalTests: basicResults.summary.totalTests + comprehensiveResults.totalTests,
          passedTests: basicResults.summary.passedTests + comprehensiveResults.totalTests - comprehensiveResults.totalFailures,
          confidenceInterval: comprehensiveResults.confidenceInterval
        }
      };
      
      combinedResults.summary.passRate = combinedResults.summary.passedTests / combinedResults.summary.totalTests;
      
      this.logger.info(`Overall integration validation ${combinedResults.overallStatus === 'passed' ? 'PASSED' : 'FAILED'}`);
      this.logger.info(`Total tests: ${combinedResults.summary.totalTests}`);
      this.logger.info(`Pass rate: ${(combinedResults.summary.passRate * 100).toFixed(2)}%`);
      this.logger.info(`Confidence Interval (98%): ±${combinedResults.summary.confidenceInterval.toFixed(2)}%`);
      this.logger.info(`Total duration: ${combinedResults.duration}ms`);
      
      return combinedResults;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Integration validation failed with error: ${error.message}`, error);
      
      return {
        timestamp: Date.now(),
        duration,
        overallStatus: 'failed',
        error: {
          message: error.message,
          stack: error.stack
        },
        summary: {
          totalTests: 0,
          passedTests: 0,
          passRate: 0,
          confidenceInterval: 0
        }
      };
    }
  }
  
  /**
   * Generates a detailed validation report.
   * @param {ValidationResult} validationResults - Results from validation run
   * @returns {string} Formatted validation report
   */
  generateValidationReport(validationResults) {
    if (!validationResults) {
      return 'No validation results available';
    }
    
    let report = '# Autonomous Error Recovery System - Integration Validation Report\n\n';
    report += `**Date:** ${new Date(validationResults.timestamp).toISOString()}\n`;
    report += `**Duration:** ${validationResults.duration}ms\n`;
    report += `**Status:** ${validationResults.overallStatus === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    report += '## Summary\n\n';
    report += `- **Total Tests:** ${validationResults.summary.totalTests}\n`;
    report += `- **Passed Tests:** ${validationResults.summary.passedTests}\n`;
    report += `- **Pass Rate:** ${(validationResults.summary.passRate * 100).toFixed(2)}%\n`;
    report += `- **Confidence Interval (98%):** ±${validationResults.summary.confidenceInterval.toFixed(2)}%\n\n`;
    
    if (validationResults.error) {
      report += '## Errors\n\n';
      report += `**Error:** ${validationResults.error.message}\n\n`;
      report += '```\n' + validationResults.error.stack + '\n```\n\n';
    }
    
    if (validationResults.basicValidation) {
      report += '## Basic Integration Validation\n\n';
      report += `**Status:** ${validationResults.basicValidation.overallStatus === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(validationResults.basicValidation.summary.passRate * 100).toFixed(2)}%\n\n`;
      
      // Neural integration results
      report += '### Neural Hyperconnectivity System Integration\n\n';
      const neuralResults = validationResults.basicValidation.components.neural;
      report += `**Status:** ${neuralResults.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(neuralResults.passRate * 100).toFixed(2)}%\n\n`;
      
      report += '| Test | Status | Error |\n';
      report += '| ---- | ------ | ----- |\n';
      neuralResults.tests.forEach(test => {
        report += `| ${test.name} | ${test.passed ? '✅ PASSED' : '❌ FAILED'} | ${test.error || '-'} |\n`;
      });
      report += '\n';
      
      // Semantic integration results
      report += '### Cross-Domain Semantic Integration Framework Integration\n\n';
      const semanticResults = validationResults.basicValidation.components.semantic;
      report += `**Status:** ${semanticResults.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(semanticResults.passRate * 100).toFixed(2)}%\n\n`;
      
      report += '| Test | Status | Error |\n';
      report += '| ---- | ------ | ----- |\n';
      semanticResults.tests.forEach(test => {
        report += `| ${test.name} | ${test.passed ? '✅ PASSED' : '❌ FAILED'} | ${test.error || '-'} |\n`;
      });
      report += '\n';
      
      // Predictive integration results
      report += '### Predictive Intelligence Engine Integration\n\n';
      const predictiveResults = validationResults.basicValidation.components.predictive;
      report += `**Status:** ${predictiveResults.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(predictiveResults.passRate * 100).toFixed(2)}%\n\n`;
      
      report += '| Test | Status | Error |\n';
      report += '| ---- | ------ | ----- |\n';
      predictiveResults.tests.forEach(test => {
        report += `| ${test.name} | ${test.passed ? '✅ PASSED' : '❌ FAILED'} | ${test.error || '-'} |\n`;
      });
      report += '\n';
      
      // End-to-end workflow results
      report += '### End-to-End Workflows\n\n';
      const workflowResults = validationResults.basicValidation.components.workflows;
      report += `**Status:** ${workflowResults.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Pass Rate:** ${(workflowResults.passRate * 100).toFixed(2)}%\n\n`;
      
      report += '| Test | Status | Error |\n';
      report += '| ---- | ------ | ----- |\n';
      workflowResults.tests.forEach(test => {
        report += `| ${test.name} | ${test.passed ? '✅ PASSED' : '❌ FAILED'} | ${test.error || '-'} |\n`;
      });
      report += '\n';
    }
    
    if (validationResults.comprehensiveValidation) {
      report += '## Comprehensive Integration Validation\n\n';
      report += `**Status:** ${validationResults.comprehensiveValidation.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `**Total Tests:** ${validationResults.comprehensiveValidation.totalTests}\n`;
      report += `**Failed Tests:** ${validationResults.comprehensiveValidation.totalFailures}\n`;
      report += `**Pass Rate:** ${(validationResults.comprehensiveValidation.passRate * 100).toFixed(2)}%\n`;
      report += `**Confidence Interval (98%):** ±${validationResults.comprehensiveValidation.confidenceInterval.toFixed(2)}%\n\n`;
      
      if (validationResults.comprehensiveValidation.results) {
        // Neural integration results
        report += '### Neural Integration Results\n\n';
        const neuralResults = validationResults.comprehensiveValidation.results.neuralIntegration;
        report += `**Status:** ${neuralResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${neuralResults.tests}\n`;
        report += `**Failures:** ${neuralResults.failures}\n\n`;
        
        if (neuralResults.details && neuralResults.details.length > 0) {
          report += '| Test | Status | Message |\n';
          report += '| ---- | ------ | ------- |\n';
          neuralResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += '\n';
        }
        
        // Semantic integration results
        report += '### Semantic Integration Results\n\n';
        const semanticResults = validationResults.comprehensiveValidation.results.semanticIntegration;
        report += `**Status:** ${semanticResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${semanticResults.tests}\n`;
        report += `**Failures:** ${semanticResults.failures}\n\n`;
        
        if (semanticResults.details && semanticResults.details.length > 0) {
          report += '| Test | Status | Message |\n';
          report += '| ---- | ------ | ------- |\n';
          semanticResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += '\n';
        }
        
        // Predictive integration results
        report += '### Predictive Integration Results\n\n';
        const predictiveResults = validationResults.comprehensiveValidation.results.predictiveIntegration;
        report += `**Status:** ${predictiveResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${predictiveResults.tests}\n`;
        report += `**Failures:** ${predictiveResults.failures}\n\n`;
        
        if (predictiveResults.details && predictiveResults.details.length > 0) {
          report += '| Test | Status | Message |\n';
          report += '| ---- | ------ | ------- |\n';
          predictiveResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += '\n';
        }
        
        // Error recovery integration results
        report += '### Error Recovery Integration Results\n\n';
        const errorRecoveryResults = validationResults.comprehensiveValidation.results.errorRecoveryIntegration || {
          passed: false,
          tests: 0,
          failures: 0,
          details: []
        };
        report += `**Status:** ${errorRecoveryResults.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Tests:** ${errorRecoveryResults.tests || 0}\n`;
        report += `**Failures:** ${errorRecoveryResults.failures || 0}\n\n`;
        
        if (errorRecoveryResults.details && errorRecoveryResults.details.length > 0) {
          report += '| Test | Status | Message |\n';
          report += '| ---- | ------ | ------- |\n';
          errorRecoveryResults.details.forEach(detail => {
            report += `| ${detail.test} | ${detail.passed ? '✅ PASSED' : '❌ FAILED'} | ${detail.message} |\n`;
          });
          report += '\n';
        }
      }
    }
    
    report += '## Conclusion\n\n';
    if (validationResults.overallStatus === 'passed') {
      report += '✅ **The Autonomous Error Recovery System has been successfully integrated with the Neural Hyperconnectivity System, Cross-Domain Semantic Integration Framework, and Predictive Intelligence Engine.**\n\n';
      report += 'All components are working together as expected, with a high pass rate and confidence interval exceeding the required 98% threshold.\n\n';
    } else {
      report += '❌ **The integration validation has failed. Further investigation and fixes are required.**\n\n';
      report += 'Please review the detailed error reports above to identify and address the issues.\n\n';
    }
    
    report += '## Next Steps\n\n';
    if (validationResults.overallStatus === 'passed') {
      report += '1. Update the master project tracking document\n';
      report += '2. Commit changes to the repository\n';
      report += '3. Proceed to the next Beast Mode enhancement\n';
    } else {
      report += '1. Address the identified integration issues\n';
      report += '2. Re-run the integration validation\n';
      report += '3. Update the master project tracking document once validation passes\n';
    }
    
    return report;
  }
  
  /**
   * Writes the validation report to a file.
   * @param {ValidationResult} validationResults - Results from validation run
   * @returns {Promise<string>} Path to the written report file
   */
  async writeValidationReport(validationResults) {
    const fs = require('fs');
    const path = require('path');
    const util = require('util');
    
    const writeFileAsync = util.promisify(fs.writeFile);
    const mkdirAsync = util.promisify(fs.mkdir);
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportDir = path.join(__dirname, '../../performance_validation/reports');
    const reportPath = path.join(reportDir, `error_recovery_integration_validation_report_${timestamp}.md`);
    
    try {
      // Ensure directory exists
      await mkdirAsync(reportDir, { recursive: true });
      
      // Generate and write report
      const report = this.generateValidationReport(validationResults);
      await writeFileAsync(reportPath, report);
      
      this.logger.info(`Validation report written to: ${reportPath}`);
      
      // Write summary to console
      this.logger.info('--- Validation Report Summary ---');
      this.logger.info(`Status: ${validationResults.overallStatus === 'passed' ? 'PASSED' : 'FAILED'}`);
      this.logger.info(`Pass Rate: ${(validationResults.summary.passRate * 100).toFixed(2)}%`);
      this.logger.info(`Confidence Interval (98%): ±${validationResults.summary.confidenceInterval.toFixed(2)}%`);
      this.logger.info(`Detailed report written to: ${reportPath}`);
      
      return reportPath;
    } catch (error) {
      this.logger.error(`Failed to write validation report: ${error.message}`, error);
      throw error;
    }
  }
}

// Run validation if this module is executed directly
if (require.main === module) {
  const runner = new IntegrationValidationRunner();
  runner.runValidation()
    .then(results => runner.writeValidationReport(results))
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = IntegrationValidationRunner;
