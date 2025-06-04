/**
 * @fileoverview Performance Monitor for Learning from Demonstration.
 * Tracks execution metrics for workflows.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Monitors performance of workflow executions.
 */
class PerformanceMonitor {
  /**
   * Constructor for PerformanceMonitor.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   * @param {Object} options.telemetryService Telemetry service for metrics
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for PerformanceMonitor");
    if (!options.logger) throw new Error("Logger is required for PerformanceMonitor");
    if (!options.configService) throw new Error("ConfigService is required for PerformanceMonitor");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for PerformanceMonitor");
    if (!options.telemetryService) throw new Error("TelemetryService is required for PerformanceMonitor");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.telemetryService = options.telemetryService;
    
    // Initialize performance data store
    this.performanceData = new Map();
    
    // Initialize aggregated metrics
    this.aggregatedMetrics = {
      workflowExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      workflowMetrics: new Map()
    };
    
    this.logger.info("PerformanceMonitor created");
  }
  
  /**
   * Start monitoring a workflow execution.
   * @param {string} workflowId ID of the workflow
   * @param {Object} context Execution context
   * @returns {string} Execution ID
   */
  startExecution(workflowId, context = {}) {
    if (!workflowId) {
      throw new Error("Workflow ID is required to start monitoring");
    }
    
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    this.logger.info(`Starting performance monitoring for workflow: ${workflowId}, execution: ${executionId}`);
    
    // Initialize execution data
    const executionData = {
      id: executionId,
      workflowId: workflowId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'running',
      steps: [],
      context: { ...context },
      metrics: {
        cpuUsage: [],
        memoryUsage: [],
        stepDurations: []
      }
    };
    
    // Store execution data
    this.performanceData.set(executionId, executionData);
    
    // Start collecting system metrics
    this._startCollectingSystemMetrics(executionId);
    
    return executionId;
  }
  
  /**
   * Record a step execution.
   * @param {string} executionId ID of the execution
   * @param {string} stepId ID of the step
   * @param {Object} stepData Step execution data
   * @returns {Promise<void>}
   */
  async recordStepExecution(executionId, stepId, stepData = {}) {
    if (!executionId || !stepId) {
      throw new Error("Execution ID and Step ID are required to record step execution");
    }
    
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData) {
      throw new Error(`No execution found with ID: ${executionId}`);
    }
    
    this.logger.info(`Recording step execution for workflow: ${executionData.workflowId}, execution: ${executionId}, step: ${stepId}`);
    
    try {
      // Create step record
      const stepRecord = {
        id: stepId,
        startTime: stepData.startTime || Date.now(),
        endTime: stepData.endTime || Date.now(),
        duration: stepData.duration || (stepData.endTime ? stepData.endTime - stepData.startTime : 0),
        status: stepData.status || 'completed',
        error: stepData.error || null,
        metrics: stepData.metrics || {}
      };
      
      // Add to execution data
      executionData.steps.push(stepRecord);
      
      // Add to step durations
      executionData.metrics.stepDurations.push({
        stepId: stepId,
        duration: stepRecord.duration
      });
      
      // Update execution data
      this.performanceData.set(executionId, executionData);
      
      // Send telemetry
      await this._sendStepTelemetry(executionData, stepRecord);
    } catch (error) {
      this.logger.error(`Error recording step execution: ${error.message}`, { error, executionId, stepId });
    }
  }
  
  /**
   * End monitoring a workflow execution.
   * @param {string} executionId ID of the execution
   * @param {Object} result Execution result
   * @returns {Promise<Object>} Execution performance data
   */
  async endExecution(executionId, result = {}) {
    if (!executionId) {
      throw new Error("Execution ID is required to end monitoring");
    }
    
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData) {
      throw new Error(`No execution found with ID: ${executionId}`);
    }
    
    this.logger.info(`Ending performance monitoring for workflow: ${executionData.workflowId}, execution: ${executionId}`);
    
    try {
      // Update execution data
      executionData.endTime = Date.now();
      executionData.duration = executionData.endTime - executionData.startTime;
      executionData.status = result.status || (result.success ? 'completed' : 'failed');
      executionData.result = result;
      
      // Stop collecting system metrics
      this._stopCollectingSystemMetrics(executionId);
      
      // Update execution data
      this.performanceData.set(executionId, executionData);
      
      // Update aggregated metrics
      this._updateAggregatedMetrics(executionData);
      
      // Store in knowledge graph
      await this._storeExecutionInKnowledgeGraph(executionData);
      
      // Send telemetry
      await this._sendExecutionTelemetry(executionData);
      
      return executionData;
    } catch (error) {
      this.logger.error(`Error ending execution monitoring: ${error.message}`, { error, executionId });
      
      // Try to salvage data
      executionData.endTime = Date.now();
      executionData.duration = executionData.endTime - executionData.startTime;
      executionData.status = 'error';
      executionData.error = error.message;
      
      this.performanceData.set(executionId, executionData);
      
      return executionData;
    }
  }
  
  /**
   * Get performance data for an execution.
   * @param {string} executionId ID of the execution
   * @returns {Object|null} Execution performance data
   */
  getExecutionData(executionId) {
    if (!executionId) {
      throw new Error("Execution ID is required to get performance data");
    }
    
    return this.performanceData.get(executionId) || null;
  }
  
  /**
   * Get aggregated metrics for all executions.
   * @param {Object} options Filter options
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics(options = {}) {
    // Apply filters if provided
    if (options.workflowId) {
      return this._getFilteredMetrics('workflowId', options.workflowId);
    }
    
    if (options.timeRange) {
      return this._getTimeRangeMetrics(options.timeRange.start, options.timeRange.end);
    }
    
    // Return all metrics
    return { ...this.aggregatedMetrics };
  }
  
  /**
   * Get performance report for a workflow.
   * @param {string} workflowId ID of the workflow
   * @returns {Promise<Object>} Performance report
   */
  async getWorkflowPerformanceReport(workflowId) {
    if (!workflowId) {
      throw new Error("Workflow ID is required to get performance report");
    }
    
    try {
      // Get all executions for this workflow
      const executions = Array.from(this.performanceData.values())
        .filter(execution => execution.workflowId === workflowId);
      
      if (executions.length === 0) {
        return {
          workflowId: workflowId,
          executionCount: 0,
          message: "No executions found for this workflow"
        };
      }
      
      // Calculate metrics
      const successfulExecutions = executions.filter(execution => execution.status === 'completed');
      const failedExecutions = executions.filter(execution => execution.status === 'failed' || execution.status === 'error');
      
      const totalExecutionTime = executions.reduce((total, execution) => total + (execution.duration || 0), 0);
      const averageExecutionTime = executions.length > 0 ? totalExecutionTime / executions.length : 0;
      
      // Get step performance
      const stepPerformance = this._calculateStepPerformance(executions);
      
      // Get system resource usage
      const resourceUsage = this._calculateResourceUsage(executions);
      
      // Create report
      const report = {
        workflowId: workflowId,
        executionCount: executions.length,
        successfulExecutions: successfulExecutions.length,
        failedExecutions: failedExecutions.length,
        successRate: executions.length > 0 ? (successfulExecutions.length / executions.length) * 100 : 0,
        totalExecutionTime: totalExecutionTime,
        averageExecutionTime: averageExecutionTime,
        fastestExecution: Math.min(...executions.map(execution => execution.duration || Infinity)),
        slowestExecution: Math.max(...executions.map(execution => execution.duration || 0)),
        stepPerformance: stepPerformance,
        resourceUsage: resourceUsage,
        lastExecution: executions.sort((a, b) => b.startTime - a.startTime)[0],
        timestamp: Date.now()
      };
      
      return report;
    } catch (error) {
      this.logger.error(`Error generating workflow performance report: ${error.message}`, { error, workflowId });
      throw error;
    }
  }
  
  /**
   * Start collecting system metrics for an execution.
   * @private
   * @param {string} executionId ID of the execution
   */
  _startCollectingSystemMetrics(executionId) {
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData) {
      return;
    }
    
    // Set up interval for collecting metrics
    const intervalMs = this.configService.get("lfd.performanceMonitoring.metricsIntervalMs", 1000);
    
    const intervalId = setInterval(async () => {
      try {
        // Get current execution data
        const currentData = this.performanceData.get(executionId);
        
        // Stop if execution is no longer running
        if (!currentData || currentData.status !== 'running') {
          clearInterval(intervalId);
          return;
        }
        
        // Collect CPU and memory metrics
        const metrics = await this._collectSystemMetrics();
        
        // Add to execution data
        currentData.metrics.cpuUsage.push({
          timestamp: Date.now(),
          value: metrics.cpuUsage
        });
        
        currentData.metrics.memoryUsage.push({
          timestamp: Date.now(),
          value: metrics.memoryUsage
        });
        
        // Update execution data
        this.performanceData.set(executionId, currentData);
      } catch (error) {
        this.logger.error(`Error collecting system metrics: ${error.message}`, { error, executionId });
      }
    }, intervalMs);
    
    // Store interval ID for cleanup
    executionData.metricsIntervalId = intervalId;
    this.performanceData.set(executionId, executionData);
  }
  
  /**
   * Stop collecting system metrics for an execution.
   * @private
   * @param {string} executionId ID of the execution
   */
  _stopCollectingSystemMetrics(executionId) {
    const executionData = this.performanceData.get(executionId);
    
    if (!executionData || !executionData.metricsIntervalId) {
      return;
    }
    
    // Clear interval
    clearInterval(executionData.metricsIntervalId);
    
    // Remove interval ID
    delete executionData.metricsIntervalId;
    
    // Update execution data
    this.performanceData.set(executionId, executionData);
  }
  
  /**
   * Collect system metrics.
   * @private
   * @returns {Promise<Object>} System metrics
   */
  async _collectSystemMetrics() {
    try {
      // In a real implementation, this would use system APIs to get actual metrics
      // For this implementation, we'll use mock data
      
      // Get process info
      const processInfo = process.memoryUsage();
      
      return {
        cpuUsage: Math.random() * 10 + 5, // Mock CPU usage (5-15%)
        memoryUsage: processInfo.heapUsed / 1024 / 1024 // Heap used in MB
      };
    } catch (error) {
      this.logger.error(`Error collecting system metrics: ${error.message}`, { error });
      return {
        cpuUsage: 0,
        memoryUsage: 0
      };
    }
  }
  
  /**
   * Update aggregated metrics with new execution data.
   * @private
   * @param {Object} executionData Execution data
   */
  _updateAggregatedMetrics(executionData) {
    // Update global metrics
    this.aggregatedMetrics.workflowExecutions++;
    
    if (executionData.status === 'completed') {
      this.aggregatedMetrics.successfulExecutions++;
    } else if (executionData.status === 'failed' || executionData.status === 'error') {
      this.aggregatedMetrics.failedExecutions++;
    }
    
    this.aggregatedMetrics.totalExecutionTime += executionData.duration || 0;
    this.aggregatedMetrics.averageExecutionTime = this.aggregatedMetrics.totalExecutionTime / this.aggregatedMetrics.workflowExecutions;
    
    // Update workflow-specific metrics
    const workflowId = executionData.workflowId;
    
    if (!this.aggregatedMetrics.workflowMetrics.has(workflowId)) {
      this.aggregatedMetrics.workflowMetrics.set(workflowId, {
        workflowId: workflowId,
        executionCount: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0
      });
    }
    
    const workflowMetrics = this.aggregatedMetrics.workflowMetrics.get(workflowId);
    
    workflowMetrics.executionCount++;
    
    if (executionData.status === 'completed') {
      workflowMetrics.successfulExecutions++;
    } else if (executionData.status === 'failed' || executionData.status === 'error') {
      workflowMetrics.failedExecutions++;
    }
    
    workflowMetrics.totalExecutionTime += executionData.duration || 0;
    workflowMetrics.averageExecutionTime = workflowMetrics.totalExecutionTime / workflowMetrics.executionCount;
    
    this.aggregatedMetrics.workflowMetrics.set(workflowId, workflowMetrics);
  }
  
  /**
   * Get metrics filtered by a specific property.
   * @private
   * @param {string} property Property to filter by
   * @param {*} value Value to filter for
   * @returns {Object} Filtered metrics
   */
  _getFilteredMetrics(property, value) {
    // Filter executions
    const filteredExecutions = Array.from(this.performanceData.values())
      .filter(execution => execution[property] === value);
    
    if (filteredExecutions.length === 0) {
      return {
        workflowExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0
      };
    }
    
    // Calculate metrics
    const successfulExecutions = filteredExecutions.filter(execution => execution.status === 'completed');
    const failedExecutions = filteredExecutions.filter(execution => execution.status === 'failed' || execution.status === 'error');
    
    const totalExecutionTime = filteredExecutions.reduce((total, execution) => total + (execution.duration || 0), 0);
    const averageExecutionTime = filteredExecutions.length > 0 ? totalExecutionTime / filteredExecutions.length : 0;
    
    return {
      workflowExecutions: filteredExecutions.length,
      successfulExecutions: successfulExecutions.length,
      failedExecutions: failedExecutions.length,
      totalExecutionTime: totalExecutionTime,
      averageExecutionTime: averageExecutionTime,
      filterProperty: property,
      filterValue: value
    };
  }
  
  /**
   * Get metrics for a specific time range.
   * @private
   * @param {number} startTime Start timestamp
   * @param {number} endTime End timestamp
   * @returns {Object} Time-range metrics
   */
  _getTimeRangeMetrics(startTime, endTime) {
    // Filter executions
    const filteredExecutions = Array.from(this.performanceData.values())
      .filter(execution => execution.startTime >= startTime && execution.startTime <= endTime);
    
    if (filteredExecutions.length === 0) {
      return {
        workflowExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        timeRange: { startTime, endTime }
      };
    }
    
    // Calculate metrics
    const successfulExecutions = filteredExecutions.filter(execution => execution.status === 'completed');
    const failedExecutions = filteredExecutions.filter(execution => execution.status === 'failed' || execution.status === 'error');
    
    const totalExecutionTime = filteredExecutions.reduce((total, execution) => total + (execution.duration || 0), 0);
    const averageExecutionTime = filteredExecutions.length > 0 ? totalExecutionTime / filteredExecutions.length : 0;
    
    return {
      workflowExecutions: filteredExecutions.length,
      successfulExecutions: successfulExecutions.length,
      failedExecutions: failedExecutions.length,
      totalExecutionTime: totalExecutionTime,
      averageExecutionTime: averageExecutionTime,
      timeRange: { startTime, endTime }
    };
  }
  
  /**
   * Calculate step performance metrics.
   * @private
   * @param {Array<Object>} executions Execution data
   * @returns {Object} Step performance metrics
   */
  _calculateStepPerformance(executions) {
    // Group steps by ID
    const stepGroups = new Map();
    
    for (const execution of executions) {
      for (const step of execution.steps) {
        if (!stepGroups.has(step.id)) {
          stepGroups.set(step.id, []);
        }
        
        stepGroups.get(step.id).push(step);
      }
    }
    
    // Calculate metrics for each step
    const stepPerformance = {};
    
    for (const [stepId, steps] of stepGroups.entries()) {
      const successfulSteps = steps.filter(step => step.status === 'completed');
      const failedSteps = steps.filter(step => step.status === 'failed' || step.status === 'error');
      
      const totalDuration = steps.reduce((total, step) => total + (step.duration || 0), 0);
      const averageDuration = steps.length > 0 ? totalDuration / steps.length : 0;
      
      stepPerformance[stepId] = {
        executionCount: steps.length,
        successfulExecutions: successfulSteps.length,
        failedExecutions: failedSteps.length,
        successRate: steps.length > 0 ? (successfulSteps.length / steps.length) * 100 : 0,
        totalDuration: totalDuration,
        averageDuration: averageDuration,
        fastestExecution: Math.min(...steps.map(step => step.duration || Infinity)),
        slowestExecution: Math.max(...steps.map(step => step.duration || 0))
      };
    }
    
    return stepPerformance;
  }
  
  /**
   * Calculate resource usage metrics.
   * @private
   * @param {Array<Object>} executions Execution data
   * @returns {Object} Resource usage metrics
   */
  _calculateResourceUsage(executions) {
    // Initialize metrics
    let totalCpuSamples = 0;
    let totalCpuUsage = 0;
    let maxCpuUsage = 0;
    
    let totalMemorySamples = 0;
    let totalMemoryUsage = 0;
    let maxMemoryUsage = 0;
    
    // Process each execution
    for (const execution of executions) {
      // Process CPU metrics
      if (execution.metrics && execution.metrics.cpuUsage) {
        for (const sample of execution.metrics.cpuUsage) {
          totalCpuSamples++;
          totalCpuUsage += sample.value;
          maxCpuUsage = Math.max(maxCpuUsage, sample.value);
        }
      }
      
      // Process memory metrics
      if (execution.metrics && execution.metrics.memoryUsage) {
        for (const sample of execution.metrics.memoryUsage) {
          totalMemorySamples++;
          totalMemoryUsage += sample.value;
          maxMemoryUsage = Math.max(maxMemoryUsage, sample.value);
        }
      }
    }
    
    // Calculate averages
    const averageCpuUsage = totalCpuSamples > 0 ? totalCpuUsage / totalCpuSamples : 0;
    const averageMemoryUsage = totalMemorySamples > 0 ? totalMemoryUsage / totalMemorySamples : 0;
    
    return {
      cpu: {
        averageUsage: averageCpuUsage,
        maxUsage: maxCpuUsage,
        sampleCount: totalCpuSamples
      },
      memory: {
        averageUsage: averageMemoryUsage,
        maxUsage: maxMemoryUsage,
        sampleCount: totalMemorySamples
      }
    };
  }
  
  /**
   * Store execution data in knowledge graph.
   * @private
   * @param {Object} executionData Execution data
   * @returns {Promise<void>}
   */
  async _storeExecutionInKnowledgeGraph(executionData) {
    try {
      // Create execution node
      const executionNode = {
        type: 'WorkflowExecution',
        id: executionData.id,
        properties: {
          workflowId: executionData.workflowId,
          startTime: executionData.startTime,
          endTime: executionData.endTime,
          duration: executionData.duration,
          status: executionData.status,
          stepCount: executionData.steps.length
        }
      };
      
      await this.knowledgeGraphManager.addNode(executionNode);
      
      // Create relationship between workflow and execution
      const executionRelationship = {
        sourceType: 'Workflow',
        sourceId: executionData.workflowId,
        targetType: 'WorkflowExecution',
        targetId: executionData.id,
        type: 'HAS_EXECUTION',
        properties: {
          timestamp: executionData.startTime
        }
      };
      
      await this.knowledgeGraphManager.addRelationship(executionRelationship);
      
      // Store step data for significant steps (e.g., failed steps)
      for (const step of executionData.steps) {
        if (step.status === 'failed' || step.status === 'error') {
          // Create step node
          const stepNode = {
            type: 'ExecutionStep',
            id: `${executionData.id}_${step.id}`,
            properties: {
              stepId: step.id,
              executionId: executionData.id,
              startTime: step.startTime,
              endTime: step.endTime,
              duration: step.duration,
              status: step.status,
              error: step.error
            }
          };
          
          await this.knowledgeGraphManager.addNode(stepNode);
          
          // Create relationship between execution and step
          const stepRelationship = {
            sourceType: 'WorkflowExecution',
            sourceId: executionData.id,
            targetType: 'ExecutionStep',
            targetId: stepNode.id,
            type: 'HAS_STEP',
            properties: {
              timestamp: step.startTime
            }
          };
          
          await this.knowledgeGraphManager.addRelationship(stepRelationship);
        }
      }
    } catch (error) {
      this.logger.error(`Error storing execution in knowledge graph: ${error.message}`, { error, executionId: executionData.id });
    }
  }
  
  /**
   * Send execution telemetry.
   * @private
   * @param {Object} executionData Execution data
   * @returns {Promise<void>}
   */
  async _sendExecutionTelemetry(executionData) {
    try {
      // Create telemetry event
      const telemetryEvent = {
        eventType: 'workflow.execution',
        timestamp: Date.now(),
        data: {
          workflowId: executionData.workflowId,
          executionId: executionData.id,
          startTime: executionData.startTime,
          endTime: executionData.endTime,
          duration: executionData.duration,
          status: executionData.status,
          stepCount: executionData.steps.length,
          context: executionData.context
        }
      };
      
      // Send telemetry
      await this.telemetryService.sendEvent(telemetryEvent);
    } catch (error) {
      this.logger.error(`Error sending execution telemetry: ${error.message}`, { error, executionId: executionData.id });
    }
  }
  
  /**
   * Send step telemetry.
   * @private
   * @param {Object} executionData Execution data
   * @param {Object} stepRecord Step record
   * @returns {Promise<void>}
   */
  async _sendStepTelemetry(executionData, stepRecord) {
    try {
      // Only send telemetry for significant steps (e.g., failed steps)
      if (stepRecord.status !== 'failed' && stepRecord.status !== 'error') {
        return;
      }
      
      // Create telemetry event
      const telemetryEvent = {
        eventType: 'workflow.step',
        timestamp: Date.now(),
        data: {
          workflowId: executionData.workflowId,
          executionId: executionData.id,
          stepId: stepRecord.id,
          startTime: stepRecord.startTime,
          endTime: stepRecord.endTime,
          duration: stepRecord.duration,
          status: stepRecord.status,
          error: stepRecord.error
        }
      };
      
      // Send telemetry
      await this.telemetryService.sendEvent(telemetryEvent);
    } catch (error) {
      this.logger.error(`Error sending step telemetry: ${error.message}`, { error, executionId: executionData.id, stepId: stepRecord.id });
    }
  }
}

module.exports = PerformanceMonitor;
