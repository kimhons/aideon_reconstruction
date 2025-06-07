/**
 * @fileoverview Analytics Processing Engine for Analytics Dashboard
 * This service is responsible for processing analytics data
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');

/**
 * AnalyticsProcessingEngine class - Processes analytics data
 */
class AnalyticsProcessingEngine {
  /**
   * Create a new AnalyticsProcessingEngine instance
   * @param {Object} options - Configuration options
   * @param {Object} options.config - Processing configuration
   * @param {Object} options.analyticsStorage - Reference to AnalyticsStorage instance
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.analyticsStorage = options.analyticsStorage;
    this.logger = new Logger('AnalyticsProcessingEngine');
    
    // Default configuration
    this.config.batchSize = this.config.batchSize || 100;
    this.config.processingInterval = this.config.processingInterval || 60; // seconds
    this.config.aggregationTypes = this.config.aggregationTypes || [
      'userActivity', 'tentacleUsage', 'systemPerformance'
    ];
    
    this.processing = false;
    this.processingQueue = [];
    
    this.logger.info('AnalyticsProcessingEngine instance created');
  }
  
  /**
   * Initialize the AnalyticsProcessingEngine
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    this.logger.info('Initializing AnalyticsProcessingEngine');
    
    if (!this.analyticsStorage) {
      throw new Error('AnalyticsStorage reference is required for initialization');
    }
    
    // Set up processing interval
    this._setupProcessingInterval();
    
    this.processing = true;
    this.logger.info('AnalyticsProcessingEngine initialized');
    return true;
  }
  
  /**
   * Process analytics data
   * @param {Object} data - Data to process
   * @returns {Promise<boolean>} - Promise resolving to true if processing was successful
   */
  async processData(data) {
    if (!this.processing) {
      throw new Error('AnalyticsProcessingEngine not processing');
    }
    
    this.logger.debug(`Processing data of type: ${data.type}`);
    
    try {
      // Add data to processing queue
      this.processingQueue.push(data);
      
      // Process immediately if queue is full
      if (this.processingQueue.length >= this.config.batchSize) {
        await this._processQueue();
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to process data', error);
      throw error;
    }
  }
  
  /**
   * Generate insights from processed data
   * @param {Object} query - Query parameters
   * @param {string} query.type - Data type to query
   * @param {string} query.interval - Aggregation interval
   * @param {number} query.startTime - Start timestamp
   * @param {number} query.endTime - End timestamp
   * @returns {Promise<Object>} - Promise resolving to insights object
   */
  async generateInsights(query) {
    if (!this.processing) {
      throw new Error('AnalyticsProcessingEngine not processing');
    }
    
    this.logger.debug(`Generating insights for type: ${query.type}, interval: ${query.interval}`);
    
    try {
      // Query aggregated data
      const { results } = await this.analyticsStorage.queryAggregatedData(query);
      
      // Generate insights based on data type
      let insights = [];
      
      switch (query.type) {
        case 'userActivity':
          insights = this._generateUserActivityInsights(results);
          break;
        case 'tentacleUsage':
          insights = this._generateTentacleUsageInsights(results);
          break;
        case 'systemPerformance':
          insights = this._generateSystemPerformanceInsights(results);
          break;
        default:
          throw new Error(`Unsupported data type for insights: ${query.type}`);
      }
      
      return { insights };
    } catch (error) {
      this.logger.error('Failed to generate insights', error);
      throw error;
    }
  }
  
  /**
   * Set up processing interval
   * @private
   */
  _setupProcessingInterval() {
    // Set up periodic processing of queued data
    const intervalMs = this.config.processingInterval * 1000;
    
    this._processingInterval = setInterval(() => {
      if (this.processingQueue.length > 0) {
        this._processQueue().catch(error => {
          this.logger.error('Failed to process queue', error);
        });
      }
    }, intervalMs);
  }
  
  /**
   * Process queued data
   * @returns {Promise<boolean>} - Promise resolving to true if processing was successful
   * @private
   */
  async _processQueue() {
    this.logger.debug(`Processing queue with ${this.processingQueue.length} items`);
    
    try {
      // Get data from queue
      const dataToProcess = this.processingQueue.splice(0, this.config.batchSize);
      
      // Group data by type and interval
      const groupedData = this._groupDataByTypeAndInterval(dataToProcess);
      
      // Aggregate data for each group
      for (const [key, group] of Object.entries(groupedData)) {
        const [type, interval] = key.split(':');
        
        // Aggregate data
        const aggregatedData = this._aggregateData(type, interval, group);
        
        // Store aggregated data
        await this.analyticsStorage.storeAggregatedData(aggregatedData);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Failed to process queue', error);
      throw error;
    }
  }
  
  /**
   * Group data by type and interval
   * @param {Array} data - Data to group
   * @returns {Object} - Grouped data
   * @private
   */
  _groupDataByTypeAndInterval(data) {
    const groupedData = {};
    
    for (const item of data) {
      // Determine interval based on timestamp
      const interval = this._determineInterval(item.timestamp);
      
      // Create group key
      const key = `${item.type}:${interval}`;
      
      // Add item to group
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      
      groupedData[key].push(item);
    }
    
    return groupedData;
  }
  
  /**
   * Determine interval for timestamp
   * @param {number} timestamp - Timestamp to determine interval for
   * @returns {string} - Interval (hourly, daily, weekly, monthly)
   * @private
   */
  _determineInterval(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const dayOfWeek = date.getUTCDay();
    
    // Hourly: Round to the current hour
    const hourlyDate = new Date(date);
    hourlyDate.setUTCMinutes(0, 0, 0);
    
    // Daily: Round to the current day
    const dailyDate = new Date(date);
    dailyDate.setUTCHours(0, 0, 0, 0);
    
    // Weekly: Round to the current week (Sunday)
    const weeklyDate = new Date(date);
    weeklyDate.setUTCDate(day - dayOfWeek);
    weeklyDate.setUTCHours(0, 0, 0, 0);
    
    // Monthly: Round to the current month
    const monthlyDate = new Date(date);
    monthlyDate.setUTCDate(1);
    monthlyDate.setUTCHours(0, 0, 0, 0);
    
    return {
      hourly: hourlyDate.getTime(),
      daily: dailyDate.getTime(),
      weekly: weeklyDate.getTime(),
      monthly: monthlyDate.getTime()
    };
  }
  
  /**
   * Aggregate data for a group
   * @param {string} type - Data type
   * @param {string} interval - Aggregation interval
   * @param {Array} data - Data to aggregate
   * @returns {Object} - Aggregated data
   * @private
   */
  _aggregateData(type, interval, data) {
    this.logger.debug(`Aggregating data for type: ${type}, interval: ${interval}`);
    
    // Create aggregation object
    const aggregation = {
      type,
      interval,
      timestamp: parseInt(interval),
      data: {}
    };
    
    // Aggregate based on data type
    switch (type) {
      case 'userActivity':
        aggregation.data = this._aggregateUserActivity(data);
        break;
      case 'tentacleUsage':
        aggregation.data = this._aggregateTentacleUsage(data);
        break;
      case 'systemPerformance':
        aggregation.data = this._aggregateSystemPerformance(data);
        break;
      default:
        this.logger.warn(`Unsupported data type for aggregation: ${type}`);
        break;
    }
    
    return aggregation;
  }
  
  /**
   * Aggregate user activity data
   * @param {Array} data - User activity data to aggregate
   * @returns {Object} - Aggregated user activity data
   * @private
   */
  _aggregateUserActivity(data) {
    // Initialize aggregation
    const aggregation = {
      activeUsers: new Set(),
      pageViews: 0,
      tentacleViews: 0,
      tentacleDownloads: 0,
      searchQueries: 0,
      averageSessionDuration: 0,
      totalSessions: 0,
      totalSessionDuration: 0
    };
    
    // Aggregate data
    for (const item of data) {
      // Add user to active users
      if (item.data.userId) {
        aggregation.activeUsers.add(item.data.userId);
      }
      
      // Increment counters based on action
      switch (item.data.action) {
        case 'pageView':
          aggregation.pageViews++;
          break;
        case 'tentacleView':
          aggregation.tentacleViews++;
          break;
        case 'tentacleDownload':
          aggregation.tentacleDownloads++;
          break;
        case 'search':
          aggregation.searchQueries++;
          break;
        case 'session':
          aggregation.totalSessions++;
          aggregation.totalSessionDuration += item.data.duration || 0;
          break;
      }
    }
    
    // Calculate average session duration
    if (aggregation.totalSessions > 0) {
      aggregation.averageSessionDuration = aggregation.totalSessionDuration / aggregation.totalSessions;
    }
    
    // Convert Set to count
    aggregation.activeUsers = aggregation.activeUsers.size;
    
    return aggregation;
  }
  
  /**
   * Aggregate tentacle usage data
   * @param {Array} data - Tentacle usage data to aggregate
   * @returns {Object} - Aggregated tentacle usage data
   * @private
   */
  _aggregateTentacleUsage(data) {
    // Initialize aggregation
    const aggregation = {
      tentacleViews: {},
      tentacleDownloads: {},
      tentacleInstalls: {},
      tentacleUninstalls: {},
      tentacleExecutions: {},
      tentacleErrors: {},
      totalViews: 0,
      totalDownloads: 0,
      totalInstalls: 0,
      totalUninstalls: 0,
      totalExecutions: 0,
      totalErrors: 0
    };
    
    // Aggregate data
    for (const item of data) {
      const tentacleId = item.data.tentacleId;
      
      if (!tentacleId) {
        continue;
      }
      
      // Increment counters based on action
      switch (item.data.action) {
        case 'view':
          aggregation.tentacleViews[tentacleId] = (aggregation.tentacleViews[tentacleId] || 0) + 1;
          aggregation.totalViews++;
          break;
        case 'download':
          aggregation.tentacleDownloads[tentacleId] = (aggregation.tentacleDownloads[tentacleId] || 0) + 1;
          aggregation.totalDownloads++;
          break;
        case 'install':
          aggregation.tentacleInstalls[tentacleId] = (aggregation.tentacleInstalls[tentacleId] || 0) + 1;
          aggregation.totalInstalls++;
          break;
        case 'uninstall':
          aggregation.tentacleUninstalls[tentacleId] = (aggregation.tentacleUninstalls[tentacleId] || 0) + 1;
          aggregation.totalUninstalls++;
          break;
        case 'execute':
          aggregation.tentacleExecutions[tentacleId] = (aggregation.tentacleExecutions[tentacleId] || 0) + 1;
          aggregation.totalExecutions++;
          break;
        case 'error':
          aggregation.tentacleErrors[tentacleId] = (aggregation.tentacleErrors[tentacleId] || 0) + 1;
          aggregation.totalErrors++;
          break;
      }
    }
    
    return aggregation;
  }
  
  /**
   * Aggregate system performance data
   * @param {Array} data - System performance data to aggregate
   * @returns {Object} - Aggregated system performance data
   * @private
   */
  _aggregateSystemPerformance(data) {
    // Initialize aggregation
    const aggregation = {
      cpuUsage: {
        min: Infinity,
        max: -Infinity,
        avg: 0,
        total: 0,
        count: 0
      },
      memoryUsage: {
        min: Infinity,
        max: -Infinity,
        avg: 0,
        total: 0,
        count: 0
      },
      responseTime: {
        min: Infinity,
        max: -Infinity,
        avg: 0,
        total: 0,
        count: 0
      },
      requestsPerMinute: {
        min: Infinity,
        max: -Infinity,
        avg: 0,
        total: 0,
        count: 0
      },
      errors: {
        count: 0,
        byComponent: {}
      }
    };
    
    // Aggregate data
    for (const item of data) {
      // Handle error data
      if (item.data.error) {
        aggregation.errors.count++;
        
        const component = item.data.component || 'unknown';
        aggregation.errors.byComponent[component] = (aggregation.errors.byComponent[component] || 0) + 1;
        
        continue;
      }
      
      // Handle performance metrics
      if (item.data.cpuUsage !== undefined) {
        aggregation.cpuUsage.min = Math.min(aggregation.cpuUsage.min, item.data.cpuUsage);
        aggregation.cpuUsage.max = Math.max(aggregation.cpuUsage.max, item.data.cpuUsage);
        aggregation.cpuUsage.total += item.data.cpuUsage;
        aggregation.cpuUsage.count++;
      }
      
      if (item.data.memoryUsage !== undefined) {
        aggregation.memoryUsage.min = Math.min(aggregation.memoryUsage.min, item.data.memoryUsage);
        aggregation.memoryUsage.max = Math.max(aggregation.memoryUsage.max, item.data.memoryUsage);
        aggregation.memoryUsage.total += item.data.memoryUsage;
        aggregation.memoryUsage.count++;
      }
      
      if (item.data.responseTime !== undefined) {
        aggregation.responseTime.min = Math.min(aggregation.responseTime.min, item.data.responseTime);
        aggregation.responseTime.max = Math.max(aggregation.responseTime.max, item.data.responseTime);
        aggregation.responseTime.total += item.data.responseTime;
        aggregation.responseTime.count++;
      }
      
      if (item.data.requestsPerMinute !== undefined) {
        aggregation.requestsPerMinute.min = Math.min(aggregation.requestsPerMinute.min, item.data.requestsPerMinute);
        aggregation.requestsPerMinute.max = Math.max(aggregation.requestsPerMinute.max, item.data.requestsPerMinute);
        aggregation.requestsPerMinute.total += item.data.requestsPerMinute;
        aggregation.requestsPerMinute.count++;
      }
    }
    
    // Calculate averages
    if (aggregation.cpuUsage.count > 0) {
      aggregation.cpuUsage.avg = aggregation.cpuUsage.total / aggregation.cpuUsage.count;
    }
    
    if (aggregation.memoryUsage.count > 0) {
      aggregation.memoryUsage.avg = aggregation.memoryUsage.total / aggregation.memoryUsage.count;
    }
    
    if (aggregation.responseTime.count > 0) {
      aggregation.responseTime.avg = aggregation.responseTime.total / aggregation.responseTime.count;
    }
    
    if (aggregation.requestsPerMinute.count > 0) {
      aggregation.requestsPerMinute.avg = aggregation.requestsPerMinute.total / aggregation.requestsPerMinute.count;
    }
    
    // Handle edge cases
    if (aggregation.cpuUsage.min === Infinity) aggregation.cpuUsage.min = 0;
    if (aggregation.memoryUsage.min === Infinity) aggregation.memoryUsage.min = 0;
    if (aggregation.responseTime.min === Infinity) aggregation.responseTime.min = 0;
    if (aggregation.requestsPerMinute.min === Infinity) aggregation.requestsPerMinute.min = 0;
    
    return aggregation;
  }
  
  /**
   * Generate user activity insights
   * @param {Array} data - Aggregated user activity data
   * @returns {Array} - Insights
   * @private
   */
  _generateUserActivityInsights(data) {
    const insights = [];
    
    // Return empty insights if no data
    if (!data || data.length < 2) {
      return insights;
    }
    
    // Sort data by timestamp
    data.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get current and previous period data
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    // Calculate changes
    const activeUsersChange = this._calculatePercentageChange(
      previous.data.activeUsers,
      current.data.activeUsers
    );
    
    const pageViewsChange = this._calculatePercentageChange(
      previous.data.pageViews,
      current.data.pageViews
    );
    
    const tentacleViewsChange = this._calculatePercentageChange(
      previous.data.tentacleViews,
      current.data.tentacleViews
    );
    
    const tentacleDownloadsChange = this._calculatePercentageChange(
      previous.data.tentacleDownloads,
      current.data.tentacleDownloads
    );
    
    // Add insights
    insights.push({
      type: 'trend',
      metric: 'activeUsers',
      value: activeUsersChange.toFixed(1),
      description: `Active users ${activeUsersChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(activeUsersChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'pageViews',
      value: pageViewsChange.toFixed(1),
      description: `Page views ${pageViewsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(pageViewsChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'tentacleViews',
      value: tentacleViewsChange.toFixed(1),
      description: `Tentacle views ${tentacleViewsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(tentacleViewsChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'tentacleDownloads',
      value: tentacleDownloadsChange.toFixed(1),
      description: `Tentacle downloads ${tentacleDownloadsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(tentacleDownloadsChange).toFixed(1)}% over the period.`
    });
    
    // Add engagement insight
    const viewsToDownloadsRatio = current.data.tentacleViews > 0 
      ? (current.data.tentacleDownloads / current.data.tentacleViews) * 100 
      : 0;
    
    insights.push({
      type: 'engagement',
      metric: 'viewsToDownloadsRatio',
      value: viewsToDownloadsRatio.toFixed(1),
      description: `${viewsToDownloadsRatio.toFixed(1)}% of tentacle views resulted in downloads.`
    });
    
    return insights;
  }
  
  /**
   * Generate tentacle usage insights
   * @param {Array} data - Aggregated tentacle usage data
   * @returns {Array} - Insights
   * @private
   */
  _generateTentacleUsageInsights(data) {
    const insights = [];
    
    // Return empty insights if no data
    if (!data || data.length < 2) {
      return insights;
    }
    
    // Sort data by timestamp
    data.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get current and previous period data
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    // Calculate changes
    const totalViewsChange = this._calculatePercentageChange(
      previous.data.totalViews,
      current.data.totalViews
    );
    
    const totalDownloadsChange = this._calculatePercentageChange(
      previous.data.totalDownloads,
      current.data.totalDownloads
    );
    
    const totalInstallsChange = this._calculatePercentageChange(
      previous.data.totalInstalls,
      current.data.totalInstalls
    );
    
    const totalExecutionsChange = this._calculatePercentageChange(
      previous.data.totalExecutions,
      current.data.totalExecutions
    );
    
    // Add insights
    insights.push({
      type: 'trend',
      metric: 'totalViews',
      value: totalViewsChange.toFixed(1),
      description: `Tentacle views ${totalViewsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(totalViewsChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'totalDownloads',
      value: totalDownloadsChange.toFixed(1),
      description: `Tentacle downloads ${totalDownloadsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(totalDownloadsChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'totalInstalls',
      value: totalInstallsChange.toFixed(1),
      description: `Tentacle installs ${totalInstallsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(totalInstallsChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'totalExecutions',
      value: totalExecutionsChange.toFixed(1),
      description: `Tentacle executions ${totalExecutionsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(totalExecutionsChange).toFixed(1)}% over the period.`
    });
    
    // Find most popular tentacles
    const popularTentacles = this._findMostPopularTentacles(current.data);
    
    if (popularTentacles.length > 0) {
      insights.push({
        type: 'popular',
        metric: 'popularTentacles',
        value: popularTentacles,
        description: `The most popular tentacles are: ${popularTentacles.map(t => t.id).join(', ')}.`
      });
    }
    
    return insights;
  }
  
  /**
   * Generate system performance insights
   * @param {Array} data - Aggregated system performance data
   * @returns {Array} - Insights
   * @private
   */
  _generateSystemPerformanceInsights(data) {
    const insights = [];
    
    // Return empty insights if no data
    if (!data || data.length < 2) {
      return insights;
    }
    
    // Sort data by timestamp
    data.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get current and previous period data
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    
    // Calculate changes
    const cpuUsageChange = this._calculatePercentageChange(
      previous.data.cpuUsage.avg,
      current.data.cpuUsage.avg
    );
    
    const memoryUsageChange = this._calculatePercentageChange(
      previous.data.memoryUsage.avg,
      current.data.memoryUsage.avg
    );
    
    const responseTimeChange = this._calculatePercentageChange(
      previous.data.responseTime.avg,
      current.data.responseTime.avg
    );
    
    const requestsPerMinuteChange = this._calculatePercentageChange(
      previous.data.requestsPerMinute.avg,
      current.data.requestsPerMinute.avg
    );
    
    const errorsChange = this._calculatePercentageChange(
      previous.data.errors.count,
      current.data.errors.count
    );
    
    // Add insights
    insights.push({
      type: 'trend',
      metric: 'cpuUsage',
      value: cpuUsageChange.toFixed(1),
      description: `Average CPU usage ${cpuUsageChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(cpuUsageChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'memoryUsage',
      value: memoryUsageChange.toFixed(1),
      description: `Average memory usage ${memoryUsageChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(memoryUsageChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'responseTime',
      value: responseTimeChange.toFixed(1),
      description: `Average response time ${responseTimeChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(responseTimeChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'requestsPerMinute',
      value: requestsPerMinuteChange.toFixed(1),
      description: `Average requests per minute ${requestsPerMinuteChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(requestsPerMinuteChange).toFixed(1)}% over the period.`
    });
    
    insights.push({
      type: 'trend',
      metric: 'errors',
      value: errorsChange.toFixed(1),
      description: `Error count ${errorsChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(errorsChange).toFixed(1)}% over the period.`
    });
    
    // Add performance insight
    if (current.data.responseTime.avg > 500) {
      insights.push({
        type: 'alert',
        metric: 'responseTime',
        value: current.data.responseTime.avg.toFixed(1),
        description: `Average response time (${current.data.responseTime.avg.toFixed(1)}ms) is above the recommended threshold of 500ms.`
      });
    }
    
    return insights;
  }
  
  /**
   * Calculate percentage change between two values
   * @param {number} previous - Previous value
   * @param {number} current - Current value
   * @returns {number} - Percentage change
   * @private
   */
  _calculatePercentageChange(previous, current) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    
    return ((current - previous) / previous) * 100;
  }
  
  /**
   * Find most popular tentacles
   * @param {Object} data - Tentacle usage data
   * @returns {Array} - Most popular tentacles
   * @private
   */
  _findMostPopularTentacles(data) {
    const tentacles = [];
    
    // Combine views and downloads
    const tentacleIds = new Set([
      ...Object.keys(data.tentacleViews || {}),
      ...Object.keys(data.tentacleDownloads || {})
    ]);
    
    for (const id of tentacleIds) {
      const views = data.tentacleViews[id] || 0;
      const downloads = data.tentacleDownloads[id] || 0;
      const score = views + (downloads * 3); // Weight downloads more heavily
      
      tentacles.push({ id, views, downloads, score });
    }
    
    // Sort by score and take top 5
    return tentacles
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  
  /**
   * Get the status of the AnalyticsProcessingEngine
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      processing: this.processing,
      queueLength: this.processingQueue.length,
      batchSize: this.config.batchSize,
      processingInterval: this.config.processingInterval
    };
  }
  
  /**
   * Shutdown the AnalyticsProcessingEngine
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    this.logger.info('Shutting down AnalyticsProcessingEngine');
    
    // Clear processing interval
    if (this._processingInterval) {
      clearInterval(this._processingInterval);
      this._processingInterval = null;
    }
    
    // Process any remaining data in queue
    if (this.processingQueue.length > 0) {
      try {
        await this._processQueue();
      } catch (error) {
        this.logger.error('Failed to process remaining data during shutdown', error);
      }
    }
    
    this.processing = false;
    this.logger.info('AnalyticsProcessingEngine shutdown complete');
    return true;
  }
}

module.exports = { AnalyticsProcessingEngine };
