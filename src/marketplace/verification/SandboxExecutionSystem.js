/**
 * @fileoverview Sandbox Execution System for the Aideon Tentacle Marketplace
 * 
 * This module provides functionality for executing tentacles in a secure sandbox
 * environment to observe their behavior, resource usage, and potential security issues.
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
const { spawn } = require('child_process');
const os = require('os');

/**
 * SandboxExecutionSystem class - Manages secure execution of tentacles
 */
class SandboxExecutionSystem {
  /**
   * Create a new SandboxExecutionSystem instance
   * @param {Object} options - Configuration options
   * @param {Object} options.containerManager - Reference to the container manager
   * @param {Object} options.resourceMonitor - Reference to the resource monitor
   * @param {Object} options.behaviorAnalyzer - Reference to the behavior analyzer
   * @param {string} options.storagePath - Path to store sandbox data
   */
  constructor(options = {}) {
    this.options = options;
    this.containerManager = options.containerManager;
    this.resourceMonitor = options.resourceMonitor;
    this.behaviorAnalyzer = options.behaviorAnalyzer;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'sandbox-data');
    this.logger = new Logger('SandboxExecutionSystem');
    this.events = new EventEmitter();
    this.activeSandboxes = new Map();
    this.executionResults = new Map();
    this.initialized = false;
    
    // Define resource limits
    this.resourceLimits = {
      cpu: options.cpuLimit || 1, // 1 CPU core
      memory: options.memoryLimit || 512, // 512 MB
      disk: options.diskLimit || 1024, // 1 GB
      network: options.networkLimit || true, // Enable network with restrictions
      timeout: options.timeout || 300 // 5 minutes
    };
    
    // Define test scenarios
    this.testScenarios = {
      initialization: {
        name: 'Initialization Test',
        description: 'Tests tentacle initialization process',
        steps: [
          { action: 'load', timeout: 10000 },
          { action: 'initialize', timeout: 30000 }
        ]
      },
      basic_functionality: {
        name: 'Basic Functionality Test',
        description: 'Tests basic tentacle functionality',
        steps: [
          { action: 'load', timeout: 10000 },
          { action: 'initialize', timeout: 30000 },
          { action: 'execute', method: 'getInfo', timeout: 10000 },
          { action: 'execute', method: 'getCapabilities', timeout: 10000 }
        ]
      },
      resource_usage: {
        name: 'Resource Usage Test',
        description: 'Tests tentacle resource usage under load',
        steps: [
          { action: 'load', timeout: 10000 },
          { action: 'initialize', timeout: 30000 },
          { action: 'stress', duration: 30000, timeout: 40000 },
          { action: 'monitor', duration: 30000 }
        ]
      },
      error_handling: {
        name: 'Error Handling Test',
        description: 'Tests tentacle error handling capabilities',
        steps: [
          { action: 'load', timeout: 10000 },
          { action: 'initialize', timeout: 30000 },
          { action: 'execute', method: 'handleError', args: ['test_error'], expectError: true, timeout: 10000 }
        ]
      },
      shutdown: {
        name: 'Shutdown Test',
        description: 'Tests tentacle shutdown process',
        steps: [
          { action: 'load', timeout: 10000 },
          { action: 'initialize', timeout: 30000 },
          { action: 'shutdown', timeout: 30000 }
        ]
      }
    };
  }

  /**
   * Initialize the sandbox execution system
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('SandboxExecutionSystem already initialized');
      return true;
    }

    this.logger.info('Initializing SandboxExecutionSystem');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'sandboxes'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'results'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'logs'), { recursive: true });
      
      // Initialize container manager if available
      if (this.containerManager) {
        await this.containerManager.initialize();
      } else {
        this.logger.warn('ContainerManager not provided, using built-in sandbox');
        this.containerManager = this._createBuiltInContainerManager();
      }
      
      // Initialize resource monitor if available
      if (this.resourceMonitor) {
        await this.resourceMonitor.initialize();
      } else {
        this.logger.warn('ResourceMonitor not provided, using built-in monitor');
        this.resourceMonitor = this._createBuiltInResourceMonitor();
      }
      
      // Initialize behavior analyzer if available
      if (this.behaviorAnalyzer) {
        await this.behaviorAnalyzer.initialize();
      } else {
        this.logger.warn('BehaviorAnalyzer not provided, using built-in analyzer');
        this.behaviorAnalyzer = this._createBuiltInBehaviorAnalyzer();
      }
      
      this.initialized = true;
      this.logger.info('SandboxExecutionSystem initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize SandboxExecutionSystem', error);
      throw error;
    }
  }

  /**
   * Create a built-in container manager
   * @returns {Object} - Built-in container manager
   * @private
   */
  _createBuiltInContainerManager() {
    return {
      name: 'BuiltInContainerManager',
      description: 'Basic built-in container manager for tentacle sandboxing',
      
      initialize: async () => {
        return true;
      },
      
      createContainer: async (options) => {
        const containerId = `container_${crypto.randomBytes(8).toString('hex')}`;
        
        // Create container directory
        const containerDir = path.join(this.storagePath, 'sandboxes', containerId);
        await fs.mkdir(containerDir, { recursive: true });
        
        // Copy tentacle package to container directory
        if (options.packagePath) {
          await this._copyDirectory(options.packagePath, path.join(containerDir, 'package'));
        }
        
        return {
          id: containerId,
          path: containerDir,
          status: 'created',
          createdAt: new Date().toISOString()
        };
      },
      
      startContainer: async (containerId) => {
        const containerDir = path.join(this.storagePath, 'sandboxes', containerId);
        
        return {
          id: containerId,
          path: containerDir,
          status: 'running',
          startedAt: new Date().toISOString()
        };
      },
      
      stopContainer: async (containerId) => {
        return {
          id: containerId,
          status: 'stopped',
          stoppedAt: new Date().toISOString()
        };
      },
      
      removeContainer: async (containerId) => {
        const containerDir = path.join(this.storagePath, 'sandboxes', containerId);
        
        try {
          await fs.rm(containerDir, { recursive: true, force: true });
        } catch (error) {
          this.logger.error(`Failed to remove container directory: ${containerDir}`, error);
        }
        
        return {
          id: containerId,
          status: 'removed',
          removedAt: new Date().toISOString()
        };
      },
      
      executeCommand: async (containerId, command, options = {}) => {
        const containerDir = path.join(this.storagePath, 'sandboxes', containerId);
        
        try {
          const { stdout, stderr } = await exec(command, {
            cwd: containerDir,
            timeout: options.timeout || 30000
          });
          
          return {
            exitCode: 0,
            stdout,
            stderr,
            success: true
          };
        } catch (error) {
          return {
            exitCode: error.code || 1,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            success: false,
            error: error.message
          };
        }
      },
      
      shutdown: async () => {
        return true;
      }
    };
  }

  /**
   * Create a built-in resource monitor
   * @returns {Object} - Built-in resource monitor
   * @private
   */
  _createBuiltInResourceMonitor() {
    return {
      name: 'BuiltInResourceMonitor',
      description: 'Basic built-in resource monitor for tentacle sandboxing',
      
      initialize: async () => {
        return true;
      },
      
      startMonitoring: async (containerId) => {
        return {
          id: containerId,
          status: 'monitoring',
          startedAt: new Date().toISOString()
        };
      },
      
      stopMonitoring: async (containerId) => {
        return {
          id: containerId,
          status: 'stopped',
          stoppedAt: new Date().toISOString()
        };
      },
      
      getResourceUsage: async (containerId) => {
        // Generate mock resource usage data
        return {
          cpu: Math.floor(Math.random() * 100),
          memory: Math.floor(Math.random() * 100),
          disk: Math.floor(Math.random() * 100),
          network: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString()
        };
      },
      
      getResourceHistory: async (containerId, duration) => {
        // Generate mock resource history data
        const history = [];
        const now = Date.now();
        const interval = duration / 10;
        
        for (let i = 0; i < 10; i++) {
          history.push({
            cpu: Math.floor(Math.random() * 100),
            memory: Math.floor(Math.random() * 100),
            disk: Math.floor(Math.random() * 100),
            network: Math.floor(Math.random() * 100),
            timestamp: new Date(now - (interval * i)).toISOString()
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
   * Create a built-in behavior analyzer
   * @returns {Object} - Built-in behavior analyzer
   * @private
   */
  _createBuiltInBehaviorAnalyzer() {
    return {
      name: 'BuiltInBehaviorAnalyzer',
      description: 'Basic built-in behavior analyzer for tentacle sandboxing',
      
      initialize: async () => {
        return true;
      },
      
      analyzeBehavior: async (containerId, logs) => {
        // Mock behavior analysis
        const apiCalls = [];
        const fileSystemAccess = [];
        const networkActivity = [];
        const suspiciousBehaviors = [];
        
        // Generate mock API calls
        for (let i = 0; i < Math.floor(Math.random() * 10) + 5; i++) {
          apiCalls.push({
            api: `aideon.api.${['core', 'ui', 'data', 'network'][Math.floor(Math.random() * 4)]}.${['get', 'set', 'create', 'delete'][Math.floor(Math.random() * 4)]}`,
            args: ['arg1', 'arg2'],
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString()
          });
        }
        
        // Generate mock file system access
        for (let i = 0; i < Math.floor(Math.random() * 5) + 2; i++) {
          fileSystemAccess.push({
            operation: ['read', 'write', 'delete'][Math.floor(Math.random() * 3)],
            path: `/path/to/file${i}.txt`,
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString()
          });
        }
        
        // Generate mock network activity
        for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
          networkActivity.push({
            type: ['http', 'https', 'ws'][Math.floor(Math.random() * 3)],
            url: `https://api.example.com/endpoint${i}`,
            method: ['GET', 'POST'][Math.floor(Math.random() * 2)],
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString()
          });
        }
        
        // 10% chance of suspicious behavior
        if (Math.random() < 0.1) {
          suspiciousBehaviors.push({
            type: 'excessive_resource_usage',
            description: 'Tentacle is using excessive CPU resources',
            severity: 'medium',
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString(),
            recommendation: 'Optimize CPU usage in the tentacle'
          });
        }
        
        // 5% chance of another suspicious behavior
        if (Math.random() < 0.05) {
          suspiciousBehaviors.push({
            type: 'unauthorized_network_access',
            description: 'Tentacle is attempting to access unauthorized network resources',
            severity: 'high',
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString(),
            recommendation: 'Remove unauthorized network access attempts'
          });
        }
        
        return {
          apiUsage: apiCalls,
          fileSystemAccess,
          networkActivity,
          suspiciousBehaviors,
          timestamp: new Date().toISOString()
        };
      },
      
      shutdown: async () => {
        return true;
      }
    };
  }

  /**
   * Copy a directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   * @returns {Promise<void>}
   * @private
   */
  async _copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this._copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Create a sandbox for a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {string} packagePath - Path to the tentacle package
   * @returns {Promise<string>} - Promise resolving to the sandbox ID
   */
  async createSandbox(tentacleId, packagePath) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    this.logger.info(`Creating sandbox for tentacle: ${tentacleId}`);
    
    try {
      // Generate sandbox ID
      const sandboxId = `sandbox_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create container
      const container = await this.containerManager.createContainer({
        tentacleId,
        packagePath,
        resourceLimits: this.resourceLimits
      });
      
      // Store sandbox information
      const sandbox = {
        id: sandboxId,
        tentacleId,
        containerId: container.id,
        packagePath,
        status: 'created',
        createdAt: new Date().toISOString(),
        logs: []
      };
      
      this.activeSandboxes.set(sandboxId, sandbox);
      
      // Save sandbox information to file
      await this._saveSandboxInfo(sandboxId, sandbox);
      
      // Emit event
      this.events.emit('sandbox:created', { sandbox });
      
      return sandboxId;
    } catch (error) {
      this.logger.error(`Failed to create sandbox for tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Save sandbox information to file
   * @param {string} sandboxId - Sandbox ID
   * @param {Object} sandbox - Sandbox information
   * @returns {Promise<void>}
   * @private
   */
  async _saveSandboxInfo(sandboxId, sandbox) {
    const sandboxPath = path.join(this.storagePath, 'sandboxes', `${sandboxId}.json`);
    
    await fs.writeFile(sandboxPath, JSON.stringify(sandbox, null, 2));
  }

  /**
   * Execute a tentacle in a sandbox
   * @param {string} sandboxId - Sandbox ID
   * @param {string} testScenario - Test scenario to execute
   * @returns {Promise<Object>} - Promise resolving to execution results
   */
  async executeTentacle(sandboxId, testScenario) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    this.logger.info(`Executing tentacle in sandbox: ${sandboxId}, scenario: ${testScenario}`);
    
    // Get sandbox information
    const sandbox = this.activeSandboxes.get(sandboxId);
    
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }
    
    // Get test scenario
    const scenario = this.testScenarios[testScenario];
    
    if (!scenario) {
      throw new Error(`Test scenario ${testScenario} not found`);
    }
    
    try {
      // Start container if not already running
      if (sandbox.status !== 'running') {
        await this.containerManager.startContainer(sandbox.containerId);
        
        // Update sandbox status
        sandbox.status = 'running';
        sandbox.startedAt = new Date().toISOString();
        
        // Save updated sandbox information
        await this._saveSandboxInfo(sandboxId, sandbox);
      }
      
      // Execute test scenario steps
      const stepResults = [];
      let passed = true;
      
      for (const step of scenario.steps) {
        const stepResult = await this._executeScenarioStep(sandbox, step);
        stepResults.push(stepResult);
        
        if (!stepResult.passed) {
          passed = false;
          break;
        }
      }
      
      // Create execution results
      const executionResults = {
        sandboxId,
        tentacleId: sandbox.tentacleId,
        scenario: testScenario,
        passed,
        stepResults,
        timestamp: new Date().toISOString()
      };
      
      // Store execution results
      this.executionResults.set(`${sandboxId}_${testScenario}`, executionResults);
      
      // Save execution results to file
      await this._saveExecutionResults(sandboxId, testScenario, executionResults);
      
      // Emit event
      this.events.emit('execution:completed', { 
        sandboxId,
        testScenario,
        executionResults
      });
      
      return executionResults;
    } catch (error) {
      this.logger.error(`Failed to execute tentacle in sandbox: ${sandboxId}`, error);
      
      // Create error execution results
      const errorResults = {
        sandboxId,
        tentacleId: sandbox.tentacleId,
        scenario: testScenario,
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      // Store execution results
      this.executionResults.set(`${sandboxId}_${testScenario}`, errorResults);
      
      // Save execution results to file
      await this._saveExecutionResults(sandboxId, testScenario, errorResults);
      
      // Emit event
      this.events.emit('execution:failed', { 
        sandboxId,
        testScenario,
        error
      });
      
      return errorResults;
    }
  }

  /**
   * Execute a scenario step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeScenarioStep(sandbox, step) {
    this.logger.info(`Executing step: ${step.action} in sandbox: ${sandbox.id}`);
    
    try {
      let result;
      
      switch (step.action) {
        case 'load':
          result = await this._executeLoadStep(sandbox, step);
          break;
        case 'initialize':
          result = await this._executeInitializeStep(sandbox, step);
          break;
        case 'execute':
          result = await this._executeMethodStep(sandbox, step);
          break;
        case 'stress':
          result = await this._executeStressStep(sandbox, step);
          break;
        case 'monitor':
          result = await this._executeMonitorStep(sandbox, step);
          break;
        case 'shutdown':
          result = await this._executeShutdownStep(sandbox, step);
          break;
        default:
          throw new Error(`Unknown step action: ${step.action}`);
      }
      
      return {
        action: step.action,
        passed: true,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to execute step: ${step.action} in sandbox: ${sandbox.id}`, error);
      
      // Check if error is expected
      if (step.expectError) {
        return {
          action: step.action,
          passed: true,
          expectedError: true,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        action: step.action,
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute load step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeLoadStep(sandbox, step) {
    // In a real implementation, this would load the tentacle module
    // For now, just simulate loading
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      loaded: true
    };
  }

  /**
   * Execute initialize step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeInitializeStep(sandbox, step) {
    // In a real implementation, this would initialize the tentacle
    // For now, just simulate initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      initialized: true
    };
  }

  /**
   * Execute method step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeMethodStep(sandbox, step) {
    // In a real implementation, this would execute a tentacle method
    // For now, just simulate method execution
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // If method is handleError and expectError is true, throw an error
    if (step.method === 'handleError' && step.expectError) {
      throw new Error('Expected error for testing');
    }
    
    return {
      method: step.method,
      args: step.args || [],
      result: {
        success: true,
        data: step.method === 'getInfo' ? {
          name: `Tentacle ${sandbox.tentacleId}`,
          version: '1.0.0',
          description: 'Test tentacle'
        } : step.method === 'getCapabilities' ? [
          'capability1',
          'capability2'
        ] : {}
      }
    };
  }

  /**
   * Execute stress step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeStressStep(sandbox, step) {
    // In a real implementation, this would stress test the tentacle
    // For now, just simulate stress testing
    await new Promise(resolve => setTimeout(resolve, step.duration || 5000));
    
    return {
      stressed: true,
      duration: step.duration || 5000
    };
  }

  /**
   * Execute monitor step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeMonitorStep(sandbox, step) {
    // Start monitoring
    await this.resourceMonitor.startMonitoring(sandbox.containerId);
    
    // Wait for monitoring duration
    await new Promise(resolve => setTimeout(resolve, step.duration || 5000));
    
    // Get resource usage
    const resourceUsage = await this.resourceMonitor.getResourceUsage(sandbox.containerId);
    
    // Stop monitoring
    await this.resourceMonitor.stopMonitoring(sandbox.containerId);
    
    return {
      monitored: true,
      duration: step.duration || 5000,
      resourceUsage
    };
  }

  /**
   * Execute shutdown step
   * @param {Object} sandbox - Sandbox information
   * @param {Object} step - Scenario step
   * @returns {Promise<Object>} - Promise resolving to step results
   * @private
   */
  async _executeShutdownStep(sandbox, step) {
    // In a real implementation, this would shutdown the tentacle
    // For now, just simulate shutdown
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      shutdown: true
    };
  }

  /**
   * Save execution results to file
   * @param {string} sandboxId - Sandbox ID
   * @param {string} testScenario - Test scenario
   * @param {Object} executionResults - Execution results
   * @returns {Promise<void>}
   * @private
   */
  async _saveExecutionResults(sandboxId, testScenario, executionResults) {
    const resultsPath = path.join(this.storagePath, 'results', `${sandboxId}_${testScenario}.json`);
    
    await fs.writeFile(resultsPath, JSON.stringify(executionResults, null, 2));
  }

  /**
   * Monitor execution of a tentacle
   * @param {string} sandboxId - Sandbox ID
   * @returns {Promise<Object>} - Promise resolving to monitoring results
   */
  async monitorExecution(sandboxId) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    this.logger.info(`Monitoring execution in sandbox: ${sandboxId}`);
    
    // Get sandbox information
    const sandbox = this.activeSandboxes.get(sandboxId);
    
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }
    
    try {
      // Start monitoring
      await this.resourceMonitor.startMonitoring(sandbox.containerId);
      
      // Wait for monitoring duration
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get resource usage
      const resourceUsage = await this.resourceMonitor.getResourceUsage(sandbox.containerId);
      
      // Get resource history
      const resourceHistory = await this.resourceMonitor.getResourceHistory(sandbox.containerId, 60000);
      
      // Stop monitoring
      await this.resourceMonitor.stopMonitoring(sandbox.containerId);
      
      // Create monitoring results
      const monitoringResults = {
        sandboxId,
        tentacleId: sandbox.tentacleId,
        resourceUsage,
        resourceHistory,
        timestamp: new Date().toISOString()
      };
      
      // Emit event
      this.events.emit('monitoring:completed', { 
        sandboxId,
        monitoringResults
      });
      
      return resourceUsage;
    } catch (error) {
      this.logger.error(`Failed to monitor execution in sandbox: ${sandboxId}`, error);
      throw error;
    }
  }

  /**
   * Analyze behavior of a tentacle
   * @param {string} tentacleId - ID of the tentacle
   * @param {Object} executionResults - Results from sandbox execution
   * @returns {Promise<Object>} - Promise resolving to behavior analysis results
   */
  async analyzeBehavior(tentacleId, executionResults) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    this.logger.info(`Analyzing behavior of tentacle: ${tentacleId}`);
    
    if (!executionResults || executionResults.error) {
      throw new Error(`No valid execution results for tentacle: ${tentacleId}`);
    }
    
    try {
      // Extract logs from execution results
      const logs = [];
      
      if (executionResults.stepResults) {
        for (const step of executionResults.stepResults) {
          logs.push({
            action: step.action,
            timestamp: step.timestamp,
            result: step.result
          });
        }
      }
      
      // Analyze behavior
      const behaviorResults = await this.behaviorAnalyzer.analyzeBehavior(
        executionResults.sandboxId,
        logs
      );
      
      // Emit event
      this.events.emit('behavior:analyzed', { 
        tentacleId,
        behaviorResults
      });
      
      return behaviorResults;
    } catch (error) {
      this.logger.error(`Failed to analyze behavior of tentacle: ${tentacleId}`, error);
      throw error;
    }
  }

  /**
   * Destroy a sandbox
   * @param {string} sandboxId - Sandbox ID
   * @returns {Promise<boolean>} - Promise resolving to true if destruction was successful
   */
  async destroySandbox(sandboxId) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    this.logger.info(`Destroying sandbox: ${sandboxId}`);
    
    // Get sandbox information
    const sandbox = this.activeSandboxes.get(sandboxId);
    
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }
    
    try {
      // Stop container if running
      if (sandbox.status === 'running') {
        await this.containerManager.stopContainer(sandbox.containerId);
      }
      
      // Remove container
      await this.containerManager.removeContainer(sandbox.containerId);
      
      // Update sandbox status
      sandbox.status = 'destroyed';
      sandbox.destroyedAt = new Date().toISOString();
      
      // Save updated sandbox information
      await this._saveSandboxInfo(sandboxId, sandbox);
      
      // Remove from active sandboxes
      this.activeSandboxes.delete(sandboxId);
      
      // Emit event
      this.events.emit('sandbox:destroyed', { sandbox });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to destroy sandbox: ${sandboxId}`, error);
      throw error;
    }
  }

  /**
   * Get execution results
   * @param {string} sandboxId - Sandbox ID
   * @param {string} testScenario - Test scenario
   * @returns {Promise<Object>} - Promise resolving to execution results
   */
  async getExecutionResults(sandboxId, testScenario) {
    if (!this.initialized) {
      throw new Error('SandboxExecutionSystem not initialized');
    }
    
    // Check if results are in memory
    const key = `${sandboxId}_${testScenario}`;
    
    if (this.executionResults.has(key)) {
      return this.executionResults.get(key);
    }
    
    // Try to load results from file
    const resultsPath = path.join(this.storagePath, 'results', `${key}.json`);
    
    try {
      const data = await fs.readFile(resultsPath, 'utf8');
      const results = JSON.parse(data);
      
      // Cache results in memory
      this.executionResults.set(key, results);
      
      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`No execution results found for sandbox: ${sandboxId}, scenario: ${testScenario}`);
      }
      
      throw error;
    }
  }

  /**
   * Get the status of the sandbox execution system
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeSandboxes: this.activeSandboxes.size,
      executionResults: this.executionResults.size,
      componentsStatus: {
        containerManager: this.containerManager ? 'available' : 'unavailable',
        resourceMonitor: this.resourceMonitor ? 'available' : 'unavailable',
        behaviorAnalyzer: this.behaviorAnalyzer ? 'available' : 'unavailable'
      }
    };
  }

  /**
   * Shutdown the sandbox execution system
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('SandboxExecutionSystem not initialized');
      return true;
    }
    
    this.logger.info('Shutting down SandboxExecutionSystem');
    
    // Destroy all active sandboxes
    for (const [sandboxId, sandbox] of this.activeSandboxes.entries()) {
      try {
        await this.destroySandbox(sandboxId);
      } catch (error) {
        this.logger.error(`Failed to destroy sandbox: ${sandboxId}`, error);
      }
    }
    
    // Shutdown components
    if (this.containerManager && typeof this.containerManager.shutdown === 'function') {
      await this.containerManager.shutdown();
    }
    
    if (this.resourceMonitor && typeof this.resourceMonitor.shutdown === 'function') {
      await this.resourceMonitor.shutdown();
    }
    
    if (this.behaviorAnalyzer && typeof this.behaviorAnalyzer.shutdown === 'function') {
      await this.behaviorAnalyzer.shutdown();
    }
    
    this.initialized = false;
    return true;
  }
}

module.exports = { SandboxExecutionSystem };
