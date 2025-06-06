/**
 * @fileoverview Developer Dashboard for the Aideon Developer Portal
 * 
 * This module provides functionality for the developer dashboard,
 * including analytics, tentacle management, and developer resources.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { Logger } = require('../../../core/logging/Logger');
const { EventEmitter } = require('../../../core/events/EventEmitter');
const path = require('path');
const fs = require('fs').promises;

/**
 * DeveloperDashboard class - Manages the developer dashboard for the Developer Portal
 */
class DeveloperDashboard {
  /**
   * Create a new DeveloperDashboard instance
   * @param {Object} options - Configuration options
   * @param {Object} options.accountManager - Reference to the account manager
   * @param {Object} options.submissionSystem - Reference to the submission system
   * @param {Object} options.analyticsService - Reference to the analytics service
   * @param {Object} options.monetizationService - Reference to the monetization service
   */
  constructor(options = {}) {
    this.options = options;
    this.accountManager = options.accountManager;
    this.submissionSystem = options.submissionSystem;
    this.analyticsService = options.analyticsService;
    this.monetizationService = options.monetizationService;
    this.logger = new Logger('DeveloperDashboard');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Define dashboard widgets and their configurations
    this.dashboardWidgets = {
      tentacle_overview: {
        name: 'Tentacle Overview',
        description: 'Overview of all tentacles',
        defaultEnabled: true,
        defaultPosition: 0
      },
      recent_activity: {
        name: 'Recent Activity',
        description: 'Recent activity on your tentacles',
        defaultEnabled: true,
        defaultPosition: 1
      },
      revenue_summary: {
        name: 'Revenue Summary',
        description: 'Summary of revenue from your tentacles',
        defaultEnabled: true,
        defaultPosition: 2
      },
      user_engagement: {
        name: 'User Engagement',
        description: 'User engagement metrics for your tentacles',
        defaultEnabled: true,
        defaultPosition: 3
      },
      performance_metrics: {
        name: 'Performance Metrics',
        description: 'Performance metrics for your tentacles',
        defaultEnabled: true,
        defaultPosition: 4
      },
      feedback_summary: {
        name: 'Feedback Summary',
        description: 'Summary of user feedback for your tentacles',
        defaultEnabled: true,
        defaultPosition: 5
      },
      developer_resources: {
        name: 'Developer Resources',
        description: 'Resources for tentacle development',
        defaultEnabled: true,
        defaultPosition: 6
      }
    };
    
    // Define time ranges for analytics
    this.timeRanges = {
      day: {
        name: '24 Hours',
        milliseconds: 24 * 60 * 60 * 1000
      },
      week: {
        name: '7 Days',
        milliseconds: 7 * 24 * 60 * 60 * 1000
      },
      month: {
        name: '30 Days',
        milliseconds: 30 * 24 * 60 * 60 * 1000
      },
      quarter: {
        name: '90 Days',
        milliseconds: 90 * 24 * 60 * 60 * 1000
      },
      year: {
        name: '365 Days',
        milliseconds: 365 * 24 * 60 * 60 * 1000
      }
    };
  }

  /**
   * Initialize the developer dashboard
   * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('DeveloperDashboard already initialized');
      return true;
    }

    this.logger.info('Initializing DeveloperDashboard');
    
    if (!this.accountManager) {
      throw new Error('AccountManager reference is required');
    }
    
    if (!this.submissionSystem) {
      throw new Error('SubmissionSystem reference is required');
    }
    
    try {
      this.initialized = true;
      this.logger.info('DeveloperDashboard initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize DeveloperDashboard', error);
      throw error;
    }
  }

  /**
   * Get dashboard data for a developer
   * @param {string} developerId - Developer account ID
   * @param {Object} options - Options for dashboard data
   * @returns {Promise<Object>} - Promise resolving to the dashboard data
   */
  async getDashboardData(developerId, options = {}) {
    if (!this.initialized) {
      throw new Error('DeveloperDashboard not initialized');
    }
    
    this.logger.info(`Getting dashboard data for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Get submissions for developer
    const submissions = await this.submissionSystem.getSubmissionsForDeveloper(developerId);
    
    // Get tentacle performance data
    const tentaclePerformance = await this._getTentaclePerformance(developerId, submissions, options);
    
    // Get recent activity
    const recentActivity = await this._getRecentActivity(developerId, submissions, options);
    
    // Get revenue data
    const revenueData = await this._getRevenueData(developerId, submissions, options);
    
    // Get user engagement data
    const userEngagement = await this._getUserEngagement(developerId, submissions, options);
    
    // Get feedback data
    const feedbackData = await this._getFeedbackData(developerId, submissions, options);
    
    // Get developer resources
    const developerResources = await this._getDeveloperResources(developerId, options);
    
    return {
      developerId,
      accountInfo: {
        name: account.metadata.name,
        email: account.metadata.email,
        vettingStatus: account.vettingStatus,
        createdAt: account.createdAt
      },
      submissionStats: {
        total: submissions.length,
        byStatus: this._countSubmissionsByStatus(submissions)
      },
      tentaclePerformance,
      recentActivity,
      revenueData,
      userEngagement,
      feedbackData,
      developerResources,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Count submissions by status
   * @param {Array<Object>} submissions - Array of submissions
   * @returns {Object} - Object with counts by status
   * @private
   */
  _countSubmissionsByStatus(submissions) {
    const counts = {
      draft: 0,
      pending_verification: 0,
      verification_failed: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      unpublished: 0,
      archived: 0,
      deleted: 0
    };
    
    submissions.forEach(submission => {
      if (counts[submission.status] !== undefined) {
        counts[submission.status]++;
      }
    });
    
    return counts;
  }

  /**
   * Get tentacle performance data
   * @param {string} developerId - Developer account ID
   * @param {Array<Object>} submissions - Array of submissions
   * @param {Object} options - Options for performance data
   * @returns {Promise<Array<Object>>} - Promise resolving to tentacle performance data
   * @private
   */
  async _getTentaclePerformance(developerId, submissions, options = {}) {
    const publishedSubmissions = submissions.filter(sub => sub.status === 'published');
    
    if (publishedSubmissions.length === 0) {
      return [];
    }
    
    if (!this.analyticsService) {
      // If no analytics service, return mock data
      return publishedSubmissions.map(sub => ({
        tentacleId: sub.tentacleData.id,
        name: sub.tentacleData.name,
        version: sub.tentacleData.version,
        category: sub.tentacleData.category,
        downloads: Math.floor(Math.random() * 1000),
        rating: (3.5 + Math.random() * 1.5).toFixed(1),
        reviewCount: Math.floor(Math.random() * 100),
        activeUsers: Math.floor(Math.random() * 500),
        averageUsageTime: Math.floor(Math.random() * 60) + ' minutes',
        crashRate: (Math.random() * 2).toFixed(2) + '%'
      }));
    }
    
    // Get time range
    const timeRange = options.timeRange || 'month';
    const timeRangeMs = this.timeRanges[timeRange]?.milliseconds || this.timeRanges.month.milliseconds;
    
    // Get performance data from analytics service
    const performanceData = [];
    
    for (const submission of publishedSubmissions) {
      try {
        const analytics = await this.analyticsService.getTentacleAnalytics(
          submission.tentacleData.id,
          {
            startDate: new Date(Date.now() - timeRangeMs).toISOString(),
            endDate: new Date().toISOString(),
            metrics: [
              'downloads', 'rating', 'review_count', 'active_users',
              'average_usage_time', 'crash_rate'
            ]
          }
        );
        
        performanceData.push({
          tentacleId: submission.tentacleData.id,
          name: submission.tentacleData.name,
          version: submission.tentacleData.version,
          category: submission.tentacleData.category,
          downloads: analytics.downloads || 0,
          rating: analytics.rating || 0,
          reviewCount: analytics.review_count || 0,
          activeUsers: analytics.active_users || 0,
          averageUsageTime: analytics.average_usage_time || '0 minutes',
          crashRate: (analytics.crash_rate || 0) + '%'
        });
      } catch (error) {
        this.logger.error(`Failed to get analytics for tentacle: ${submission.tentacleData.id}`, error);
        
        // Add placeholder data
        performanceData.push({
          tentacleId: submission.tentacleData.id,
          name: submission.tentacleData.name,
          version: submission.tentacleData.version,
          category: submission.tentacleData.category,
          downloads: 0,
          rating: 0,
          reviewCount: 0,
          activeUsers: 0,
          averageUsageTime: '0 minutes',
          crashRate: '0%',
          error: 'Failed to load analytics'
        });
      }
    }
    
    return performanceData;
  }

  /**
   * Get recent activity for a developer
   * @param {string} developerId - Developer account ID
   * @param {Array<Object>} submissions - Array of submissions
   * @param {Object} options - Options for activity data
   * @returns {Promise<Array<Object>>} - Promise resolving to recent activity data
   * @private
   */
  async _getRecentActivity(developerId, submissions, options = {}) {
    const activities = [];
    
    // Get limit for activities
    const limit = options.activityLimit || 10;
    
    // Extract activities from submission history
    for (const submission of submissions) {
      for (const historyEntry of submission.history || []) {
        activities.push({
          type: 'submission',
          action: historyEntry.action,
          details: historyEntry.details,
          timestamp: historyEntry.timestamp,
          tentacleId: submission.tentacleData.id,
          tentacleName: submission.tentacleData.name
        });
      }
      
      // Add version activities
      for (const versionRef of submission.versions || []) {
        try {
          const version = await this.submissionSystem.getVersion(versionRef.id);
          
          for (const historyEntry of version.history || []) {
            activities.push({
              type: 'version',
              action: historyEntry.action,
              details: historyEntry.details,
              timestamp: historyEntry.timestamp,
              tentacleId: submission.tentacleData.id,
              tentacleName: submission.tentacleData.name,
              version: version.version
            });
          }
        } catch (error) {
          this.logger.error(`Failed to get version: ${versionRef.id}`, error);
        }
      }
    }
    
    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit number of activities
    return activities.slice(0, limit);
  }

  /**
   * Get revenue data for a developer
   * @param {string} developerId - Developer account ID
   * @param {Array<Object>} submissions - Array of submissions
   * @param {Object} options - Options for revenue data
   * @returns {Promise<Object>} - Promise resolving to revenue data
   * @private
   */
  async _getRevenueData(developerId, submissions, options = {}) {
    const paidSubmissions = submissions.filter(sub => 
      sub.status === 'published' && 
      sub.tentacleData.pricing && 
      sub.tentacleData.pricing.type !== 'free'
    );
    
    if (paidSubmissions.length === 0) {
      return {
        totalRevenue: 0,
        revenueByTentacle: [],
        revenueByPeriod: {
          daily: [],
          monthly: []
        },
        revenueByType: {
          one_time: 0,
          subscription: 0,
          usage_based: 0
        }
      };
    }
    
    if (!this.monetizationService) {
      // If no monetization service, return mock data
      const mockTotalRevenue = paidSubmissions.length * Math.floor(Math.random() * 1000);
      
      return {
        totalRevenue: mockTotalRevenue,
        revenueByTentacle: paidSubmissions.map(sub => ({
          tentacleId: sub.tentacleData.id,
          name: sub.tentacleData.name,
          revenue: Math.floor(Math.random() * (mockTotalRevenue / paidSubmissions.length))
        })),
        revenueByPeriod: {
          daily: Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return {
              date: date.toISOString().split('T')[0],
              revenue: Math.floor(Math.random() * (mockTotalRevenue / 10))
            };
          }).reverse(),
          monthly: Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return {
              month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
              revenue: Math.floor(Math.random() * (mockTotalRevenue / 3))
            };
          }).reverse()
        },
        revenueByType: {
          one_time: Math.floor(mockTotalRevenue * 0.4),
          subscription: Math.floor(mockTotalRevenue * 0.5),
          usage_based: Math.floor(mockTotalRevenue * 0.1)
        }
      };
    }
    
    // Get time range
    const timeRange = options.timeRange || 'month';
    const timeRangeMs = this.timeRanges[timeRange]?.milliseconds || this.timeRanges.month.milliseconds;
    
    // Get revenue data from monetization service
    try {
      const revenueData = await this.monetizationService.getDeveloperRevenue(
        developerId,
        {
          startDate: new Date(Date.now() - timeRangeMs).toISOString(),
          endDate: new Date().toISOString(),
          groupBy: ['tentacle', 'day', 'month', 'type']
        }
      );
      
      return revenueData;
    } catch (error) {
      this.logger.error(`Failed to get revenue data for developer: ${developerId}`, error);
      
      // Return empty data on error
      return {
        totalRevenue: 0,
        revenueByTentacle: [],
        revenueByPeriod: {
          daily: [],
          monthly: []
        },
        revenueByType: {
          one_time: 0,
          subscription: 0,
          usage_based: 0
        },
        error: 'Failed to load revenue data'
      };
    }
  }

  /**
   * Get user engagement data for a developer's tentacles
   * @param {string} developerId - Developer account ID
   * @param {Array<Object>} submissions - Array of submissions
   * @param {Object} options - Options for engagement data
   * @returns {Promise<Object>} - Promise resolving to user engagement data
   * @private
   */
  async _getUserEngagement(developerId, submissions, options = {}) {
    const publishedSubmissions = submissions.filter(sub => sub.status === 'published');
    
    if (publishedSubmissions.length === 0) {
      return {
        totalActiveUsers: 0,
        activeUsersByTentacle: [],
        userRetention: {
          day1: 0,
          day7: 0,
          day30: 0
        },
        sessionMetrics: {
          averageDuration: '0 minutes',
          averageSessionsPerUser: 0
        },
        userGrowth: []
      };
    }
    
    if (!this.analyticsService) {
      // If no analytics service, return mock data
      const mockTotalUsers = publishedSubmissions.length * Math.floor(Math.random() * 500);
      
      return {
        totalActiveUsers: mockTotalUsers,
        activeUsersByTentacle: publishedSubmissions.map(sub => ({
          tentacleId: sub.tentacleData.id,
          name: sub.tentacleData.name,
          activeUsers: Math.floor(Math.random() * (mockTotalUsers / publishedSubmissions.length))
        })),
        userRetention: {
          day1: Math.floor(Math.random() * 40 + 60),
          day7: Math.floor(Math.random() * 30 + 30),
          day30: Math.floor(Math.random() * 20 + 10)
        },
        sessionMetrics: {
          averageDuration: Math.floor(Math.random() * 60) + ' minutes',
          averageSessionsPerUser: (Math.random() * 5 + 1).toFixed(1)
        },
        userGrowth: Array.from({ length: 6 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          return {
            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            users: Math.floor(mockTotalUsers / (i + 1))
          };
        }).reverse()
      };
    }
    
    // Get time range
    const timeRange = options.timeRange || 'month';
    const timeRangeMs = this.timeRanges[timeRange]?.milliseconds || this.timeRanges.month.milliseconds;
    
    // Get engagement data from analytics service
    try {
      const engagementData = await this.analyticsService.getDeveloperEngagement(
        developerId,
        {
          startDate: new Date(Date.now() - timeRangeMs).toISOString(),
          endDate: new Date().toISOString()
        }
      );
      
      return engagementData;
    } catch (error) {
      this.logger.error(`Failed to get engagement data for developer: ${developerId}`, error);
      
      // Return empty data on error
      return {
        totalActiveUsers: 0,
        activeUsersByTentacle: [],
        userRetention: {
          day1: 0,
          day7: 0,
          day30: 0
        },
        sessionMetrics: {
          averageDuration: '0 minutes',
          averageSessionsPerUser: 0
        },
        userGrowth: [],
        error: 'Failed to load engagement data'
      };
    }
  }

  /**
   * Get feedback data for a developer's tentacles
   * @param {string} developerId - Developer account ID
   * @param {Array<Object>} submissions - Array of submissions
   * @param {Object} options - Options for feedback data
   * @returns {Promise<Object>} - Promise resolving to feedback data
   * @private
   */
  async _getFeedbackData(developerId, submissions, options = {}) {
    const publishedSubmissions = submissions.filter(sub => sub.status === 'published');
    
    if (publishedSubmissions.length === 0) {
      return {
        overallRating: 0,
        ratingsByTentacle: [],
        recentReviews: [],
        sentimentAnalysis: {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        commonFeedbackTopics: []
      };
    }
    
    if (!this.analyticsService) {
      // If no analytics service, return mock data
      const mockOverallRating = (3.5 + Math.random() * 1.5).toFixed(1);
      
      return {
        overallRating: mockOverallRating,
        ratingsByTentacle: publishedSubmissions.map(sub => ({
          tentacleId: sub.tentacleData.id,
          name: sub.tentacleData.name,
          rating: (3 + Math.random() * 2).toFixed(1),
          reviewCount: Math.floor(Math.random() * 100)
        })),
        recentReviews: Array.from({ length: 5 }, () => ({
          tentacleId: publishedSubmissions[Math.floor(Math.random() * publishedSubmissions.length)].tentacleData.id,
          tentacleName: publishedSubmissions[Math.floor(Math.random() * publishedSubmissions.length)].tentacleData.name,
          rating: Math.floor(Math.random() * 5) + 1,
          comment: 'This is a mock review comment.',
          date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
        })),
        sentimentAnalysis: {
          positive: Math.floor(Math.random() * 40 + 40),
          neutral: Math.floor(Math.random() * 30),
          negative: Math.floor(Math.random() * 30)
        },
        commonFeedbackTopics: [
          { topic: 'User Interface', count: Math.floor(Math.random() * 50) },
          { topic: 'Performance', count: Math.floor(Math.random() * 40) },
          { topic: 'Features', count: Math.floor(Math.random() * 30) },
          { topic: 'Documentation', count: Math.floor(Math.random() * 20) },
          { topic: 'Stability', count: Math.floor(Math.random() * 10) }
        ]
      };
    }
    
    // Get time range
    const timeRange = options.timeRange || 'month';
    const timeRangeMs = this.timeRanges[timeRange]?.milliseconds || this.timeRanges.month.milliseconds;
    
    // Get feedback data from analytics service
    try {
      const feedbackData = await this.analyticsService.getDeveloperFeedback(
        developerId,
        {
          startDate: new Date(Date.now() - timeRangeMs).toISOString(),
          endDate: new Date().toISOString(),
          limit: options.reviewLimit || 10
        }
      );
      
      return feedbackData;
    } catch (error) {
      this.logger.error(`Failed to get feedback data for developer: ${developerId}`, error);
      
      // Return empty data on error
      return {
        overallRating: 0,
        ratingsByTentacle: [],
        recentReviews: [],
        sentimentAnalysis: {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        commonFeedbackTopics: [],
        error: 'Failed to load feedback data'
      };
    }
  }

  /**
   * Get developer resources
   * @param {string} developerId - Developer account ID
   * @param {Object} options - Options for resources data
   * @returns {Promise<Array<Object>>} - Promise resolving to developer resources
   * @private
   */
  async _getDeveloperResources(developerId, options = {}) {
    // Return static developer resources
    return [
      {
        type: 'documentation',
        title: 'Tentacle Development Guide',
        description: 'Comprehensive guide for developing Aideon tentacles',
        url: '/developer/docs/tentacle-development-guide'
      },
      {
        type: 'documentation',
        title: 'API Reference',
        description: 'Complete API reference for Aideon tentacle development',
        url: '/developer/docs/api-reference'
      },
      {
        type: 'template',
        title: 'Basic Tentacle Template',
        description: 'Starting template for creating a basic tentacle',
        url: '/developer/templates/basic-tentacle'
      },
      {
        type: 'template',
        title: 'AI Assistant Tentacle Template',
        description: 'Template for creating AI-powered assistant tentacles',
        url: '/developer/templates/ai-assistant'
      },
      {
        type: 'tool',
        title: 'Tentacle Validator',
        description: 'Tool for validating tentacle packages',
        url: '/developer/tools/validator'
      },
      {
        type: 'tool',
        title: 'Tentacle Debugger',
        description: 'Tool for debugging tentacles during development',
        url: '/developer/tools/debugger'
      },
      {
        type: 'community',
        title: 'Developer Forum',
        description: 'Community forum for Aideon tentacle developers',
        url: '/developer/community/forum'
      },
      {
        type: 'community',
        title: 'Code Examples Repository',
        description: 'Repository of code examples for tentacle development',
        url: '/developer/community/code-examples'
      }
    ];
  }

  /**
   * Get tentacle management data for a developer
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to tentacle management data
   */
  async getTentacleManagementData(developerId) {
    if (!this.initialized) {
      throw new Error('DeveloperDashboard not initialized');
    }
    
    this.logger.info(`Getting tentacle management data for developer: ${developerId}`);
    
    // Get submissions for developer
    const submissions = await this.submissionSystem.getSubmissionsForDeveloper(developerId);
    
    // Group submissions by status
    const submissionsByStatus = {
      draft: submissions.filter(sub => sub.status === 'draft'),
      pending_verification: submissions.filter(sub => sub.status === 'pending_verification'),
      verification_failed: submissions.filter(sub => sub.status === 'verification_failed'),
      approved: submissions.filter(sub => sub.status === 'approved'),
      rejected: submissions.filter(sub => sub.status === 'rejected'),
      published: submissions.filter(sub => sub.status === 'published'),
      unpublished: submissions.filter(sub => sub.status === 'unpublished'),
      archived: submissions.filter(sub => sub.status === 'archived')
    };
    
    // Get versions for each submission
    const versionsData = [];
    
    for (const submission of submissions) {
      for (const versionRef of submission.versions || []) {
        try {
          const version = await this.submissionSystem.getVersion(versionRef.id);
          
          versionsData.push({
            versionId: version.id,
            submissionId: submission.id,
            tentacleId: submission.tentacleData.id,
            tentacleName: submission.tentacleData.name,
            version: version.version,
            status: version.status,
            createdAt: version.createdAt,
            updatedAt: version.updatedAt
          });
        } catch (error) {
          this.logger.error(`Failed to get version: ${versionRef.id}`, error);
        }
      }
    }
    
    // Get beta programs
    const betaPrograms = [];
    
    if (this.submissionSystem.betaPrograms) {
      for (const submission of submissions) {
        try {
          const programs = Array.from(this.submissionSystem.betaPrograms.values())
            .filter(beta => beta.submissionId === submission.id);
          
          for (const program of programs) {
            betaPrograms.push({
              betaProgramId: program.id,
              submissionId: submission.id,
              tentacleId: submission.tentacleData.id,
              tentacleName: submission.tentacleData.name,
              name: program.name,
              version: program.version,
              status: program.status,
              participantCount: program.participants.length,
              maxParticipants: program.maxParticipants,
              startDate: program.startDate,
              endDate: program.endDate
            });
          }
        } catch (error) {
          this.logger.error(`Failed to get beta programs for submission: ${submission.id}`, error);
        }
      }
    }
    
    return {
      submissionsByStatus,
      versions: versionsData,
      betaPrograms,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get developer settings
   * @param {string} developerId - Developer account ID
   * @returns {Promise<Object>} - Promise resolving to developer settings
   */
  async getDeveloperSettings(developerId) {
    if (!this.initialized) {
      throw new Error('DeveloperDashboard not initialized');
    }
    
    this.logger.info(`Getting developer settings for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Get dashboard preferences
    const dashboardPreferences = account.metadata.dashboardPreferences || {
      widgets: Object.entries(this.dashboardWidgets).map(([id, widget]) => ({
        id,
        enabled: widget.defaultEnabled,
        position: widget.defaultPosition
      })),
      defaultTimeRange: 'month'
    };
    
    // Get notification preferences
    const notificationPreferences = account.metadata.notificationPreferences || {
      email: true,
      inApp: true,
      reviewNotifications: true,
      versionUpdateNotifications: true,
      revenueReportNotifications: true,
      securityAlertNotifications: true
    };
    
    // Get API keys
    const apiKeys = await this.accountManager.getApiKeysForDeveloper(developerId);
    
    return {
      dashboardPreferences,
      notificationPreferences,
      apiKeys,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Update developer settings
   * @param {string} developerId - Developer account ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} - Promise resolving to the updated settings
   */
  async updateDeveloperSettings(developerId, settings = {}) {
    if (!this.initialized) {
      throw new Error('DeveloperDashboard not initialized');
    }
    
    this.logger.info(`Updating developer settings for developer: ${developerId}`);
    
    // Get developer account
    const account = await this.accountManager.getDeveloperAccount(developerId);
    
    // Update metadata with new settings
    const updatedMetadata = {
      ...account.metadata
    };
    
    if (settings.dashboardPreferences) {
      updatedMetadata.dashboardPreferences = {
        ...(account.metadata.dashboardPreferences || {}),
        ...settings.dashboardPreferences
      };
    }
    
    if (settings.notificationPreferences) {
      updatedMetadata.notificationPreferences = {
        ...(account.metadata.notificationPreferences || {}),
        ...settings.notificationPreferences
      };
    }
    
    // Update developer account
    const updatedAccount = await this.accountManager.updateDeveloperAccount(developerId, {
      metadata: updatedMetadata
    });
    
    // Return updated settings
    return {
      dashboardPreferences: updatedAccount.metadata.dashboardPreferences,
      notificationPreferences: updatedAccount.metadata.notificationPreferences,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get the status of the developer dashboard
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      initialized: this.initialized
    };
  }

  /**
   * Shutdown the developer dashboard
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.warn('DeveloperDashboard not initialized');
      return true;
    }
    
    this.logger.info('Shutting down DeveloperDashboard');
    
    this.initialized = false;
    return true;
  }
}

module.exports = { DeveloperDashboard };
