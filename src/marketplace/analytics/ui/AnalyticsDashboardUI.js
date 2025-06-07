/**
 * @fileoverview Analytics Dashboard UI for Analytics Dashboard
 * This component is responsible for rendering the analytics dashboard UI
 * for the Aideon Tentacle Marketplace analytics dashboard.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');

/**
 * AnalyticsDashboardUI class - Renders analytics dashboard UI
 */
class AnalyticsDashboardUI {
  /**
   * Create a new AnalyticsDashboardUI instance
   * @param {Object} options - Configuration options
   * @param {Object} options.config - UI configuration
   * @param {Object} options.analyticsProcessingEngine - Reference to AnalyticsProcessingEngine instance
   * @param {HTMLElement} options.container - Container element for the dashboard
   */
  constructor(options = {}) {
    this.config = options.config || {};
    this.analyticsProcessingEngine = options.analyticsProcessingEngine;
    this.container = options.container;
    this.logger = new Logger('AnalyticsDashboardUI');
    
    // Default configuration
    this.config.defaultView = this.config.defaultView || 'overview';
    this.config.defaultTimeFrame = this.config.defaultTimeFrame || 'daily';
    this.config.refreshInterval = this.config.refreshInterval || 30; // seconds
    
    this.currentView = this.config.defaultView;
    this.currentTimeFrame = this.config.defaultTimeFrame;
    
    this.initialized = false;
    
    this.logger.info('AnalyticsDashboardUI instance created');
  }
  
  /**
   * Initialize the AnalyticsDashboardUI
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    this.logger.info('Initializing AnalyticsDashboardUI');
    
    if (!this.analyticsProcessingEngine) {
      throw new Error('AnalyticsProcessingEngine reference is required for initialization');
    }
    
    if (!this.container) {
      throw new Error('Container element is required for initialization');
    }
    
    // Set up refresh interval
    this._setupRefreshInterval();
    
    // Render initial dashboard
    await this._renderDashboard();
    
    this.initialized = true;
    this.logger.info('AnalyticsDashboardUI initialized');
    return true;
  }
  
  /**
   * Change the current view
   * @param {string} view - View to change to
   * @returns {Promise<boolean>} - Promise resolving to true if change was successful
   */
  async changeView(view) {
    if (!this.initialized) {
      throw new Error('AnalyticsDashboardUI not initialized');
    }
    
    this.logger.debug(`Changing view to: ${view}`);
    
    try {
      // Validate view
      const validViews = ['overview', 'userActivity', 'tentacleUsage', 'systemPerformance'];
      
      if (!validViews.includes(view)) {
        throw new Error(`Invalid view: ${view}`);
      }
      
      // Update current view
      this.currentView = view;
      
      // Re-render dashboard
      await this._renderDashboard();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to change view', error);
      throw error;
    }
  }
  
  /**
   * Change the current time frame
   * @param {string} timeFrame - Time frame to change to
   * @returns {Promise<boolean>} - Promise resolving to true if change was successful
   */
  async changeTimeFrame(timeFrame) {
    if (!this.initialized) {
      throw new Error('AnalyticsDashboardUI not initialized');
    }
    
    this.logger.debug(`Changing time frame to: ${timeFrame}`);
    
    try {
      // Validate time frame
      const validTimeFrames = ['hourly', 'daily', 'weekly', 'monthly'];
      
      if (!validTimeFrames.includes(timeFrame)) {
        throw new Error(`Invalid time frame: ${timeFrame}`);
      }
      
      // Update current time frame
      this.currentTimeFrame = timeFrame;
      
      // Re-render dashboard
      await this._renderDashboard();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to change time frame', error);
      throw error;
    }
  }
  
  /**
   * Refresh dashboard data
   * @returns {Promise<boolean>} - Promise resolving to true if refresh was successful
   */
  async refreshData() {
    if (!this.initialized) {
      throw new Error('AnalyticsDashboardUI not initialized');
    }
    
    this.logger.debug('Refreshing dashboard data');
    
    try {
      // Re-render dashboard
      await this._renderDashboard();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh data', error);
      throw error;
    }
  }
  
  /**
   * Set up refresh interval
   * @private
   */
  _setupRefreshInterval() {
    // Set up periodic refresh of dashboard
    const intervalMs = this.config.refreshInterval * 1000;
    
    this._refreshInterval = setInterval(() => {
      this.refreshData().catch(error => {
        this.logger.error('Failed to refresh data', error);
      });
    }, intervalMs);
  }
  
  /**
   * Render dashboard
   * @returns {Promise<boolean>} - Promise resolving to true if rendering was successful
   * @private
   */
  async _renderDashboard() {
    this.logger.debug(`Rendering dashboard for view: ${this.currentView}, time frame: ${this.currentTimeFrame}`);
    
    try {
      // Clear container
      this.container.innerHTML = '';
      
      // Create dashboard element
      const dashboardElement = document.createElement('div');
      dashboardElement.className = 'analytics-dashboard';
      
      // Add header
      dashboardElement.appendChild(this._createHeader());
      
      // Add content based on current view
      switch (this.currentView) {
        case 'overview':
          dashboardElement.appendChild(await this._createOverviewContent());
          break;
        case 'userActivity':
          dashboardElement.appendChild(await this._createUserActivityContent());
          break;
        case 'tentacleUsage':
          dashboardElement.appendChild(await this._createTentacleUsageContent());
          break;
        case 'systemPerformance':
          dashboardElement.appendChild(await this._createSystemPerformanceContent());
          break;
      }
      
      // Add footer
      dashboardElement.appendChild(this._createFooter());
      
      // Add dashboard to container
      this.container.appendChild(dashboardElement);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to render dashboard', error);
      throw error;
    }
  }
  
  /**
   * Create dashboard header
   * @returns {HTMLElement} - Header element
   * @private
   */
  _createHeader() {
    const header = document.createElement('div');
    header.className = 'analytics-dashboard-header';
    
    // Add title
    const title = document.createElement('h1');
    title.textContent = 'Aideon Tentacle Marketplace Analytics';
    header.appendChild(title);
    
    // Add navigation
    const nav = document.createElement('nav');
    nav.className = 'analytics-dashboard-nav';
    
    // Add view buttons
    const viewButtons = [
      { id: 'overview', label: 'Overview' },
      { id: 'userActivity', label: 'User Activity' },
      { id: 'tentacleUsage', label: 'Tentacle Usage' },
      { id: 'systemPerformance', label: 'System Performance' }
    ];
    
    for (const button of viewButtons) {
      const buttonElement = document.createElement('button');
      buttonElement.textContent = button.label;
      buttonElement.className = `analytics-dashboard-nav-button ${this.currentView === button.id ? 'active' : ''}`;
      buttonElement.addEventListener('click', () => {
        this.changeView(button.id).catch(error => {
          this.logger.error(`Failed to change view to ${button.id}`, error);
        });
      });
      
      nav.appendChild(buttonElement);
    }
    
    header.appendChild(nav);
    
    // Add time frame selector
    const timeFrameSelector = document.createElement('div');
    timeFrameSelector.className = 'analytics-dashboard-time-frame';
    
    const timeFrameLabel = document.createElement('span');
    timeFrameLabel.textContent = 'Time Frame: ';
    timeFrameSelector.appendChild(timeFrameLabel);
    
    const timeFrameSelect = document.createElement('select');
    
    const timeFrameOptions = [
      { id: 'hourly', label: 'Hourly' },
      { id: 'daily', label: 'Daily' },
      { id: 'weekly', label: 'Weekly' },
      { id: 'monthly', label: 'Monthly' }
    ];
    
    for (const option of timeFrameOptions) {
      const optionElement = document.createElement('option');
      optionElement.value = option.id;
      optionElement.textContent = option.label;
      optionElement.selected = this.currentTimeFrame === option.id;
      
      timeFrameSelect.appendChild(optionElement);
    }
    
    timeFrameSelect.addEventListener('change', () => {
      this.changeTimeFrame(timeFrameSelect.value).catch(error => {
        this.logger.error(`Failed to change time frame to ${timeFrameSelect.value}`, error);
      });
    });
    
    timeFrameSelector.appendChild(timeFrameSelect);
    header.appendChild(timeFrameSelector);
    
    return header;
  }
  
  /**
   * Create overview content
   * @returns {Promise<HTMLElement>} - Promise resolving to content element
   * @private
   */
  async _createOverviewContent() {
    const content = document.createElement('div');
    content.className = 'analytics-dashboard-content overview';
    
    try {
      // Get insights for all data types
      const userActivityInsights = await this._getInsights('userActivity');
      const tentacleUsageInsights = await this._getInsights('tentacleUsage');
      const systemPerformanceInsights = await this._getInsights('systemPerformance');
      
      // Create sections for each data type
      const userActivitySection = this._createInsightsSection('User Activity', userActivityInsights);
      const tentacleUsageSection = this._createInsightsSection('Tentacle Usage', tentacleUsageInsights);
      const systemPerformanceSection = this._createInsightsSection('System Performance', systemPerformanceInsights);
      
      // Add sections to content
      content.appendChild(userActivitySection);
      content.appendChild(tentacleUsageSection);
      content.appendChild(systemPerformanceSection);
    } catch (error) {
      this.logger.error('Failed to create overview content', error);
      
      // Add error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'analytics-dashboard-error';
      errorMessage.textContent = 'Failed to load overview content. Please try again later.';
      
      content.appendChild(errorMessage);
    }
    
    return content;
  }
  
  /**
   * Create user activity content
   * @returns {Promise<HTMLElement>} - Promise resolving to content element
   * @private
   */
  async _createUserActivityContent() {
    const content = document.createElement('div');
    content.className = 'analytics-dashboard-content user-activity';
    
    try {
      // Get insights
      const insights = await this._getInsights('userActivity');
      
      // Create insights section
      const insightsSection = this._createInsightsSection('User Activity Insights', insights);
      content.appendChild(insightsSection);
      
      // Create charts
      const chartsSection = document.createElement('div');
      chartsSection.className = 'analytics-dashboard-charts';
      
      // Add charts
      chartsSection.appendChild(this._createChart('activeUsers', 'Active Users'));
      chartsSection.appendChild(this._createChart('pageViews', 'Page Views'));
      chartsSection.appendChild(this._createChart('tentacleViews', 'Tentacle Views'));
      chartsSection.appendChild(this._createChart('tentacleDownloads', 'Tentacle Downloads'));
      
      content.appendChild(chartsSection);
    } catch (error) {
      this.logger.error('Failed to create user activity content', error);
      
      // Add error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'analytics-dashboard-error';
      errorMessage.textContent = 'Failed to load user activity content. Please try again later.';
      
      content.appendChild(errorMessage);
    }
    
    return content;
  }
  
  /**
   * Create tentacle usage content
   * @returns {Promise<HTMLElement>} - Promise resolving to content element
   * @private
   */
  async _createTentacleUsageContent() {
    const content = document.createElement('div');
    content.className = 'analytics-dashboard-content tentacle-usage';
    
    try {
      // Get insights
      const insights = await this._getInsights('tentacleUsage');
      
      // Create insights section
      const insightsSection = this._createInsightsSection('Tentacle Usage Insights', insights);
      content.appendChild(insightsSection);
      
      // Create charts
      const chartsSection = document.createElement('div');
      chartsSection.className = 'analytics-dashboard-charts';
      
      // Add charts
      chartsSection.appendChild(this._createChart('totalViews', 'Total Views'));
      chartsSection.appendChild(this._createChart('totalDownloads', 'Total Downloads'));
      chartsSection.appendChild(this._createChart('totalInstalls', 'Total Installs'));
      chartsSection.appendChild(this._createChart('totalExecutions', 'Total Executions'));
      
      content.appendChild(chartsSection);
      
      // Create popular tentacles section
      const popularTentaclesSection = document.createElement('div');
      popularTentaclesSection.className = 'analytics-dashboard-popular-tentacles';
      
      // Add title
      const popularTentaclesTitle = document.createElement('h3');
      popularTentaclesTitle.textContent = 'Popular Tentacles';
      popularTentaclesSection.appendChild(popularTentaclesTitle);
      
      // Add table
      const popularTentaclesTable = document.createElement('table');
      popularTentaclesTable.className = 'analytics-dashboard-table';
      
      // Add table header
      const tableHeader = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      const idHeader = document.createElement('th');
      idHeader.textContent = 'Tentacle ID';
      headerRow.appendChild(idHeader);
      
      const viewsHeader = document.createElement('th');
      viewsHeader.textContent = 'Views';
      headerRow.appendChild(viewsHeader);
      
      const downloadsHeader = document.createElement('th');
      downloadsHeader.textContent = 'Downloads';
      headerRow.appendChild(downloadsHeader);
      
      const scoreHeader = document.createElement('th');
      scoreHeader.textContent = 'Score';
      headerRow.appendChild(scoreHeader);
      
      tableHeader.appendChild(headerRow);
      popularTentaclesTable.appendChild(tableHeader);
      
      // Add table body
      const tableBody = document.createElement('tbody');
      
      // Find popular tentacles insight
      const popularTentaclesInsight = insights.find(insight => insight.metric === 'popularTentacles');
      
      if (popularTentaclesInsight && popularTentaclesInsight.value) {
        for (const tentacle of popularTentaclesInsight.value) {
          const row = document.createElement('tr');
          
          const idCell = document.createElement('td');
          idCell.textContent = tentacle.id;
          row.appendChild(idCell);
          
          const viewsCell = document.createElement('td');
          viewsCell.textContent = tentacle.views;
          row.appendChild(viewsCell);
          
          const downloadsCell = document.createElement('td');
          downloadsCell.textContent = tentacle.downloads;
          row.appendChild(downloadsCell);
          
          const scoreCell = document.createElement('td');
          scoreCell.textContent = tentacle.score;
          row.appendChild(scoreCell);
          
          tableBody.appendChild(row);
        }
      } else {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.textContent = 'No data available';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
      }
      
      popularTentaclesTable.appendChild(tableBody);
      popularTentaclesSection.appendChild(popularTentaclesTable);
      
      content.appendChild(popularTentaclesSection);
    } catch (error) {
      this.logger.error('Failed to create tentacle usage content', error);
      
      // Add error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'analytics-dashboard-error';
      errorMessage.textContent = 'Failed to load tentacle usage content. Please try again later.';
      
      content.appendChild(errorMessage);
    }
    
    return content;
  }
  
  /**
   * Create system performance content
   * @returns {Promise<HTMLElement>} - Promise resolving to content element
   * @private
   */
  async _createSystemPerformanceContent() {
    const content = document.createElement('div');
    content.className = 'analytics-dashboard-content system-performance';
    
    try {
      // Get insights
      const insights = await this._getInsights('systemPerformance');
      
      // Create insights section
      const insightsSection = this._createInsightsSection('System Performance Insights', insights);
      content.appendChild(insightsSection);
      
      // Create charts
      const chartsSection = document.createElement('div');
      chartsSection.className = 'analytics-dashboard-charts';
      
      // Add charts
      chartsSection.appendChild(this._createChart('cpuUsage', 'CPU Usage'));
      chartsSection.appendChild(this._createChart('memoryUsage', 'Memory Usage'));
      chartsSection.appendChild(this._createChart('responseTime', 'Response Time'));
      chartsSection.appendChild(this._createChart('requestsPerMinute', 'Requests Per Minute'));
      
      content.appendChild(chartsSection);
      
      // Create errors section
      const errorsSection = document.createElement('div');
      errorsSection.className = 'analytics-dashboard-errors';
      
      // Add title
      const errorsTitle = document.createElement('h3');
      errorsTitle.textContent = 'System Errors';
      errorsSection.appendChild(errorsTitle);
      
      // Add table
      const errorsTable = document.createElement('table');
      errorsTable.className = 'analytics-dashboard-table';
      
      // Add table header
      const tableHeader = document.createElement('thead');
      const headerRow = document.createElement('tr');
      
      const componentHeader = document.createElement('th');
      componentHeader.textContent = 'Component';
      headerRow.appendChild(componentHeader);
      
      const countHeader = document.createElement('th');
      countHeader.textContent = 'Error Count';
      headerRow.appendChild(countHeader);
      
      tableHeader.appendChild(headerRow);
      errorsTable.appendChild(tableHeader);
      
      // Add table body
      const tableBody = document.createElement('tbody');
      
      // Find errors insight
      const errorsInsight = insights.find(insight => insight.metric === 'errors');
      
      if (errorsInsight && errorsInsight.value && errorsInsight.value.byComponent) {
        for (const [component, count] of Object.entries(errorsInsight.value.byComponent)) {
          const row = document.createElement('tr');
          
          const componentCell = document.createElement('td');
          componentCell.textContent = component;
          row.appendChild(componentCell);
          
          const countCell = document.createElement('td');
          countCell.textContent = count;
          row.appendChild(countCell);
          
          tableBody.appendChild(row);
        }
      } else {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 2;
        emptyCell.textContent = 'No data available';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
      }
      
      errorsTable.appendChild(tableBody);
      errorsSection.appendChild(errorsTable);
      
      content.appendChild(errorsSection);
    } catch (error) {
      this.logger.error('Failed to create system performance content', error);
      
      // Add error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'analytics-dashboard-error';
      errorMessage.textContent = 'Failed to load system performance content. Please try again later.';
      
      content.appendChild(errorMessage);
    }
    
    return content;
  }
  
  /**
   * Create dashboard footer
   * @returns {HTMLElement} - Footer element
   * @private
   */
  _createFooter() {
    const footer = document.createElement('div');
    footer.className = 'analytics-dashboard-footer';
    
    // Add last updated timestamp
    const lastUpdated = document.createElement('div');
    lastUpdated.className = 'analytics-dashboard-last-updated';
    lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
    
    footer.appendChild(lastUpdated);
    
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.className = 'analytics-dashboard-refresh-button';
    refreshButton.textContent = 'Refresh';
    refreshButton.addEventListener('click', () => {
      this.refreshData().catch(error => {
        this.logger.error('Failed to refresh data', error);
      });
    });
    
    footer.appendChild(refreshButton);
    
    return footer;
  }
  
  /**
   * Create insights section
   * @param {string} title - Section title
   * @param {Array} insights - Insights to display
   * @returns {HTMLElement} - Section element
   * @private
   */
  _createInsightsSection(title, insights) {
    const section = document.createElement('div');
    section.className = 'analytics-dashboard-insights-section';
    
    // Add title
    const sectionTitle = document.createElement('h2');
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);
    
    // Add insights
    const insightsList = document.createElement('ul');
    insightsList.className = 'analytics-dashboard-insights-list';
    
    if (insights && insights.length > 0) {
      for (const insight of insights) {
        const insightItem = document.createElement('li');
        insightItem.className = `analytics-dashboard-insight ${insight.type}`;
        insightItem.textContent = insight.description;
        
        insightsList.appendChild(insightItem);
      }
    } else {
      const noInsightsItem = document.createElement('li');
      noInsightsItem.className = 'analytics-dashboard-no-insights';
      noInsightsItem.textContent = 'No insights available';
      
      insightsList.appendChild(noInsightsItem);
    }
    
    section.appendChild(insightsList);
    
    return section;
  }
  
  /**
   * Create chart
   * @param {string} metric - Metric to chart
   * @param {string} title - Chart title
   * @returns {HTMLElement} - Chart element
   * @private
   */
  _createChart(metric, title) {
    const chart = document.createElement('div');
    chart.className = `analytics-dashboard-chart ${metric}`;
    
    // Add title
    const chartTitle = document.createElement('h3');
    chartTitle.textContent = title;
    chart.appendChild(chartTitle);
    
    // Add chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'analytics-dashboard-chart-container';
    
    // In a real implementation, this would create a chart using a charting library
    // For this implementation, we'll just add a placeholder
    const chartPlaceholder = document.createElement('div');
    chartPlaceholder.className = 'analytics-dashboard-chart-placeholder';
    chartPlaceholder.textContent = `Chart for ${title}`;
    
    chartContainer.appendChild(chartPlaceholder);
    chart.appendChild(chartContainer);
    
    return chart;
  }
  
  /**
   * Get insights for data type
   * @param {string} type - Data type to get insights for
   * @returns {Promise<Array>} - Promise resolving to insights
   * @private
   */
  async _getInsights(type) {
    try {
      // Calculate time range based on current time frame
      const endTime = Date.now();
      let startTime;
      
      switch (this.currentTimeFrame) {
        case 'hourly':
          startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours
          break;
        case 'daily':
          startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days
          break;
        case 'weekly':
          startTime = endTime - (4 * 7 * 24 * 60 * 60 * 1000); // 4 weeks
          break;
        case 'monthly':
          startTime = endTime - (12 * 30 * 24 * 60 * 60 * 1000); // 12 months
          break;
        default:
          startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days
      }
      
      // Generate insights
      const { insights } = await this.analyticsProcessingEngine.generateInsights({
        type,
        interval: this.currentTimeFrame,
        startTime,
        endTime
      });
      
      return insights;
    } catch (error) {
      this.logger.error(`Failed to get insights for ${type}`, error);
      return [];
    }
  }
  
  /**
   * Get the status of the AnalyticsDashboardUI
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      currentView: this.currentView,
      currentTimeFrame: this.currentTimeFrame,
      refreshInterval: this.config.refreshInterval
    };
  }
  
  /**
   * Shutdown the AnalyticsDashboardUI
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    this.logger.info('Shutting down AnalyticsDashboardUI');
    
    // Clear refresh interval
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.initialized = false;
    this.logger.info('AnalyticsDashboardUI shutdown complete');
    return true;
  }
}

module.exports = { AnalyticsDashboardUI };
