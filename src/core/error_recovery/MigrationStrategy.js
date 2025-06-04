/**
 * @fileoverview Implementation of the MigrationStrategy for the Autonomous Error Recovery System.
 * This component provides a phased migration strategy for transitioning from legacy to new architecture.
 * 
 * @module core/error_recovery/MigrationStrategy
 * @requires events
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

/**
 * MigrationStrategy provides a phased approach for migrating from legacy components
 * to the new architecture while maintaining system stability.
 */
class MigrationStrategy extends EventEmitter {
  /**
   * Creates a new MigrationStrategy instance.
   * @param {Object} options - Configuration options
   * @param {Object} options.registry - ComponentRegistry instance
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.metrics - Metrics collector instance
   */
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.registry = options.registry;
    this.logger = options.logger || console;
    this.metrics = options.metrics;
    
    // Migration state
    this.currentPhase = 0;
    this.phaseStatus = new Map();
    this.migrationHistory = [];
    
    // Migration configuration
    this.config = options.config || this.getDefaultConfig();
    
    this.logger.info("MigrationStrategy initialized");
  }
  
  /**
   * Gets default migration configuration.
   * @returns {Object} Default configuration
   * @private
   */
  getDefaultConfig() {
    return {
      phases: [
        {
          id: "phase1",
          name: "Bridge Integration",
          description: "Integrate bridge components with legacy system",
          components: ["strategyPipelineBridge"],
          requiredSuccess: 0.9, // 90% success rate required to proceed
          rollbackThreshold: 0.7 // Roll back if success rate drops below 70%
        },
        {
          id: "phase2",
          name: "Context Propagation",
          description: "Integrate context propagation with legacy components",
          components: ["contextManager"],
          requiredSuccess: 0.9,
          rollbackThreshold: 0.7
        },
        {
          id: "phase3",
          name: "Strategy Pipeline",
          description: "Migrate to new strategy pipeline",
          components: ["strategyPipeline"],
          requiredSuccess: 0.9,
          rollbackThreshold: 0.7
        },
        {
          id: "phase4",
          name: "Error Handling",
          description: "Migrate to new error handling system",
          components: ["errorHandler"],
          requiredSuccess: 0.9,
          rollbackThreshold: 0.7
        },
        {
          id: "phase5",
          name: "Full Migration",
          description: "Complete migration to new architecture",
          components: ["strategyPipeline", "contextManager", "errorHandler"],
          requiredSuccess: 0.95,
          rollbackThreshold: 0.8
        }
      ],
      validationTests: {
        basic: true,
        comprehensive: true,
        comparison: true
      },
      rollbackEnabled: true,
      autoProgress: false,
      reportDirectory: "migration_reports"
    };
  }
  
  /**
   * Executes the current migration phase.
   * @returns {Promise<Object>} Phase execution results
   */
  async executeCurrentPhase() {
    const phase = this.getCurrentPhase();
    if (!phase) {
      throw new Error("No migration phase available");
    }
    
    this.logger.info(`Executing migration phase ${this.currentPhase + 1}: ${phase.name}`);
    
    try {
      // Record start of phase
      const phaseExecution = {
        phaseId: phase.id,
        phaseName: phase.name,
        startTime: Date.now(),
        status: "running",
        components: phase.components,
        results: null,
        validationResults: null,
        rollback: false
      };
      
      this.phaseStatus.set(phase.id, phaseExecution);
      
      // Emit phase started event
      this.emit("phase:started", {
        phaseId: phase.id,
        phaseName: phase.name,
        components: phase.components
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("migration_phase_started", 1);
        this.metrics.recordMetric(`migration_phase_${phase.id}_started`, 1);
      }
      
      // Enable components for this phase
      const enableResults = await this.enablePhaseComponents(phase);
      
      // Run validation tests
      const validationResults = await this.runValidationTests();
      phaseExecution.validationResults = validationResults;
      
      // Check if phase was successful
      const successRate = validationResults.passRate;
      const phaseSuccessful = successRate >= phase.requiredSuccess;
      
      if (phaseSuccessful) {
        this.logger.info(`Phase ${phase.id} completed successfully with ${successRate * 100}% success rate`);
        phaseExecution.status = "completed";
        
        // Advance to next phase if auto-progress is enabled
        if (this.config.autoProgress) {
          this.advancePhase();
        }
      } else {
        this.logger.warn(`Phase ${phase.id} did not meet required success rate: ${successRate * 100}% < ${phase.requiredSuccess * 100}%`);
        
        // Check if rollback is needed
        if (this.config.rollbackEnabled && successRate < phase.rollbackThreshold) {
          this.logger.warn(`Success rate below rollback threshold (${phase.rollbackThreshold * 100}%), rolling back phase`);
          await this.rollbackPhase(phase);
          phaseExecution.status = "rolled_back";
          phaseExecution.rollback = true;
        } else {
          phaseExecution.status = "failed";
        }
      }
      
      // Record end of phase
      phaseExecution.endTime = Date.now();
      phaseExecution.duration = phaseExecution.endTime - phaseExecution.startTime;
      
      // Add to migration history
      this.migrationHistory.push({
        ...phaseExecution,
        timestamp: new Date().toISOString()
      });
      
      // Emit phase completed event
      this.emit("phase:completed", {
        phaseId: phase.id,
        phaseName: phase.name,
        status: phaseExecution.status,
        duration: phaseExecution.duration,
        successRate
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("migration_phase_completed", 1);
        this.metrics.recordMetric(`migration_phase_${phase.id}_completed`, 1);
        this.metrics.recordMetric("migration_phase_success", phaseSuccessful ? 1 : 0);
        this.metrics.recordMetric("migration_phase_duration", phaseExecution.duration);
      }
      
      // Generate and save phase report
      await this.generatePhaseReport(phase, phaseExecution);
      
      return {
        phaseId: phase.id,
        phaseName: phase.name,
        status: phaseExecution.status,
        successRate,
        duration: phaseExecution.duration,
        components: enableResults,
        validationResults
      };
    } catch (error) {
      this.logger.error(`Error executing phase ${phase.id}: ${error.message}`, error);
      
      // Update phase status
      const phaseExecution = this.phaseStatus.get(phase.id);
      if (phaseExecution) {
        phaseExecution.status = "error";
        phaseExecution.error = error.message;
        phaseExecution.endTime = Date.now();
        phaseExecution.duration = phaseExecution.endTime - phaseExecution.startTime;
        
        // Add to migration history
        this.migrationHistory.push({
          ...phaseExecution,
          timestamp: new Date().toISOString()
        });
      }
      
      // Emit phase error event
      this.emit("phase:error", {
        phaseId: phase.id,
        phaseName: phase.name,
        error: error.message
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("migration_phase_error", 1);
        this.metrics.recordMetric(`migration_phase_${phase.id}_error`, 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Enables components for the current phase.
   * @param {Object} phase - Phase configuration
   * @returns {Promise<Object>} Component enablement results
   * @private
   */
  async enablePhaseComponents(phase) {
    this.logger.debug(`Enabling components for phase ${phase.id}: ${phase.components.join(", ")}`);
    
    const results = {
      enabled: [],
      failed: []
    };
    
    for (const componentId of phase.components) {
      try {
        // Get component from registry
        const component = this.registry.getComponent(componentId);
        if (!component) {
          throw new Error(`Component ${componentId} not found in registry`);
        }
        
        // Enable component (if it has an enable method)
        if (typeof component.enable === 'function') {
          await component.enable();
          this.logger.debug(`Enabled component ${componentId}`);
        }
        
        results.enabled.push(componentId);
      } catch (error) {
        this.logger.error(`Failed to enable component ${componentId}: ${error.message}`, error);
        results.failed.push({ componentId, error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Rolls back a migration phase.
   * @param {Object} phase - Phase configuration
   * @returns {Promise<Object>} Rollback results
   * @private
   */
  async rollbackPhase(phase) {
    this.logger.info(`Rolling back phase ${phase.id}`);
    
    const results = {
      disabled: [],
      failed: []
    };
    
    for (const componentId of phase.components) {
      try {
        // Get component from registry
        const component = this.registry.getComponent(componentId);
        if (!component) {
          throw new Error(`Component ${componentId} not found in registry`);
        }
        
        // Disable component (if it has a disable method)
        if (typeof component.disable === 'function') {
          await component.disable();
          this.logger.debug(`Disabled component ${componentId}`);
        }
        
        results.disabled.push(componentId);
      } catch (error) {
        this.logger.error(`Failed to disable component ${componentId}: ${error.message}`, error);
        results.failed.push({ componentId, error: error.message });
      }
    }
    
    // Emit phase rollback event
    this.emit("phase:rollback", {
      phaseId: phase.id,
      phaseName: phase.name,
      results
    });
    
    if (this.metrics) {
      this.metrics.recordMetric("migration_phase_rollback", 1);
      this.metrics.recordMetric(`migration_phase_${phase.id}_rollback`, 1);
    }
    
    return results;
  }
  
  /**
   * Runs validation tests for the current phase.
   * @returns {Promise<Object>} Validation results
   * @private
   */
  async runValidationTests() {
    this.logger.debug("Running validation tests");
    
    try {
      // Create validation runner
      const IntegrationValidationRunnerEnhanced = require('./IntegrationValidationRunnerEnhanced');
      
      const runner = new IntegrationValidationRunnerEnhanced({
        useNewArchitecture: true,
        useBridges: true,
        compareModes: this.config.validationTests.comparison,
        logger: this.logger,
        metrics: this.metrics
      });
      
      // Run validation
      const results = await runner.runValidation();
      
      return {
        passRate: results.summary.passRate,
        totalTests: results.summary.totalTests,
        passedTests: results.summary.passedTests,
        failedTests: results.summary.failedTests,
        confidenceInterval: results.summary.confidenceInterval,
        details: results
      };
    } catch (error) {
      this.logger.error(`Validation tests failed: ${error.message}`, error);
      
      // Return default failed results
      return {
        passRate: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        confidenceInterval: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Advances to the next migration phase.
   * @returns {Object|null} Next phase or null if no more phases
   */
  advancePhase() {
    if (this.currentPhase < this.config.phases.length - 1) {
      this.currentPhase++;
      const nextPhase = this.getCurrentPhase();
      
      this.logger.info(`Advanced to phase ${this.currentPhase + 1}: ${nextPhase.name}`);
      this.emit("phase:advanced", {
        phaseId: nextPhase.id,
        phaseName: nextPhase.name,
        phaseNumber: this.currentPhase + 1
      });
      
      if (this.metrics) {
        this.metrics.recordMetric("migration_phase_advanced", 1);
      }
      
      return nextPhase;
    } else {
      this.logger.info("All migration phases completed");
      this.emit("migration:completed");
      
      if (this.metrics) {
        this.metrics.recordMetric("migration_completed", 1);
      }
      
      return null;
    }
  }
  
  /**
   * Gets the current migration phase.
   * @returns {Object|null} Current phase or null if no phases
   */
  getCurrentPhase() {
    if (this.currentPhase < 0 || this.currentPhase >= this.config.phases.length) {
      return null;
    }
    
    return this.config.phases[this.currentPhase];
  }
  
  /**
   * Gets migration progress.
   * @returns {Object} Migration progress
   */
  getMigrationProgress() {
    const currentPhase = this.getCurrentPhase();
    const totalPhases = this.config.phases.length;
    const completedPhases = this.migrationHistory.filter(p => p.status === "completed").length;
    const progress = totalPhases > 0 ? completedPhases / totalPhases : 0;
    
    return {
      currentPhase: this.currentPhase + 1,
      currentPhaseName: currentPhase ? currentPhase.name : null,
      totalPhases,
      completedPhases,
      progress,
      history: this.migrationHistory
    };
  }
  
  /**
   * Generates a report for a migration phase.
   * @param {Object} phase - Phase configuration
   * @param {Object} execution - Phase execution details
   * @returns {Promise<string>} Report file path
   * @private
   */
  async generatePhaseReport(phase, execution) {
    try {
      const reportDir = path.join(process.cwd(), this.config.reportDirectory);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const reportPath = path.join(reportDir, `migration_phase_${phase.id}_${timestamp}.md`);
      
      let report = `# Migration Phase Report: ${phase.name}\n\n`;
      report += `**Phase ID:** ${phase.id}\n`;
      report += `**Status:** ${execution.status.toUpperCase()}\n`;
      report += `**Start Time:** ${new Date(execution.startTime).toISOString()}\n`;
      report += `**End Time:** ${new Date(execution.endTime).toISOString()}\n`;
      report += `**Duration:** ${execution.duration}ms\n\n`;
      
      report += `## Phase Description\n\n${phase.description}\n\n`;
      
      report += `## Components\n\n`;
      report += `| Component | Status |\n`;
      report += `| --------- | ------ |\n`;
      
      for (const componentId of phase.components) {
        const status = this.registry.getComponentStatus(componentId);
        report += `| ${componentId} | ${status && status.initialized ? '✅ Enabled' : '❌ Disabled'} |\n`;
      }
      
      report += `\n## Validation Results\n\n`;
      
      if (execution.validationResults) {
        const results = execution.validationResults;
        report += `**Pass Rate:** ${(results.passRate * 100).toFixed(2)}%\n`;
        report += `**Required Success Rate:** ${(phase.requiredSuccess * 100).toFixed(2)}%\n`;
        report += `**Rollback Threshold:** ${(phase.rollbackThreshold * 100).toFixed(2)}%\n`;
        report += `**Total Tests:** ${results.totalTests}\n`;
        report += `**Passed Tests:** ${results.passedTests}\n`;
        report += `**Failed Tests:** ${results.failedTests}\n`;
        report += `**Confidence Interval (98%):** ±${(results.confidenceInterval * 100).toFixed(2)}%\n\n`;
        
        if (results.error) {
          report += `**Error:** ${results.error}\n\n`;
        }
      } else {
        report += `No validation results available.\n\n`;
      }
      
      if (execution.rollback) {
        report += `## Rollback Information\n\n`;
        report += `This phase was rolled back because the success rate was below the rollback threshold.\n\n`;
      }
      
      fs.writeFileSync(reportPath, report);
      
      this.logger.info(`Phase report written to: ${reportPath}`);
      return reportPath;
    } catch (error) {
      this.logger.error(`Failed to generate phase report: ${error.message}`, error);
      return null;
    }
  }
  
  /**
   * Generates a comprehensive migration report.
   * @returns {Promise<string>} Report file path
   */
  async generateMigrationReport() {
    try {
      const reportDir = path.join(process.cwd(), this.config.reportDirectory);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const reportPath = path.join(reportDir, `migration_report_${timestamp}.md`);
      
      const progress = this.getMigrationProgress();
      
      let report = `# Autonomous Error Recovery System - Migration Report\n\n`;
      report += `**Date:** ${new Date().toISOString()}\n`;
      report += `**Progress:** ${(progress.progress * 100).toFixed(2)}% (${progress.completedPhases}/${progress.totalPhases} phases)\n`;
      report += `**Current Phase:** ${progress.currentPhaseName || "None"}\n\n`;
      
      report += `## Migration Phases\n\n`;
      report += `| Phase | Name | Status | Success Rate | Duration |\n`;
      report += `| ----- | ---- | ------ | ------------ | -------- |\n`;
      
      for (let i = 0; i < this.config.phases.length; i++) {
        const phase = this.config.phases[i];
        const execution = this.phaseStatus.get(phase.id);
        
        let status = "Pending";
        let successRate = "N/A";
        let duration = "N/A";
        
        if (execution) {
          status = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
          
          if (execution.validationResults) {
            successRate = `${(execution.validationResults.passRate * 100).toFixed(2)}%`;
          }
          
          if (execution.duration) {
            duration = `${execution.duration}ms`;
          }
        }
        
        report += `| ${i + 1} | ${phase.name} | ${status} | ${successRate} | ${duration} |\n`;
      }
      
      report += `\n## Component Status\n\n`;
      
      const componentStatus = this.registry.getStatus();
      
      report += `**Total Components:** ${componentStatus.totalComponents}\n`;
      report += `**Initialized Components:** ${componentStatus.initializedComponents}\n`;
      report += `**Failed Components:** ${componentStatus.failedComponents}\n\n`;
      
      report += `### Components by Category\n\n`;
      report += `| Category | Total | Initialized |\n`;
      report += `| -------- | ----- | ----------- |\n`;
      
      for (const category in componentStatus.byCategory) {
        const stats = componentStatus.byCategory[category];
        report += `| ${category} | ${stats.total} | ${stats.initialized} |\n`;
      }
      
      report += `\n### Components by Type\n\n`;
      report += `| Type | Total | Initialized |\n`;
      report += `| ---- | ----- | ----------- |\n`;
      
      for (const type in componentStatus.byType) {
        const stats = componentStatus.byType[type];
        report += `| ${type} | ${stats.total} | ${stats.initialized} |\n`;
      }
      
      report += `\n## Migration History\n\n`;
      
      for (const execution of this.migrationHistory) {
        report += `### Phase ${execution.phaseName} (${execution.phaseId})\n\n`;
        report += `**Status:** ${execution.status.toUpperCase()}\n`;
        report += `**Timestamp:** ${execution.timestamp}\n`;
        report += `**Duration:** ${execution.duration}ms\n`;
        
        if (execution.validationResults) {
          report += `**Success Rate:** ${(execution.validationResults.passRate * 100).toFixed(2)}%\n`;
          report += `**Tests:** ${execution.validationResults.totalTests} total, ${execution.validationResults.passedTests} passed, ${execution.validationResults.failedTests} failed\n`;
        }
        
        if (execution.rollback) {
          report += `**Rollback:** Yes\n`;
        }
        
        if (execution.error) {
          report += `**Error:** ${execution.error}\n`;
        }
        
        report += `\n`;
      }
      
      report += `## Conclusion\n\n`;
      
      if (progress.progress === 1) {
        report += `✅ **Migration completed successfully.**\n\n`;
        report += `All phases have been completed, and the system has been fully migrated to the new architecture.\n\n`;
      } else {
        report += `⏳ **Migration in progress.**\n\n`;
        report += `${progress.completedPhases} out of ${progress.totalPhases} phases have been completed.\n`;
        report += `Current phase: ${progress.currentPhaseName || "None"}\n\n`;
      }
      
      fs.writeFileSync(reportPath, report);
      
      this.logger.info(`Migration report written to: ${reportPath}`);
      return reportPath;
    } catch (error) {
      this.logger.error(`Failed to generate migration report: ${error.message}`, error);
      return null;
    }
  }
}

module.exports = MigrationStrategy;
