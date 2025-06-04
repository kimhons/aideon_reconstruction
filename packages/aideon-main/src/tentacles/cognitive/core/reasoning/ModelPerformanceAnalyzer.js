/**
 * @fileoverview Model Performance Analyzer for the Reasoning Engine.
 * 
 * This component provides comprehensive monitoring, analysis, and optimization
 * of all LLM adapters in the reasoning engine. It collects performance metrics,
 * conducts benchmarking, identifies bottlenecks, and provides recommendations
 * for optimization.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Model Performance Analyzer for the Reasoning Engine.
 */
class ModelPerformanceAnalyzer extends EventEmitter {
  /**
   * Constructor for ModelPerformanceAnalyzer.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.modelStrategyManager Model strategy manager
   * @param {Object} options.performanceMonitor Performance monitoring service
   * @param {Object} options.storageManager Storage manager for persisting analysis results
   */
  constructor(options) {
    super();
    
    // Validate required dependencies
    if (!options) throw new Error('Options are required for ModelPerformanceAnalyzer');
    if (!options.logger) throw new Error('Logger is required for ModelPerformanceAnalyzer');
    if (!options.configService) throw new Error('ConfigService is required for ModelPerformanceAnalyzer');
    if (!options.modelStrategyManager) throw new Error('ModelStrategyManager is required for ModelPerformanceAnalyzer');
    if (!options.performanceMonitor) throw new Error('PerformanceMonitor is required for ModelPerformanceAnalyzer');
    if (!options.storageManager) throw new Error('StorageManager is required for ModelPerformanceAnalyzer');
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.modelStrategyManager = options.modelStrategyManager;
    this.performanceMonitor = options.performanceMonitor;
    this.storageManager = options.storageManager;
    
    // Initialize analyzer state
    this.initialized = false;
    this.running = false;
    this.adapters = new Map();
    this.benchmarks = new Map();
    this.metrics = {
      adapterMetrics: {},
      benchmarkResults: {},
      optimizationRecommendations: [],
      lastAnalysisTimestamp: null,
      analysisHistory: []
    };
    this.config = null;
    this.analysisInterval = null;
    this.benchmarkTasks = [];
    
    // Bind methods to maintain context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.startAnalysis = this.startAnalysis.bind(this);
    this.stopAnalysis = this.stopAnalysis.bind(this);
    this.runBenchmark = this.runBenchmark.bind(this);
    this.getPerformanceReport = this.getPerformanceReport.bind(this);
    this.getOptimizationRecommendations = this.getOptimizationRecommendations.bind(this);
    this.getAdapterMetrics = this.getAdapterMetrics.bind(this);
    this.getBenchmarkResults = this.getBenchmarkResults.bind(this);
    this._collectAdapterMetrics = this._collectAdapterMetrics.bind(this);
    this._analyzeBenchmarkResults = this._analyzeBenchmarkResults.bind(this);
    this._generateOptimizationRecommendations = this._generateOptimizationRecommendations.bind(this);
    this._persistAnalysisResults = this._persistAnalysisResults.bind(this);
    this._loadAnalysisHistory = this._loadAnalysisHistory.bind(this);
    this._setupMetricsListeners = this._setupMetricsListeners.bind(this);
    this._runPeriodicAnalysis = this._runPeriodicAnalysis.bind(this);
    
    this.logger.info('ModelPerformanceAnalyzer created');
  }
  
  /**
   * Initialize the analyzer.
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    try {
      this.logger.info('Initializing ModelPerformanceAnalyzer');
      this.performanceMonitor.startTimer('modelPerformanceAnalyzer.initialize');
      
      // Load configuration
      this.config = await this.configService.getAnalyzerConfig();
      if (!this.config) {
        throw new Error('Failed to load configuration for ModelPerformanceAnalyzer');
      }
      
      // Get available adapters from model strategy manager
      const availableAdapters = await this.modelStrategyManager.getAvailableAdapters();
      for (const adapter of availableAdapters) {
        this.adapters.set(adapter.id, adapter);
      }
      
      // Initialize metrics for each adapter
      for (const [adapterId, adapter] of this.adapters.entries()) {
        this.metrics.adapterMetrics[adapterId] = {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatency: 0,
          cacheHits: 0,
          cacheMisses: 0,
          tokenUsage: {
            prompt: 0,
            completion: 0,
            total: 0
          },
          costEstimate: 0,
          requestsByType: {},
          requestsByModel: {},
          errorRates: {},
          lastUpdated: Date.now()
        };
      }
      
      // Load benchmark tasks
      this.benchmarkTasks = this.config.benchmarkTasks || [];
      
      // Initialize benchmarks
      for (const task of this.benchmarkTasks) {
        this.benchmarks.set(task.id, {
          task,
          results: {}
        });
      }
      
      // Load analysis history
      await this._loadAnalysisHistory();
      
      // Set up metrics listeners
      this._setupMetricsListeners();
      
      this.initialized = true;
      
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.initialize');
      this.logger.info('ModelPerformanceAnalyzer initialized successfully');
      
      return true;
    } catch (error) {
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.initialize');
      this.logger.error(`Failed to initialize ModelPerformanceAnalyzer: ${error.message}`, { error });
      this.initialized = false;
      
      // Emit initialization error event
      this.emit('error', {
        type: 'initialization',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Start periodic performance analysis.
   * @param {Object} [options] Analysis options
   * @param {number} [options.interval] Analysis interval in milliseconds
   * @returns {Promise<boolean>} True if analysis started successfully
   */
  async startAnalysis(options = {}) {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    if (this.running) {
      this.logger.warn('ModelPerformanceAnalyzer is already running');
      return true;
    }
    
    try {
      this.logger.info('Starting ModelPerformanceAnalyzer');
      
      // Set analysis interval
      const interval = options.interval || this.config.analysisInterval || 3600000; // 1 hour default
      
      // Run initial analysis
      await this._runPeriodicAnalysis();
      
      // Set up periodic analysis
      this.analysisInterval = setInterval(this._runPeriodicAnalysis, interval);
      
      this.running = true;
      this.logger.info(`ModelPerformanceAnalyzer started with interval: ${interval}ms`);
      
      // Emit started event
      this.emit('started', {
        timestamp: Date.now(),
        interval
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start ModelPerformanceAnalyzer: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'start',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Stop periodic performance analysis.
   * @returns {Promise<boolean>} True if analysis stopped successfully
   */
  async stopAnalysis() {
    if (!this.running) {
      this.logger.warn('ModelPerformanceAnalyzer is not running');
      return true;
    }
    
    try {
      this.logger.info('Stopping ModelPerformanceAnalyzer');
      
      // Clear analysis interval
      if (this.analysisInterval) {
        clearInterval(this.analysisInterval);
        this.analysisInterval = null;
      }
      
      this.running = false;
      this.logger.info('ModelPerformanceAnalyzer stopped');
      
      // Emit stopped event
      this.emit('stopped', {
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop ModelPerformanceAnalyzer: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'stop',
        message: error.message,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Run a benchmark on all adapters.
   * @param {Object} [options] Benchmark options
   * @param {string} [options.benchmarkId] Specific benchmark ID to run
   * @param {Array<string>} [options.adapterIds] Specific adapter IDs to benchmark
   * @returns {Promise<Object>} Benchmark results
   */
  async runBenchmark(options = {}) {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    try {
      this.logger.info('Running benchmark', { options });
      this.performanceMonitor.startTimer('modelPerformanceAnalyzer.runBenchmark');
      
      // Determine which benchmarks to run
      let benchmarksToRun = [];
      if (options.benchmarkId) {
        const benchmark = this.benchmarks.get(options.benchmarkId);
        if (!benchmark) {
          throw new Error(`Benchmark not found: ${options.benchmarkId}`);
        }
        benchmarksToRun.push(benchmark);
      } else {
        benchmarksToRun = Array.from(this.benchmarks.values());
      }
      
      // Determine which adapters to benchmark
      let adaptersToTest = [];
      if (options.adapterIds && options.adapterIds.length > 0) {
        for (const adapterId of options.adapterIds) {
          const adapter = this.adapters.get(adapterId);
          if (!adapter) {
            throw new Error(`Adapter not found: ${adapterId}`);
          }
          adaptersToTest.push(adapter);
        }
      } else {
        adaptersToTest = Array.from(this.adapters.values());
      }
      
      // Run benchmarks
      const results = {};
      
      for (const benchmark of benchmarksToRun) {
        results[benchmark.task.id] = {
          taskType: benchmark.task.type,
          description: benchmark.task.description,
          adapterResults: {}
        };
        
        for (const adapter of adaptersToTest) {
          this.logger.info(`Running benchmark ${benchmark.task.id} on adapter ${adapter.id}`);
          
          try {
            // Check if adapter is available
            const isAvailable = await adapter.isAvailable();
            if (!isAvailable) {
              this.logger.warn(`Adapter ${adapter.id} is not available, skipping benchmark`);
              results[benchmark.task.id].adapterResults[adapter.id] = {
                status: 'skipped',
                reason: 'Adapter not available'
              };
              continue;
            }
            
            // Run benchmark
            const startTime = Date.now();
            
            let response;
            if (benchmark.task.type === 'completion') {
              response = await adapter.generateCompletion({
                prompt: benchmark.task.data.prompt,
                parameters: benchmark.task.data.parameters,
                userId: 'benchmark',
                subscriptionTier: 'enterprise'
              });
            } else if (benchmark.task.type === 'reasoning') {
              response = await adapter.processTask({
                type: benchmark.task.data.reasoningType,
                data: benchmark.task.data.taskData,
                userId: 'benchmark',
                subscriptionTier: 'enterprise'
              });
            } else if (benchmark.task.type === 'embedding') {
              response = await adapter.generateEmbeddings({
                text: benchmark.task.data.text,
                parameters: benchmark.task.data.parameters,
                userId: 'benchmark',
                subscriptionTier: 'enterprise'
              });
            } else {
              throw new Error(`Unsupported benchmark task type: ${benchmark.task.type}`);
            }
            
            const duration = Date.now() - startTime;
            
            // Evaluate response
            const evaluation = this._evaluateBenchmarkResponse(benchmark.task, response);
            
            // Record results
            results[benchmark.task.id].adapterResults[adapter.id] = {
              status: 'success',
              duration,
              evaluation,
              tokenUsage: response.usage || {},
              timestamp: Date.now()
            };
            
            // Update benchmark results in metrics
            if (!this.metrics.benchmarkResults[benchmark.task.id]) {
              this.metrics.benchmarkResults[benchmark.task.id] = {};
            }
            this.metrics.benchmarkResults[benchmark.task.id][adapter.id] = results[benchmark.task.id].adapterResults[adapter.id];
            
          } catch (error) {
            this.logger.error(`Benchmark failed for adapter ${adapter.id}: ${error.message}`, { error });
            
            // Record error
            results[benchmark.task.id].adapterResults[adapter.id] = {
              status: 'error',
              error: error.message,
              timestamp: Date.now()
            };
            
            // Update benchmark results in metrics
            if (!this.metrics.benchmarkResults[benchmark.task.id]) {
              this.metrics.benchmarkResults[benchmark.task.id] = {};
            }
            this.metrics.benchmarkResults[benchmark.task.id][adapter.id] = results[benchmark.task.id].adapterResults[adapter.id];
          }
        }
      }
      
      // Analyze benchmark results
      await this._analyzeBenchmarkResults();
      
      // Generate optimization recommendations
      await this._generateOptimizationRecommendations();
      
      // Persist analysis results
      await this._persistAnalysisResults();
      
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.runBenchmark');
      this.logger.info('Benchmark completed');
      
      // Emit benchmark completed event
      this.emit('benchmarkCompleted', {
        timestamp: Date.now(),
        results
      });
      
      return results;
    } catch (error) {
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.runBenchmark');
      this.logger.error(`Failed to run benchmark: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'benchmark',
        message: error.message,
        error
      });
      
      throw error;
    }
  }
  
  /**
   * Get a comprehensive performance report.
   * @returns {Promise<Object>} Performance report
   */
  async getPerformanceReport() {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    try {
      this.logger.info('Generating performance report');
      
      // Collect latest metrics
      await this._collectAdapterMetrics();
      
      // Generate report
      const report = {
        timestamp: Date.now(),
        adapterMetrics: { ...this.metrics.adapterMetrics },
        benchmarkResults: { ...this.metrics.benchmarkResults },
        optimizationRecommendations: [...this.metrics.optimizationRecommendations],
        analysisHistory: this.metrics.analysisHistory.slice(-10), // Last 10 analyses
        summary: {
          totalAdapters: this.adapters.size,
          activeAdapters: 0,
          totalRequests: 0,
          averageSuccessRate: 0,
          averageLatency: 0,
          totalTokenUsage: 0,
          totalCostEstimate: 0
        }
      };
      
      // Calculate summary metrics
      let totalSuccessRate = 0;
      let totalLatency = 0;
      let adaptersWithRequests = 0;
      
      for (const [adapterId, metrics] of Object.entries(this.metrics.adapterMetrics)) {
        // Check if adapter is active (has processed requests)
        if (metrics.totalRequests > 0) {
          report.summary.activeAdapters++;
          report.summary.totalRequests += metrics.totalRequests;
          report.summary.totalTokenUsage += metrics.tokenUsage.total;
          report.summary.totalCostEstimate += metrics.costEstimate;
          
          // Calculate success rate and latency
          const successRate = metrics.totalRequests > 0 ? metrics.successfulRequests / metrics.totalRequests : 0;
          totalSuccessRate += successRate;
          totalLatency += metrics.averageLatency;
          adaptersWithRequests++;
        }
      }
      
      // Calculate averages
      report.summary.averageSuccessRate = adaptersWithRequests > 0 ? totalSuccessRate / adaptersWithRequests : 0;
      report.summary.averageLatency = adaptersWithRequests > 0 ? totalLatency / adaptersWithRequests : 0;
      
      // Add benchmark summary
      report.summary.benchmarks = {};
      for (const [benchmarkId, results] of Object.entries(this.metrics.benchmarkResults)) {
        report.summary.benchmarks[benchmarkId] = {
          bestPerformer: null,
          worstPerformer: null,
          averageDuration: 0
        };
        
        let bestScore = -Infinity;
        let worstScore = Infinity;
        let totalDuration = 0;
        let successfulAdapters = 0;
        
        for (const [adapterId, result] of Object.entries(results)) {
          if (result.status === 'success') {
            successfulAdapters++;
            totalDuration += result.duration;
            
            // Determine best and worst performers
            const score = result.evaluation.score;
            if (score > bestScore) {
              bestScore = score;
              report.summary.benchmarks[benchmarkId].bestPerformer = adapterId;
            }
            if (score < worstScore) {
              worstScore = score;
              report.summary.benchmarks[benchmarkId].worstPerformer = adapterId;
            }
          }
        }
        
        report.summary.benchmarks[benchmarkId].averageDuration = successfulAdapters > 0 ? totalDuration / successfulAdapters : 0;
      }
      
      this.logger.info('Performance report generated');
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate performance report: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get optimization recommendations for adapters.
   * @param {string} [adapterId] Specific adapter ID to get recommendations for
   * @returns {Promise<Array<Object>>} Optimization recommendations
   */
  async getOptimizationRecommendations(adapterId) {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    try {
      this.logger.info('Getting optimization recommendations', { adapterId });
      
      // Filter recommendations by adapter ID if provided
      if (adapterId) {
        return this.metrics.optimizationRecommendations.filter(rec => rec.adapterId === adapterId);
      }
      
      return [...this.metrics.optimizationRecommendations];
    } catch (error) {
      this.logger.error(`Failed to get optimization recommendations: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get metrics for a specific adapter.
   * @param {string} adapterId Adapter ID
   * @returns {Promise<Object>} Adapter metrics
   */
  async getAdapterMetrics(adapterId) {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    if (!adapterId) {
      throw new Error('Adapter ID is required');
    }
    
    try {
      this.logger.info('Getting adapter metrics', { adapterId });
      
      // Check if adapter exists
      if (!this.adapters.has(adapterId)) {
        throw new Error(`Adapter not found: ${adapterId}`);
      }
      
      // Get adapter metrics
      const metrics = this.metrics.adapterMetrics[adapterId];
      if (!metrics) {
        throw new Error(`Metrics not found for adapter: ${adapterId}`);
      }
      
      return { ...metrics };
    } catch (error) {
      this.logger.error(`Failed to get adapter metrics: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Get benchmark results.
   * @param {string} [benchmarkId] Specific benchmark ID to get results for
   * @returns {Promise<Object>} Benchmark results
   */
  async getBenchmarkResults(benchmarkId) {
    if (!this.initialized) {
      throw new Error('ModelPerformanceAnalyzer is not initialized');
    }
    
    try {
      this.logger.info('Getting benchmark results', { benchmarkId });
      
      // Get results for specific benchmark if provided
      if (benchmarkId) {
        const results = this.metrics.benchmarkResults[benchmarkId];
        if (!results) {
          throw new Error(`Benchmark results not found: ${benchmarkId}`);
        }
        return { [benchmarkId]: results };
      }
      
      return { ...this.metrics.benchmarkResults };
    } catch (error) {
      this.logger.error(`Failed to get benchmark results: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Shutdown the analyzer.
   * @returns {Promise<boolean>} True if shutdown was successful
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down ModelPerformanceAnalyzer');
      
      // Stop analysis if running
      if (this.running) {
        await this.stopAnalysis();
      }
      
      // Persist final analysis results
      await this._persistAnalysisResults();
      
      this.initialized = false;
      this.logger.info('ModelPerformanceAnalyzer shut down successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down ModelPerformanceAnalyzer: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Run periodic analysis.
   * @private
   * @returns {Promise<void>}
   */
  async _runPeriodicAnalysis() {
    try {
      this.logger.info('Running periodic analysis');
      this.performanceMonitor.startTimer('modelPerformanceAnalyzer.periodicAnalysis');
      
      // Collect adapter metrics
      await this._collectAdapterMetrics();
      
      // Run benchmarks if configured
      if (this.config.runBenchmarksOnAnalysis) {
        await this.runBenchmark();
      } else {
        // Just analyze existing benchmark results
        await this._analyzeBenchmarkResults();
      }
      
      // Generate optimization recommendations
      await this._generateOptimizationRecommendations();
      
      // Persist analysis results
      await this._persistAnalysisResults();
      
      // Update last analysis timestamp
      this.metrics.lastAnalysisTimestamp = Date.now();
      
      // Add to analysis history
      this.metrics.analysisHistory.push({
        timestamp: this.metrics.lastAnalysisTimestamp,
        adapterCount: this.adapters.size,
        totalRequests: Object.values(this.metrics.adapterMetrics).reduce((sum, metrics) => sum + metrics.totalRequests, 0),
        recommendationCount: this.metrics.optimizationRecommendations.length
      });
      
      // Limit history size
      if (this.metrics.analysisHistory.length > this.config.maxAnalysisHistorySize || 100) {
        this.metrics.analysisHistory = this.metrics.analysisHistory.slice(-this.config.maxAnalysisHistorySize || -100);
      }
      
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.periodicAnalysis');
      this.logger.info('Periodic analysis completed');
      
      // Emit analysis completed event
      this.emit('analysisCompleted', {
        timestamp: this.metrics.lastAnalysisTimestamp,
        recommendations: this.metrics.optimizationRecommendations.length
      });
    } catch (error) {
      this.performanceMonitor.stopTimer('modelPerformanceAnalyzer.periodicAnalysis');
      this.logger.error(`Periodic analysis failed: ${error.message}`, { error });
      
      // Emit error event
      this.emit('error', {
        type: 'analysis',
        message: error.message,
        error
      });
    }
  }
  
  /**
   * Collect metrics from all adapters.
   * @private
   * @returns {Promise<void>}
   */
  async _collectAdapterMetrics() {
    try {
      this.logger.info('Collecting adapter metrics');
      
      for (const [adapterId, adapter] of this.adapters.entries()) {
        try {
          // Check if adapter is available
          const isAvailable = await adapter.isAvailable();
          if (!isAvailable) {
            this.logger.warn(`Adapter ${adapterId} is not available, skipping metrics collection`);
            continue;
          }
          
          // Get adapter info with metrics
          const adapterInfo = adapter.getAdapterInfo();
          
          // Update metrics
          this.metrics.adapterMetrics[adapterId] = {
            totalRequests: adapterInfo.metrics.totalRequests || 0,
            successfulRequests: adapterInfo.metrics.successfulRequests || 0,
            failedRequests: adapterInfo.metrics.failedRequests || 0,
            averageLatency: adapterInfo.metrics.averageLatency || 0,
            cacheHits: adapterInfo.metrics.cacheHits || 0,
            cacheMisses: adapterInfo.metrics.cacheMisses || 0,
            tokenUsage: adapterInfo.metrics.tokenUsage || {
              prompt: 0,
              completion: 0,
              total: 0
            },
            costEstimate: adapterInfo.metrics.costEstimate || 0,
            requestsByType: adapterInfo.metrics.requestsByType || {},
            requestsByModel: adapterInfo.metrics.requestsByModel || {},
            errorRates: this._calculateErrorRates(adapterInfo.metrics),
            lastUpdated: Date.now()
          };
        } catch (error) {
          this.logger.error(`Failed to collect metrics for adapter ${adapterId}: ${error.message}`, { error });
        }
      }
      
      this.logger.info('Adapter metrics collected');
    } catch (error) {
      this.logger.error(`Failed to collect adapter metrics: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Calculate error rates from adapter metrics.
   * @private
   * @param {Object} metrics Adapter metrics
   * @returns {Object} Error rates
   */
  _calculateErrorRates(metrics) {
    const errorRates = {};
    
    // Overall error rate
    errorRates.overall = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;
    
    // Error rates by request type
    errorRates.byType = {};
    for (const [type, count] of Object.entries(metrics.requestsByType || {})) {
      // We don't have direct access to failures by type, so we estimate
      // This would be more accurate with actual failure counts by type
      errorRates.byType[type] = errorRates.overall;
    }
    
    return errorRates;
  }
  
  /**
   * Analyze benchmark results.
   * @private
   * @returns {Promise<void>}
   */
  async _analyzeBenchmarkResults() {
    try {
      this.logger.info('Analyzing benchmark results');
      
      // For each benchmark
      for (const [benchmarkId, results] of Object.entries(this.metrics.benchmarkResults)) {
        // Calculate performance metrics
        let bestPerformer = null;
        let bestScore = -Infinity;
        let worstPerformer = null;
        let worstScore = Infinity;
        let totalDuration = 0;
        let totalScore = 0;
        let successfulAdapters = 0;
        
        for (const [adapterId, result] of Object.entries(results)) {
          if (result.status === 'success') {
            successfulAdapters++;
            totalDuration += result.duration;
            totalScore += result.evaluation.score;
            
            // Determine best and worst performers
            if (result.evaluation.score > bestScore) {
              bestScore = result.evaluation.score;
              bestPerformer = adapterId;
            }
            if (result.evaluation.score < worstScore) {
              worstScore = result.evaluation.score;
              worstPerformer = adapterId;
            }
          }
        }
        
        // Update benchmark with analysis
        const benchmark = this.benchmarks.get(benchmarkId);
        if (benchmark) {
          benchmark.analysis = {
            bestPerformer,
            bestScore,
            worstPerformer,
            worstScore,
            averageDuration: successfulAdapters > 0 ? totalDuration / successfulAdapters : 0,
            averageScore: successfulAdapters > 0 ? totalScore / successfulAdapters : 0,
            successfulAdapters,
            totalAdapters: Object.keys(results).length,
            timestamp: Date.now()
          };
        }
      }
      
      this.logger.info('Benchmark results analyzed');
    } catch (error) {
      this.logger.error(`Failed to analyze benchmark results: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Generate optimization recommendations.
   * @private
   * @returns {Promise<void>}
   */
  async _generateOptimizationRecommendations() {
    try {
      this.logger.info('Generating optimization recommendations');
      
      // Clear previous recommendations
      this.metrics.optimizationRecommendations = [];
      
      // For each adapter
      for (const [adapterId, metrics] of Object.entries(this.metrics.adapterMetrics)) {
        // Check for high error rates
        if (metrics.errorRates.overall > this.config.errorRateThreshold || 0.1) {
          this.metrics.optimizationRecommendations.push({
            adapterId,
            type: 'error_rate',
            severity: 'high',
            description: `High error rate (${(metrics.errorRates.overall * 100).toFixed(2)}%) detected for ${adapterId}`,
            recommendation: 'Investigate error causes and implement error handling improvements',
            timestamp: Date.now()
          });
        }
        
        // Check for high latency
        if (metrics.averageLatency > this.config.latencyThreshold || 2000) {
          this.metrics.optimizationRecommendations.push({
            adapterId,
            type: 'latency',
            severity: 'medium',
            description: `High average latency (${metrics.averageLatency.toFixed(2)}ms) detected for ${adapterId}`,
            recommendation: 'Consider implementing caching or optimizing request parameters',
            timestamp: Date.now()
          });
        }
        
        // Check for low cache hit rate
        const totalCacheRequests = metrics.cacheHits + metrics.cacheMisses;
        const cacheHitRate = totalCacheRequests > 0 ? metrics.cacheHits / totalCacheRequests : 0;
        if (totalCacheRequests > 100 && cacheHitRate < this.config.cacheHitRateThreshold || 0.3) {
          this.metrics.optimizationRecommendations.push({
            adapterId,
            type: 'cache',
            severity: 'low',
            description: `Low cache hit rate (${(cacheHitRate * 100).toFixed(2)}%) detected for ${adapterId}`,
            recommendation: 'Review cache configuration and consider adjusting TTL or cache size',
            timestamp: Date.now()
          });
        }
        
        // Check benchmark performance
        for (const [benchmarkId, results] of Object.entries(this.metrics.benchmarkResults)) {
          const adapterResult = results[adapterId];
          if (adapterResult && adapterResult.status === 'success') {
            const benchmark = this.benchmarks.get(benchmarkId);
            if (benchmark && benchmark.analysis) {
              // Check if this adapter is significantly worse than the best performer
              if (adapterResult.evaluation.score < benchmark.analysis.bestScore * 0.7) {
                this.metrics.optimizationRecommendations.push({
                  adapterId,
                  type: 'benchmark_performance',
                  severity: 'medium',
                  description: `Suboptimal performance on benchmark ${benchmarkId} (score: ${adapterResult.evaluation.score.toFixed(2)} vs. best: ${benchmark.analysis.bestScore.toFixed(2)})`,
                  recommendation: 'Review prompt templates and parameter settings for this task type',
                  timestamp: Date.now()
                });
              }
              
              // Check if this adapter is significantly slower than average
              if (adapterResult.duration > benchmark.analysis.averageDuration * 1.5) {
                this.metrics.optimizationRecommendations.push({
                  adapterId,
                  type: 'benchmark_latency',
                  severity: 'low',
                  description: `Slow performance on benchmark ${benchmarkId} (${adapterResult.duration}ms vs. avg: ${benchmark.analysis.averageDuration.toFixed(2)}ms)`,
                  recommendation: 'Consider parameter tuning or model selection to improve response time',
                  timestamp: Date.now()
                });
              }
            }
          }
        }
        
        // Check token usage efficiency
        if (metrics.tokenUsage.total > 0) {
          const completionRatio = metrics.tokenUsage.completion / metrics.tokenUsage.total;
          if (completionRatio < this.config.tokenEfficiencyThreshold || 0.2) {
            this.metrics.optimizationRecommendations.push({
              adapterId,
              type: 'token_efficiency',
              severity: 'low',
              description: `Low completion-to-total token ratio (${(completionRatio * 100).toFixed(2)}%) detected for ${adapterId}`,
              recommendation: 'Consider optimizing prompts to be more concise while maintaining effectiveness',
              timestamp: Date.now()
            });
          }
        }
      }
      
      // Sort recommendations by severity
      this.metrics.optimizationRecommendations.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
      
      this.logger.info(`Generated ${this.metrics.optimizationRecommendations.length} optimization recommendations`);
    } catch (error) {
      this.logger.error(`Failed to generate optimization recommendations: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Evaluate benchmark response.
   * @private
   * @param {Object} task Benchmark task
   * @param {Object} response Adapter response
   * @returns {Object} Evaluation result
   */
  _evaluateBenchmarkResponse(task, response) {
    try {
      // Default evaluation
      const evaluation = {
        score: 0,
        metrics: {},
        details: {}
      };
      
      // Evaluate based on task type
      if (task.type === 'completion') {
        // For completion tasks, evaluate based on expected content and response time
        const content = response.text || '';
        
        // Check for expected content
        let contentScore = 0;
        if (task.evaluation && task.evaluation.expectedContent) {
          for (const expected of task.evaluation.expectedContent) {
            if (content.includes(expected)) {
              contentScore += 1 / task.evaluation.expectedContent.length;
            }
          }
        } else {
          // Default content score if no expected content specified
          contentScore = 0.7;
        }
        
        // Calculate response time score (lower is better)
        const maxAcceptableTime = task.evaluation?.maxAcceptableTime || 5000;
        const timeScore = Math.max(0, 1 - (response.duration || 0) / maxAcceptableTime);
        
        // Calculate token efficiency
        const tokenEfficiency = response.usage ? response.usage.completion_tokens / response.usage.total_tokens : 0.5;
        
        // Combine scores
        evaluation.score = contentScore * 0.7 + timeScore * 0.2 + tokenEfficiency * 0.1;
        evaluation.metrics = {
          contentScore,
          timeScore,
          tokenEfficiency
        };
        evaluation.details = {
          contentLength: content.length,
          duration: response.duration,
          tokenUsage: response.usage
        };
      } else if (task.type === 'reasoning') {
        // For reasoning tasks, evaluate based on correctness and reasoning quality
        
        // Check for expected conclusion or result
        let correctnessScore = 0;
        if (task.evaluation && task.evaluation.expectedConclusion) {
          const conclusion = response.conclusion || '';
          if (conclusion.includes(task.evaluation.expectedConclusion)) {
            correctnessScore = 1;
          } else {
            // Partial matching
            const words = task.evaluation.expectedConclusion.split(' ');
            let matchedWords = 0;
            for (const word of words) {
              if (conclusion.includes(word)) {
                matchedWords++;
              }
            }
            correctnessScore = matchedWords / words.length * 0.7; // Partial credit
          }
        } else {
          // Default correctness score if no expected conclusion specified
          correctnessScore = 0.7;
        }
        
        // Evaluate reasoning quality based on length and structure
        const reasoning = response.reasoning || '';
        const reasoningLength = reasoning.length;
        const reasoningScore = Math.min(1, reasoningLength / 500) * 0.8; // Longer reasoning up to a point is better
        
        // Calculate response time score (lower is better)
        const maxAcceptableTime = task.evaluation?.maxAcceptableTime || 8000;
        const timeScore = Math.max(0, 1 - (response.duration || 0) / maxAcceptableTime);
        
        // Combine scores
        evaluation.score = correctnessScore * 0.6 + reasoningScore * 0.3 + timeScore * 0.1;
        evaluation.metrics = {
          correctnessScore,
          reasoningScore,
          timeScore
        };
        evaluation.details = {
          reasoningLength,
          duration: response.duration,
          tokenUsage: response.usage
        };
      } else if (task.type === 'embedding') {
        // For embedding tasks, evaluate based on dimensionality and response time
        
        // Check embedding dimensions
        const embeddings = response.embeddings || [];
        const dimensions = embeddings.length > 0 ? embeddings[0].length : 0;
        const dimensionScore = dimensions > 0 ? 1 : 0;
        
        // Calculate response time score (lower is better)
        const maxAcceptableTime = task.evaluation?.maxAcceptableTime || 3000;
        const timeScore = Math.max(0, 1 - (response.duration || 0) / maxAcceptableTime);
        
        // Combine scores
        evaluation.score = dimensionScore * 0.8 + timeScore * 0.2;
        evaluation.metrics = {
          dimensionScore,
          timeScore
        };
        evaluation.details = {
          dimensions,
          embeddingCount: embeddings.length,
          duration: response.duration,
          tokenUsage: response.usage
        };
      }
      
      // Ensure score is between 0 and 1
      evaluation.score = Math.max(0, Math.min(1, evaluation.score));
      
      return evaluation;
    } catch (error) {
      this.logger.error(`Failed to evaluate benchmark response: ${error.message}`, { error });
      return {
        score: 0,
        metrics: {},
        details: {
          error: error.message
        }
      };
    }
  }
  
  /**
   * Persist analysis results to storage.
   * @private
   * @returns {Promise<void>}
   */
  async _persistAnalysisResults() {
    try {
      this.logger.info('Persisting analysis results');
      
      // Prepare data to persist
      const data = {
        timestamp: Date.now(),
        adapterMetrics: this.metrics.adapterMetrics,
        benchmarkResults: this.metrics.benchmarkResults,
        optimizationRecommendations: this.metrics.optimizationRecommendations,
        analysisHistory: this.metrics.analysisHistory
      };
      
      // Generate filename with timestamp
      const filename = `model_performance_analysis_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      // Persist to storage
      await this.storageManager.saveAnalysisResults('model_performance', filename, data);
      
      this.logger.info('Analysis results persisted successfully');
    } catch (error) {
      this.logger.error(`Failed to persist analysis results: ${error.message}`, { error });
      // Non-fatal error, continue without persisting
    }
  }
  
  /**
   * Load analysis history from storage.
   * @private
   * @returns {Promise<void>}
   */
  async _loadAnalysisHistory() {
    try {
      this.logger.info('Loading analysis history');
      
      // Get latest analysis file
      const files = await this.storageManager.listAnalysisResults('model_performance');
      if (files.length === 0) {
        this.logger.info('No previous analysis results found');
        return;
      }
      
      // Sort files by timestamp (newest first)
      files.sort((a, b) => b.timestamp - a.timestamp);
      
      // Load latest file
      const latestFile = files[0];
      const data = await this.storageManager.loadAnalysisResults('model_performance', latestFile.filename);
      
      // Update metrics with loaded data
      if (data && data.analysisHistory) {
        this.metrics.analysisHistory = data.analysisHistory;
        this.metrics.lastAnalysisTimestamp = data.timestamp;
        this.logger.info(`Loaded analysis history with ${data.analysisHistory.length} entries`);
      }
    } catch (error) {
      this.logger.error(`Failed to load analysis history: ${error.message}`, { error });
      // Non-fatal error, continue with empty history
    }
  }
  
  /**
   * Set up metrics listeners for adapters.
   * @private
   * @returns {void}
   */
  _setupMetricsListeners() {
    try {
      this.logger.info('Setting up metrics listeners');
      
      // For each adapter, listen for metrics events
      for (const [adapterId, adapter] of this.adapters.entries()) {
        if (adapter instanceof EventEmitter) {
          adapter.on('metrics', (metricsEvent) => {
            try {
              // Update real-time metrics
              const metrics = this.metrics.adapterMetrics[adapterId];
              if (metrics) {
                // Update request counts
                metrics.totalRequests++;
                if (metricsEvent.cached) {
                  metrics.cacheHits++;
                } else {
                  metrics.cacheMisses++;
                  
                  // Update latency metrics
                  const totalLatency = metrics.averageLatency * (metrics.totalRequests - 1) + metricsEvent.duration;
                  metrics.averageLatency = totalLatency / metrics.totalRequests;
                }
                
                // Update request type metrics
                if (!metrics.requestsByType[metricsEvent.type]) {
                  metrics.requestsByType[metricsEvent.type] = 0;
                }
                metrics.requestsByType[metricsEvent.type]++;
                
                // Update model metrics
                if (metricsEvent.model) {
                  if (!metrics.requestsByModel[metricsEvent.model]) {
                    metrics.requestsByModel[metricsEvent.model] = 0;
                  }
                  metrics.requestsByModel[metricsEvent.model]++;
                }
                
                // Update last updated timestamp
                metrics.lastUpdated = Date.now();
              }
            } catch (error) {
              this.logger.error(`Error processing metrics event from adapter ${adapterId}: ${error.message}`, { error });
            }
          });
          
          adapter.on('error', (errorEvent) => {
            try {
              // Update error metrics
              const metrics = this.metrics.adapterMetrics[adapterId];
              if (metrics) {
                metrics.failedRequests++;
                
                // Update last updated timestamp
                metrics.lastUpdated = Date.now();
              }
            } catch (error) {
              this.logger.error(`Error processing error event from adapter ${adapterId}: ${error.message}`, { error });
            }
          });
        }
      }
      
      this.logger.info('Metrics listeners set up successfully');
    } catch (error) {
      this.logger.error(`Failed to set up metrics listeners: ${error.message}`, { error });
      // Non-fatal error, continue without real-time metrics
    }
  }
}

module.exports = ModelPerformanceAnalyzer;
