/**
 * @fileoverview Revenue Analytics for the Aideon Tentacle Marketplace
 * 
 * This module provides revenue analytics functionality, generating insights
 * and reports for developers and marketplace administrators.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * RevenueAnalytics class - Provides revenue analytics and reporting
 */
class RevenueAnalytics {
  /**
   * Create a new RevenueAnalytics instance
   * @param {Object} options - Configuration options
   * @param {Object} options.revenueManager - Reference to the revenue manager
   * @param {Object} options.paymentProcessor - Reference to the payment processor
   * @param {string} options.storagePath - Path to store analytics data
   */
  constructor(options = {}) {
    this.options = options;
    this.revenueManager = options.revenueManager;
    this.paymentProcessor = options.paymentProcessor;
    this.storagePath = options.storagePath || path.join(process.cwd(), 'analytics-data');
    this.logger = new Logger('RevenueAnalytics');
    this.events = new EventEmitter();
    this.reports = new Map();
    this.initialized = false;
    
    // Define report types
    this.reportTypes = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      QUARTERLY: 'quarterly',
      YEARLY: 'yearly',
      CUSTOM: 'custom'
    };
    
    // Define report formats
    this.reportFormats = {
      JSON: 'json',
      CSV: 'csv',
      HTML: 'html',
      PDF: 'pdf'
    };
  }

  /**
   * Initialize the revenue analytics
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('RevenueAnalytics already initialized');
      return true;
    }

    this.logger.info('Initializing RevenueAnalytics');
    
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Create subdirectories
      await fs.mkdir(path.join(this.storagePath, 'reports'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'dashboards'), { recursive: true });
      await fs.mkdir(path.join(this.storagePath, 'exports'), { recursive: true });
      
      // Load existing reports
      await this._loadReports();
      
      this.initialized = true;
      this.logger.info('RevenueAnalytics initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize RevenueAnalytics', error);
      throw error;
    }
  }

  /**
   * Load existing reports
   * @returns {Promise<void>}
   * @private
   */
  async _loadReports() {
    const reportsDir = path.join(this.storagePath, 'reports');
    
    try {
      const files = await fs.readdir(reportsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(reportsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const report = JSON.parse(data);
            
            this.reports.set(report.id, report);
          } catch (error) {
            this.logger.error(`Failed to load report from file: ${file}`, error);
          }
        }
      }
      
      this.logger.info(`Loaded ${this.reports.size} existing reports`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to load reports', error);
      }
    }
  }

  /**
   * Save report to file
   * @param {string} reportId - Report ID
   * @param {Object} report - Report data
   * @returns {Promise<void>}
   * @private
   */
  async _saveReport(reportId, report) {
    const reportPath = path.join(this.storagePath, 'reports', `${reportId}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  /**
   * Generate a revenue report
   * @param {Object} options - Report generation options
   * @param {string} options.type - Report type
   * @param {string} options.format - Report format
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @param {string} options.developerId - Developer ID (optional)
   * @param {string} options.tentacleId - Tentacle ID (optional)
   * @param {Object} options.filters - Additional filters
   * @returns {Promise<Object>} - Promise resolving to the generated report
   */
  async generateReport(options) {
    if (!this.initialized) {
      throw new Error('RevenueAnalytics not initialized');
    }
    
    if (!this.revenueManager) {
      throw new Error('RevenueManager not available');
    }
    
    this.logger.info(`Generating ${options.type} revenue report`);
    
    try {
      // Validate report type
      if (!Object.values(this.reportTypes).includes(options.type)) {
        throw new Error(`Invalid report type: ${options.type}`);
      }
      
      // Validate report format
      if (options.format && !Object.values(this.reportFormats).includes(options.format)) {
        throw new Error(`Invalid report format: ${options.format}`);
      }
      
      // Generate report ID
      const reportId = `rep_${crypto.randomBytes(8).toString('hex')}`;
      
      // Determine date range if not provided
      let startDate = options.startDate ? new Date(options.startDate) : new Date();
      let endDate = options.endDate ? new Date(options.endDate) : new Date();
      
      if (!options.startDate || !options.endDate) {
        switch (options.type) {
          case this.reportTypes.DAILY:
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case this.reportTypes.WEEKLY:
            startDate.setDate(startDate.getDate() - startDate.getDay());
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
          case this.reportTypes.MONTHLY:
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case this.reportTypes.QUARTERLY:
            const quarter = Math.floor(startDate.getMonth() / 3);
            startDate = new Date(startDate.getFullYear(), quarter * 3, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), (quarter + 1) * 3, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case this.reportTypes.YEARLY:
            startDate = new Date(startDate.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
      }
      
      // Collect revenue data
      let revenueData;
      
      if (options.developerId) {
        // Get developer revenue
        const developerRevenue = await this.revenueManager.getDeveloperRevenueSummary(options.developerId);
        
        // Get developer transactions
        const transactions = await this.revenueManager.getDeveloperTransactions(options.developerId);
        
        // Filter transactions by date range
        const filteredTransactions = transactions.filter(transaction => {
          const transactionDate = new Date(transaction.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        revenueData = {
          developerId: options.developerId,
          summary: developerRevenue,
          transactions: filteredTransactions,
          periodRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.developerAmount, 0)
        };
      } else if (options.tentacleId) {
        // Get tentacle transactions
        const transactions = await this.revenueManager.getTentacleTransactions(options.tentacleId);
        
        // Filter transactions by date range
        const filteredTransactions = transactions.filter(transaction => {
          const transactionDate = new Date(transaction.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        // Group transactions by developer
        const developerTransactions = {};
        for (const transaction of filteredTransactions) {
          if (!developerTransactions[transaction.developerId]) {
            developerTransactions[transaction.developerId] = [];
          }
          developerTransactions[transaction.developerId].push(transaction);
        }
        
        revenueData = {
          tentacleId: options.tentacleId,
          transactions: filteredTransactions,
          developerTransactions,
          totalRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
          platformRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.platformAmount, 0),
          developerRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.developerAmount, 0)
        };
      } else {
        // Get marketplace revenue summary
        const marketplaceRevenue = await this.revenueManager.getMarketplaceRevenueSummary();
        
        // Get all transactions
        const allTransactions = [];
        for (const entry of this.revenueManager.revenueEntries.values()) {
          allTransactions.push(entry);
        }
        
        // Filter transactions by date range
        const filteredTransactions = allTransactions.filter(transaction => {
          const transactionDate = new Date(transaction.createdAt);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        
        // Group transactions by developer
        const developerRevenue = {};
        for (const transaction of filteredTransactions) {
          if (!developerRevenue[transaction.developerId]) {
            developerRevenue[transaction.developerId] = {
              developerId: transaction.developerId,
              transactions: [],
              totalAmount: 0,
              developerAmount: 0,
              platformAmount: 0
            };
          }
          developerRevenue[transaction.developerId].transactions.push(transaction);
          developerRevenue[transaction.developerId].totalAmount += transaction.amount;
          developerRevenue[transaction.developerId].developerAmount += transaction.developerAmount;
          developerRevenue[transaction.developerId].platformAmount += transaction.platformAmount;
        }
        
        // Group transactions by tentacle
        const tentacleRevenue = {};
        for (const transaction of filteredTransactions) {
          if (!tentacleRevenue[transaction.tentacleId]) {
            tentacleRevenue[transaction.tentacleId] = {
              tentacleId: transaction.tentacleId,
              transactions: [],
              totalAmount: 0,
              developerAmount: 0,
              platformAmount: 0
            };
          }
          tentacleRevenue[transaction.tentacleId].transactions.push(transaction);
          tentacleRevenue[transaction.tentacleId].totalAmount += transaction.amount;
          tentacleRevenue[transaction.tentacleId].developerAmount += transaction.developerAmount;
          tentacleRevenue[transaction.tentacleId].platformAmount += transaction.platformAmount;
        }
        
        revenueData = {
          summary: marketplaceRevenue,
          transactions: filteredTransactions,
          developerRevenue: Object.values(developerRevenue),
          tentacleRevenue: Object.values(tentacleRevenue),
          periodTotalRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
          periodPlatformRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.platformAmount, 0),
          periodDeveloperRevenue: filteredTransactions.reduce((sum, transaction) => sum + transaction.developerAmount, 0)
        };
      }
      
      // Create report
      const report = {
        id: reportId,
        type: options.type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        developerId: options.developerId,
        tentacleId: options.tentacleId,
        filters: options.filters,
        data: revenueData,
        createdAt: new Date().toISOString()
      };
      
      // Store report
      this.reports.set(reportId, report);
      
      // Save report to file
      await this._saveReport(reportId, report);
      
      // Generate formatted report if format specified
      let formattedReport = null;
      if (options.format) {
        formattedReport = await this._formatReport(report, options.format);
      }
      
      // Emit event
      this.events.emit('report:generated', { report });
      
      return {
        success: true,
        reportId,
        report,
        formattedReport
      };
    } catch (error) {
      this.logger.error(`Failed to generate revenue report`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format a report
   * @param {Object} report - Report data
   * @param {string} format - Report format
   * @returns {Promise<string>} - Promise resolving to the formatted report
   * @private
   */
  async _formatReport(report, format) {
    try {
      switch (format) {
        case this.reportFormats.JSON:
          return JSON.stringify(report, null, 2);
        
        case this.reportFormats.CSV:
          return this._generateCsvReport(report);
        
        case this.reportFormats.HTML:
          return this._generateHtmlReport(report);
        
        case this.reportFormats.PDF:
          // In a real implementation, this would generate a PDF
          // For this mock implementation, we'll just return HTML
          return this._generateHtmlReport(report);
        
        default:
          throw new Error(`Unsupported report format: ${format}`);
      }
    } catch (error) {
      this.logger.error(`Failed to format report: ${report.id}`, error);
      throw error;
    }
  }

  /**
   * Generate CSV report
   * @param {Object} report - Report data
   * @returns {string} - CSV report
   * @private
   */
  _generateCsvReport(report) {
    let csv = '';
    
    // Add header
    csv += `Report ID,${report.id}\n`;
    csv += `Type,${report.type}\n`;
    csv += `Start Date,${report.startDate}\n`;
    csv += `End Date,${report.endDate}\n`;
    csv += `Created At,${report.createdAt}\n\n`;
    
    // Add transactions
    if (report.data.transactions && report.data.transactions.length > 0) {
      csv += 'Transaction ID,Developer ID,Tentacle ID,Amount,Developer Amount,Platform Amount,Created At\n';
      
      for (const transaction of report.data.transactions) {
        csv += `${transaction.id},${transaction.developerId},${transaction.tentacleId},${transaction.amount},${transaction.developerAmount},${transaction.platformAmount},${transaction.createdAt}\n`;
      }
      
      csv += '\n';
    }
    
    // Add summary
    if (report.data.summary) {
      csv += 'Summary\n';
      
      for (const [key, value] of Object.entries(report.data.summary)) {
        if (typeof value !== 'object') {
          csv += `${key},${value}\n`;
        }
      }
    }
    
    return csv;
  }

  /**
   * Generate HTML report
   * @param {Object} report - Report data
   * @returns {string} - HTML report
   * @private
   */
  _generateHtmlReport(report) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Revenue Report: ${report.id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { background-color: #eef; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          .chart { height: 300px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Revenue Report</h1>
        <div class="summary">
          <p><strong>Report ID:</strong> ${report.id}</p>
          <p><strong>Type:</strong> ${report.type}</p>
          <p><strong>Period:</strong> ${new Date(report.startDate).toLocaleDateString()} to ${new Date(report.endDate).toLocaleDateString()}</p>
          <p><strong>Generated:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
    `;
    
    // Add developer-specific content
    if (report.developerId) {
      html += `
        <p><strong>Developer ID:</strong> ${report.developerId}</p>
        <p><strong>Period Revenue:</strong> $${report.data.periodRevenue.toFixed(2)}</p>
        <p><strong>Lifetime Revenue:</strong> $${report.data.summary.lifetimeRevenue.toFixed(2)}</p>
        <p><strong>Current Tier:</strong> ${report.data.summary.currentTier} (${(report.data.summary.currentShare * 100).toFixed(0)}%)</p>
      `;
      
      if (report.data.summary.nextTier) {
        html += `
          <p><strong>Next Tier:</strong> ${report.data.summary.nextTier} (${(report.data.summary.nextTierShare * 100).toFixed(0)}%)</p>
          <p><strong>Amount to Next Tier:</strong> $${report.data.summary.amountToNextTier.toFixed(2)}</p>
        `;
      }
    }
    
    // Add tentacle-specific content
    if (report.tentacleId) {
      html += `
        <p><strong>Tentacle ID:</strong> ${report.tentacleId}</p>
        <p><strong>Total Revenue:</strong> $${report.data.totalRevenue.toFixed(2)}</p>
        <p><strong>Platform Revenue:</strong> $${report.data.platformRevenue.toFixed(2)}</p>
        <p><strong>Developer Revenue:</strong> $${report.data.developerRevenue.toFixed(2)}</p>
      `;
    }
    
    // Add marketplace summary
    if (!report.developerId && !report.tentacleId && report.data.summary) {
      html += `
        <p><strong>Total Revenue:</strong> $${report.data.periodTotalRevenue.toFixed(2)}</p>
        <p><strong>Platform Revenue:</strong> $${report.data.periodPlatformRevenue.toFixed(2)}</p>
        <p><strong>Developer Revenue:</strong> $${report.data.periodDeveloperRevenue.toFixed(2)}</p>
        <p><strong>Transaction Count:</strong> ${report.data.transactions.length}</p>
      `;
    }
    
    html += `</div>`;
    
    // Add transactions table
    if (report.data.transactions && report.data.transactions.length > 0) {
      html += `
        <h2>Transactions</h2>
        <table>
          <tr>
            <th>Transaction ID</th>
            <th>Developer ID</th>
            <th>Tentacle ID</th>
            <th>Amount</th>
            <th>Developer Amount</th>
            <th>Platform Amount</th>
            <th>Date</th>
          </tr>
      `;
      
      for (const transaction of report.data.transactions) {
        html += `
          <tr>
            <td>${transaction.id}</td>
            <td>${transaction.developerId}</td>
            <td>${transaction.tentacleId}</td>
            <td>$${transaction.amount.toFixed(2)}</td>
            <td>$${transaction.developerAmount.toFixed(2)}</td>
            <td>$${transaction.platformAmount.toFixed(2)}</td>
            <td>${new Date(transaction.createdAt).toLocaleString()}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    // Add developer revenue table for marketplace reports
    if (!report.developerId && !report.tentacleId && report.data.developerRevenue) {
      html += `
        <h2>Developer Revenue</h2>
        <table>
          <tr>
            <th>Developer ID</th>
            <th>Transaction Count</th>
            <th>Total Amount</th>
            <th>Developer Amount</th>
            <th>Platform Amount</th>
          </tr>
      `;
      
      for (const developer of report.data.developerRevenue) {
        html += `
          <tr>
            <td>${developer.developerId}</td>
            <td>${developer.transactions.length}</td>
            <td>$${developer.totalAmount.toFixed(2)}</td>
            <td>$${developer.developerAmount.toFixed(2)}</td>
            <td>$${developer.platformAmount.toFixed(2)}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    // Add tentacle revenue table for marketplace reports
    if (!report.developerId && !report.tentacleId && report.data.tentacleRevenue) {
      html += `
        <h2>Tentacle Revenue</h2>
        <table>
          <tr>
            <th>Tentacle ID</th>
            <th>Transaction Count</th>
            <th>Total Amount</th>
            <th>Developer Amount</th>
            <th>Platform Amount</th>
          </tr>
      `;
      
      for (const tentacle of report.data.tentacleRevenue) {
        html += `
          <tr>
            <td>${tentacle.tentacleId}</td>
            <td>${tentacle.transactions.length}</td>
            <td>$${tentacle.totalAmount.toFixed(2)}</td>
            <td>$${tentacle.developerAmount.toFixed(2)}</td>
            <td>$${tentacle.platformAmount.toFixed(2)}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Export a report
   * @param {Object} options - Export options
   * @param {string} options.reportId - Report ID
   * @param {string} options.format - Export format
   * @returns {Promise<Object>} - Promise resolving to export result
   */
  async exportReport(options) {
    if (!this.initialized) {
      throw new Error('RevenueAnalytics not initialized');
    }
    
    this.logger.info(`Exporting report: ${options.reportId}`);
    
    try {
      // Get report
      const report = this.reports.get(options.reportId);
      
      if (!report) {
        throw new Error(`Report ${options.reportId} not found`);
      }
      
      // Format report
      const formattedReport = await this._formatReport(report, options.format);
      
      // Save export
      const exportPath = path.join(this.storagePath, 'exports', `${options.reportId}.${options.format}`);
      await fs.writeFile(exportPath, formattedReport);
      
      return {
        success: true,
        exportPath,
        format: options.format
      };
    } catch (error) {
      this.logger.error(`Failed to export report: ${options.reportId}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a dashboard
   * @param {Object} options - Dashboard generation options
   * @param {string} options.developerId - Developer ID (optional)
   * @param {string} options.tentacleId - Tentacle ID (optional)
   * @returns {Promise<Object>} - Promise resolving to the generated dashboard
   */
  async generateDashboard(options) {
    if (!this.initialized) {
      throw new Error('RevenueAnalytics not initialized');
    }
    
    if (!this.revenueManager) {
      throw new Error('RevenueManager not available');
    }
    
    this.logger.info('Generating revenue dashboard');
    
    try {
      // Generate dashboard ID
      const dashboardId = `dash_${crypto.randomBytes(8).toString('hex')}`;
      
      // Generate reports for different time periods
      const dailyReport = await this.generateReport({
        type: this.reportTypes.DAILY,
        developerId: options.developerId,
        tentacleId: options.tentacleId
      });
      
      const weeklyReport = await this.generateReport({
        type: this.reportTypes.WEEKLY,
        developerId: options.developerId,
        tentacleId: options.tentacleId
      });
      
      const monthlyReport = await this.generateReport({
        type: this.reportTypes.MONTHLY,
        developerId: options.developerId,
        tentacleId: options.tentacleId
      });
      
      const yearlyReport = await this.generateReport({
        type: this.reportTypes.YEARLY,
        developerId: options.developerId,
        tentacleId: options.tentacleId
      });
      
      // Create dashboard
      const dashboard = {
        id: dashboardId,
        developerId: options.developerId,
        tentacleId: options.tentacleId,
        reports: {
          daily: dailyReport.reportId,
          weekly: weeklyReport.reportId,
          monthly: monthlyReport.reportId,
          yearly: yearlyReport.reportId
        },
        createdAt: new Date().toISOString()
      };
      
      // Save dashboard
      const dashboardPath = path.join(this.storagePath, 'dashboards', `${dashboardId}.json`);
      await fs.writeFile(dashboardPath, JSON.stringify(dashboard, null, 2));
      
      // Generate HTML dashboard
      const htmlDashboard = await this._generateHtmlDashboard(dashboard, {
        daily: dailyReport.report,
        weekly: weeklyReport.report,
        monthly: monthlyReport.report,
        yearly: yearlyReport.report
      });
      
      // Save HTML dashboard
      const htmlPath = path.join(this.storagePath, 'dashboards', `${dashboardId}.html`);
      await fs.writeFile(htmlPath, htmlDashboard);
      
      // Emit event
      this.events.emit('dashboard:generated', { dashboard });
      
      return {
        success: true,
        dashboardId,
        dashboard,
        htmlPath
      };
    } catch (error) {
      this.logger.error('Failed to generate revenue dashboard', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate HTML dashboard
   * @param {Object} dashboard - Dashboard data
   * @param {Object} reports - Reports data
   * @returns {string} - HTML dashboard
   * @private
   */
  async _generateHtmlDashboard(dashboard, reports) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Revenue Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2, h3 { color: #333; }
          .dashboard { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .card { background-color: #fff; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 20px; }
          .summary { background-color: #eef; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          .chart { height: 200px; margin-bottom: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .metric { font-size: 24px; font-weight: bold; color: #007bff; }
          .metric-label { font-size: 14px; color: #666; }
          .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Revenue Dashboard</h1>
        <div class="summary">
          <p><strong>Dashboard ID:</strong> ${dashboard.id}</p>
          <p><strong>Generated:</strong> ${new Date(dashboard.createdAt).toLocaleString()}</p>
    `;
    
    // Add developer-specific content
    if (dashboard.developerId) {
      const developerSummary = reports.monthly.data.summary;
      
      html += `
        <p><strong>Developer ID:</strong> ${dashboard.developerId}</p>
        <p><strong>Lifetime Revenue:</strong> $${developerSummary.lifetimeRevenue.toFixed(2)}</p>
        <p><strong>Current Tier:</strong> ${developerSummary.currentTier} (${(developerSummary.currentShare * 100).toFixed(0)}%)</p>
      `;
      
      if (developerSummary.nextTier) {
        html += `
          <p><strong>Next Tier:</strong> ${developerSummary.nextTier} (${(developerSummary.nextTierShare * 100).toFixed(0)}%)</p>
          <p><strong>Amount to Next Tier:</strong> $${developerSummary.amountToNextTier.toFixed(2)}</p>
        `;
      }
    }
    
    // Add tentacle-specific content
    if (dashboard.tentacleId) {
      html += `
        <p><strong>Tentacle ID:</strong> ${dashboard.tentacleId}</p>
        <p><strong>Monthly Revenue:</strong> $${reports.monthly.data.totalRevenue.toFixed(2)}</p>
      `;
    }
    
    html += `</div>`;
    
    // Add metrics
    html += `
      <div class="metrics">
        <div>
          <div class="metric">$${reports.daily.data.periodTotalRevenue ? reports.daily.data.periodTotalRevenue.toFixed(2) : '0.00'}</div>
          <div class="metric-label">Today's Revenue</div>
        </div>
        <div>
          <div class="metric">$${reports.weekly.data.periodTotalRevenue ? reports.weekly.data.periodTotalRevenue.toFixed(2) : '0.00'}</div>
          <div class="metric-label">This Week's Revenue</div>
        </div>
        <div>
          <div class="metric">$${reports.monthly.data.periodTotalRevenue ? reports.monthly.data.periodTotalRevenue.toFixed(2) : '0.00'}</div>
          <div class="metric-label">This Month's Revenue</div>
        </div>
      </div>
    `;
    
    // Add dashboard cards
    html += `<div class="dashboard">`;
    
    // Daily revenue card
    html += `
      <div class="card">
        <h2>Daily Revenue</h2>
        <div class="chart">Chart placeholder</div>
        <p><strong>Date:</strong> ${new Date(reports.daily.startDate).toLocaleDateString()}</p>
        <p><strong>Total Revenue:</strong> $${reports.daily.data.periodTotalRevenue ? reports.daily.data.periodTotalRevenue.toFixed(2) : '0.00'}</p>
        <p><strong>Transaction Count:</strong> ${reports.daily.data.transactions ? reports.daily.data.transactions.length : 0}</p>
      </div>
    `;
    
    // Weekly revenue card
    html += `
      <div class="card">
        <h2>Weekly Revenue</h2>
        <div class="chart">Chart placeholder</div>
        <p><strong>Period:</strong> ${new Date(reports.weekly.startDate).toLocaleDateString()} to ${new Date(reports.weekly.endDate).toLocaleDateString()}</p>
        <p><strong>Total Revenue:</strong> $${reports.weekly.data.periodTotalRevenue ? reports.weekly.data.periodTotalRevenue.toFixed(2) : '0.00'}</p>
        <p><strong>Transaction Count:</strong> ${reports.weekly.data.transactions ? reports.weekly.data.transactions.length : 0}</p>
      </div>
    `;
    
    // Monthly revenue card
    html += `
      <div class="card">
        <h2>Monthly Revenue</h2>
        <div class="chart">Chart placeholder</div>
        <p><strong>Period:</strong> ${new Date(reports.monthly.startDate).toLocaleDateString()} to ${new Date(reports.monthly.endDate).toLocaleDateString()}</p>
        <p><strong>Total Revenue:</strong> $${reports.monthly.data.periodTotalRevenue ? reports.monthly.data.periodTotalRevenue.toFixed(2) : '0.00'}</p>
        <p><strong>Transaction Count:</strong> ${reports.monthly.data.transactions ? reports.monthly.data.transactions.length : 0}</p>
      </div>
    `;
    
    // Yearly revenue card
    html += `
      <div class="card">
        <h2>Yearly Revenue</h2>
        <div class="chart">Chart placeholder</div>
        <p><strong>Period:</strong> ${new Date(reports.yearly.startDate).toLocaleDateString()} to ${new Date(reports.yearly.endDate).toLocaleDateString()}</p>
        <p><strong>Total Revenue:</strong> $${reports.yearly.data.periodTotalRevenue ? reports.yearly.data.periodTotalRevenue.toFixed(2) : '0.00'}</p>
        <p><strong>Transaction Count:</strong> ${reports.yearly.data.transactions ? reports.yearly.data.transactions.length : 0}</p>
      </div>
    `;
    
    html += `</div>`;
    
    // Add recent transactions
    if (reports.monthly.data.transactions && reports.monthly.data.transactions.length > 0) {
      html += `
        <h2>Recent Transactions</h2>
        <table>
          <tr>
            <th>Transaction ID</th>
            <th>Developer ID</th>
            <th>Tentacle ID</th>
            <th>Amount</th>
            <th>Date</th>
          </tr>
      `;
      
      // Show only the 10 most recent transactions
      const recentTransactions = [...reports.monthly.data.transactions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
      
      for (const transaction of recentTransactions) {
        html += `
          <tr>
            <td>${transaction.id}</td>
            <td>${transaction.developerId}</td>
            <td>${transaction.tentacleId}</td>
            <td>$${transaction.amount.toFixed(2)}</td>
            <td>${new Date(transaction.createdAt).toLocaleString()}</td>
          </tr>
        `;
      }
      
      html += `</table>`;
    }
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }

  /**
   * Get a report by ID
   * @param {string} reportId - Report ID
   * @returns {Promise<Object>} - Promise resolving to the report
   */
  async getReport(reportId) {
    if (!this.initialized) {
      throw new Error('RevenueAnalytics not initialized');
    }
    
    // Get report from memory
    const report = this.reports.get(reportId);
    
    if (report) {
      return report;
    }
    
    // Try to load report from file
    const reportPath = path.join(this.storagePath, 'reports', `${reportId}.json`);
    
    try {
      const data = await fs.readFile(reportPath, 'utf8');
      const loadedReport = JSON.parse(data);
      
      // Cache report in memory
      this.reports.set(reportId, loadedReport);
      
      return loadedReport;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Get the status of the revenue analytics
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      reports: this.reports.size,
      revenueManagerAvailable: this.revenueManager ? true : false,
      paymentProcessorAvailable: this.paymentProcessor ? true : false
    };
  }

  /**
   * Shutdown the revenue analytics
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('RevenueAnalytics not initialized');
      return true;
    }
    
    this.logger.info('Shutting down RevenueAnalytics');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { RevenueAnalytics };
