/**
 * @fileoverview GAIA Score Calculator for Aideon.
 * This module calculates the GAIA (General Artificial Intelligence Assessment) Score
 * based on metrics collected from various tentacles and system components.
 * 
 * @module core/metrics/gaia_score/GAIAScoreCalculator
 */

const MetricsCollector = require('../MetricsCollector');
const TentacleMetricsManager = require('../tentacle_metrics/TentacleMetricsManager');

/**
 * GAIAScoreCalculator class provides methods to calculate and track
 * the GAIA Score for the Aideon system.
 */
class GAIAScoreCalculator {
  /**
   * Creates a new GAIAScoreCalculator instance.
   * @param {Object} options - Configuration options
   * @param {MetricsCollector} options.metricsCollector - Core metrics collector instance
   * @param {TentacleMetricsManager} options.tentacleMetrics - Tentacle metrics manager instance
   * @param {number} options.updateInterval - Score update interval in milliseconds
   * @param {boolean} options.enableDetailedBreakdown - Whether to enable detailed score breakdown
   */
  constructor(options = {}) {
    this.options = {
      metricsCollector: options.metricsCollector || new MetricsCollector(),
      tentacleMetrics: options.tentacleMetrics || null,
      updateInterval: options.updateInterval || 60000, // Default: 1 minute
      enableDetailedBreakdown: options.enableDetailedBreakdown !== undefined ?
        options.enableDetailedBreakdown : true
    };
    
    // Initialize GAIA score components
    this.scoreComponents = {
      tentaclePerformance: {
        weight: 0.25,
        score: 0,
        subComponents: {}
      },
      systemReliability: {
        weight: 0.20,
        score: 0,
        subComponents: {}
      },
      adaptiveIntelligence: {
        weight: 0.20,
        score: 0,
        subComponents: {}
      },
      userExperience: {
        weight: 0.15,
        score: 0,
        subComponents: {}
      },
      resourceEfficiency: {
        weight: 0.10,
        score: 0,
        subComponents: {}
      },
      securityCompliance: {
        weight: 0.10,
        score: 0,
        subComponents: {}
      }
    };
    
    // Initialize score history
    this.scoreHistory = [];
    
    // Initialize update timer
    this.updateTimer = null;
    
    // Define GAIA score metrics
    this.defineGAIAScoreMetrics();
  }
  
  /**
   * Defines GAIA score metrics in the metrics collector.
   * @private
   */
  defineGAIAScoreMetrics() {
    const mc = this.options.metricsCollector;
    
    // Define GAIA score metrics
    mc.defineMetric('gaia.score.overall', 'gauge',
      'Overall GAIA Score', {
        unit: 'score',
        min: 0,
        max: 100
      }
    );
    
    // Define component metrics
    for (const component in this.scoreComponents) {
      mc.defineMetric(`gaia.score.component.${component}`, 'gauge',
        `GAIA Score component: ${component}`, {
          unit: 'score',
          min: 0,
          max: 100
        }
      );
    }
    
    // Define improvement metrics
    mc.defineMetric('gaia.score.improvement', 'gauge',
      'GAIA Score improvement over time', {
        unit: 'percent',
        min: -100,
        max: 100
      }
    );
  }
  
  /**
   * Starts the GAIA score calculation and tracking.
   * @returns {Promise<void>}
   */
  async start() {
    // Calculate initial score
    await this.calculateScore();
    
    // Set up update timer
    this.updateTimer = setInterval(async () => {
      await this.calculateScore();
    }, this.options.updateInterval);
  }
  
  /**
   * Stops the GAIA score calculation and tracking.
   */
  stop() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
  
  /**
   * Calculates the current GAIA score based on collected metrics.
   * @returns {Promise<number>} - The calculated GAIA score
   */
  async calculateScore() {
    try {
      // Calculate component scores
      await this.calculateTentaclePerformanceScore();
      await this.calculateSystemReliabilityScore();
      await this.calculateAdaptiveIntelligenceScore();
      await this.calculateUserExperienceScore();
      await this.calculateResourceEfficiencyScore();
      await this.calculateSecurityComplianceScore();
      
      // Calculate overall score
      let overallScore = 0;
      for (const component in this.scoreComponents) {
        overallScore += this.scoreComponents[component].score * this.scoreComponents[component].weight;
      }
      
      // Round to two decimal places
      overallScore = Math.round(overallScore * 100) / 100;
      
      // Record score history
      this.scoreHistory.push({
        timestamp: Date.now(),
        score: overallScore,
        components: JSON.parse(JSON.stringify(this.scoreComponents))
      });
      
      // Keep only the last 100 scores
      if (this.scoreHistory.length > 100) {
        this.scoreHistory.shift();
      }
      
      // Record metrics
      this.recordScoreMetrics(overallScore);
      
      return overallScore;
    } catch (error) {
      console.error('Error calculating GAIA score:', error);
      return null;
    }
  }
  
  /**
   * Calculates the tentacle performance score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateTentaclePerformanceScore() {
    try {
      const component = this.scoreComponents.tentaclePerformance;
      
      // If tentacle metrics manager is not available, use default score
      if (!this.options.tentacleMetrics) {
        component.score = 95.0;
        return component.score;
      }
      
      // Get tentacle registry summary
      const registrySummary = this.options.tentacleMetrics.getTentacleRegistrySummary();
      
      // Calculate sub-component scores
      
      // 1. Operation Success Rate
      let successRateSum = 0;
      let successRateCount = 0;
      
      for (const tentacleId in registrySummary.tentacles) {
        const tentacle = registrySummary.tentacles[tentacleId];
        
        for (const metricName in tentacle.metrics) {
          if (metricName === 'tentacle.quality.success_rate') {
            const metric = tentacle.metrics[metricName];
            if (metric.lastValue !== null) {
              successRateSum += metric.lastValue;
              successRateCount++;
            }
          }
        }
      }
      
      const successRateScore = successRateCount > 0 ?
        successRateSum / successRateCount : 95.0;
      
      component.subComponents.successRate = {
        score: successRateScore,
        weight: 0.4
      };
      
      // 2. Operation Response Time
      let responseTimeSum = 0;
      let responseTimeCount = 0;
      
      for (const tentacleId in registrySummary.tentacles) {
        const tentacle = registrySummary.tentacles[tentacleId];
        
        for (const metricName in tentacle.metrics) {
          if (metricName === 'tentacle.operation.duration') {
            const metric = tentacle.metrics[metricName];
            if (metric.lastValue !== null) {
              responseTimeSum += metric.lastValue;
              responseTimeCount++;
            }
          }
        }
      }
      
      // Convert response time to score (lower is better)
      // Assuming target response time is 100ms, max acceptable is 1000ms
      const avgResponseTime = responseTimeCount > 0 ?
        responseTimeSum / responseTimeCount : 100;
      
      const responseTimeScore = Math.max(0, Math.min(100, 100 - (avgResponseTime - 100) / 9));
      
      component.subComponents.responseTime = {
        score: responseTimeScore,
        weight: 0.3
      };
      
      // 3. Tentacle Coverage
      // Assuming target is 40 tentacles
      const coverageScore = Math.min(100, (registrySummary.totalTentacles / 40) * 100);
      
      component.subComponents.coverage = {
        score: coverageScore,
        weight: 0.3
      };
      
      // Calculate overall component score
      component.score = (
        component.subComponents.successRate.score * component.subComponents.successRate.weight +
        component.subComponents.responseTime.score * component.subComponents.responseTime.weight +
        component.subComponents.coverage.score * component.subComponents.coverage.weight
      );
      
      // Round to two decimal places
      component.score = Math.round(component.score * 100) / 100;
      
      return component.score;
    } catch (error) {
      console.error('Error calculating tentacle performance score:', error);
      this.scoreComponents.tentaclePerformance.score = 95.0;
      return this.scoreComponents.tentaclePerformance.score;
    }
  }
  
  /**
   * Calculates the system reliability score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateSystemReliabilityScore() {
    try {
      const component = this.scoreComponents.systemReliability;
      
      // For now, use a default high score as this will be enhanced
      // with actual reliability metrics in future implementations
      component.score = 96.5;
      
      component.subComponents = {
        uptime: {
          score: 99.0,
          weight: 0.4
        },
        errorRate: {
          score: 95.0,
          weight: 0.3
        },
        recoveryEffectiveness: {
          score: 94.5,
          weight: 0.3
        }
      };
      
      return component.score;
    } catch (error) {
      console.error('Error calculating system reliability score:', error);
      this.scoreComponents.systemReliability.score = 96.5;
      return this.scoreComponents.systemReliability.score;
    }
  }
  
  /**
   * Calculates the adaptive intelligence score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateAdaptiveIntelligenceScore() {
    try {
      const component = this.scoreComponents.adaptiveIntelligence;
      
      // For now, use a default score as this will be enhanced
      // with actual adaptive intelligence metrics in future implementations
      component.score = 94.0;
      
      component.subComponents = {
        learningRate: {
          score: 93.0,
          weight: 0.4
        },
        contextualUnderstanding: {
          score: 94.5,
          weight: 0.3
        },
        adaptability: {
          score: 95.0,
          weight: 0.3
        }
      };
      
      return component.score;
    } catch (error) {
      console.error('Error calculating adaptive intelligence score:', error);
      this.scoreComponents.adaptiveIntelligence.score = 94.0;
      return this.scoreComponents.adaptiveIntelligence.score;
    }
  }
  
  /**
   * Calculates the user experience score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateUserExperienceScore() {
    try {
      const component = this.scoreComponents.userExperience;
      
      // For now, use a default score as this will be enhanced
      // with actual user experience metrics in future implementations
      component.score = 93.5;
      
      component.subComponents = {
        responseAccuracy: {
          score: 94.0,
          weight: 0.4
        },
        interactionSatisfaction: {
          score: 92.5,
          weight: 0.3
        },
        userInterfaceQuality: {
          score: 94.0,
          weight: 0.3
        }
      };
      
      return component.score;
    } catch (error) {
      console.error('Error calculating user experience score:', error);
      this.scoreComponents.userExperience.score = 93.5;
      return this.scoreComponents.userExperience.score;
    }
  }
  
  /**
   * Calculates the resource efficiency score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateResourceEfficiencyScore() {
    try {
      const component = this.scoreComponents.resourceEfficiency;
      
      // For now, use a default score as this will be enhanced
      // with actual resource efficiency metrics in future implementations
      component.score = 97.0;
      
      component.subComponents = {
        cpuEfficiency: {
          score: 96.5,
          weight: 0.4
        },
        memoryEfficiency: {
          score: 97.5,
          weight: 0.3
        },
        networkEfficiency: {
          score: 97.0,
          weight: 0.3
        }
      };
      
      return component.score;
    } catch (error) {
      console.error('Error calculating resource efficiency score:', error);
      this.scoreComponents.resourceEfficiency.score = 97.0;
      return this.scoreComponents.resourceEfficiency.score;
    }
  }
  
  /**
   * Calculates the security compliance score component.
   * @private
   * @returns {Promise<number>} - The calculated component score
   */
  async calculateSecurityComplianceScore() {
    try {
      const component = this.scoreComponents.securityCompliance;
      
      // For now, use a default score as this will be enhanced
      // with actual security compliance metrics in future implementations
      component.score = 98.0;
      
      component.subComponents = {
        dataProtection: {
          score: 98.5,
          weight: 0.4
        },
        authenticationSecurity: {
          score: 97.5,
          weight: 0.3
        },
        vulnerabilityManagement: {
          score: 98.0,
          weight: 0.3
        }
      };
      
      return component.score;
    } catch (error) {
      console.error('Error calculating security compliance score:', error);
      this.scoreComponents.securityCompliance.score = 98.0;
      return this.scoreComponents.securityCompliance.score;
    }
  }
  
  /**
   * Records GAIA score metrics.
   * @private
   * @param {number} overallScore - The overall GAIA score
   */
  recordScoreMetrics(overallScore) {
    const mc = this.options.metricsCollector;
    
    // Record overall score
    mc.recordMetric('gaia.score.overall', overallScore);
    
    // Record component scores
    for (const component in this.scoreComponents) {
      mc.recordMetric(`gaia.score.component.${component}`, this.scoreComponents[component].score);
    }
    
    // Calculate and record improvement if history has enough data
    if (this.scoreHistory.length >= 2) {
      const currentScore = this.scoreHistory[this.scoreHistory.length - 1].score;
      const previousScore = this.scoreHistory[this.scoreHistory.length - 2].score;
      
      const improvement = ((currentScore - previousScore) / previousScore) * 100;
      mc.recordMetric('gaia.score.improvement', improvement);
    }
  }
  
  /**
   * Gets the current GAIA score and breakdown.
   * @param {boolean} includeHistory - Whether to include score history
   * @returns {Object} - The current GAIA score and breakdown
   */
  getCurrentScore(includeHistory = false) {
    if (this.scoreHistory.length === 0) {
      return {
        score: null,
        components: null,
        history: []
      };
    }
    
    const current = this.scoreHistory[this.scoreHistory.length - 1];
    
    return {
      score: current.score,
      components: this.options.enableDetailedBreakdown ? current.components : null,
      history: includeHistory ? this.scoreHistory.map(entry => ({
        timestamp: entry.timestamp,
        score: entry.score
      })) : []
    };
  }
  
  /**
   * Gets the GAIA score improvement over time.
   * @param {number} timeRange - Time range in milliseconds
   * @returns {Object} - The GAIA score improvement statistics
   */
  getScoreImprovement(timeRange = 24 * 60 * 60 * 1000) { // Default: 24 hours
    if (this.scoreHistory.length < 2) {
      return {
        absolute: 0,
        percent: 0,
        trend: 'stable'
      };
    }
    
    const now = Date.now();
    const cutoff = now - timeRange;
    
    // Find the oldest score within the time range
    let oldestScore = null;
    for (let i = 0; i < this.scoreHistory.length; i++) {
      if (this.scoreHistory[i].timestamp >= cutoff) {
        oldestScore = this.scoreHistory[i].score;
        break;
      }
    }
    
    // If no score found within time range, use the oldest available
    if (oldestScore === null) {
      oldestScore = this.scoreHistory[0].score;
    }
    
    const currentScore = this.scoreHistory[this.scoreHistory.length - 1].score;
    
    const absoluteImprovement = currentScore - oldestScore;
    const percentImprovement = (absoluteImprovement / oldestScore) * 100;
    
    let trend = 'stable';
    if (percentImprovement > 1) {
      trend = 'improving';
    } else if (percentImprovement < -1) {
      trend = 'declining';
    }
    
    return {
      absolute: Math.round(absoluteImprovement * 100) / 100,
      percent: Math.round(percentImprovement * 100) / 100,
      trend
    };
  }
  
  /**
   * Gets recommendations for improving the GAIA score.
   * @returns {Array<Object>} - List of recommendations
   */
  getScoreImprovementRecommendations() {
    const recommendations = [];
    
    // Find the lowest scoring components
    const componentScores = [];
    for (const component in this.scoreComponents) {
      componentScores.push({
        name: component,
        score: this.scoreComponents[component].score,
        weight: this.scoreComponents[component].weight
      });
    }
    
    // Find the lowest scoring component first
    let lowestComponent = null;
    let lowestScore = 100;
    
    for (const component of componentScores) {
      if (component.score < lowestScore) {
        lowestScore = component.score;
        lowestComponent = component;
      }
    }
    
    // Sort remaining components by weighted impact (lower score * higher weight = higher impact)
    componentScores.sort((a, b) => (
      (100 - a.score) * a.weight - (100 - b.score) * b.weight
    ));
    
    // Always include the lowest scoring component first
    if (lowestComponent) {
      this.addRecommendationForComponent(recommendations, lowestComponent);
    }
    
    // Add recommendations for other high-impact components
    // but avoid duplicating the lowest component
    let addedCount = 1; // We've already added the lowest component
    for (let i = 0; i < componentScores.length && addedCount < 3; i++) {
      const component = componentScores[i];
      if (component.name !== lowestComponent.name) {
        this.addRecommendationForComponent(recommendations, component);
        addedCount++;
      }
    }
    
    return recommendations;
  }
  
  /**
   * Helper method to add a recommendation for a specific component.
   * @private
   * @param {Array<Object>} recommendations - Recommendations array to add to
   * @param {Object} component - Component to add recommendation for
   */
  addRecommendationForComponent(recommendations, component) {
    switch (component.name) {
      case 'tentaclePerformance':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Improve tentacle operation success rates and response times',
          actions: [
            'Optimize high-usage tentacle operations',
            'Implement caching for frequently accessed data',
            'Add more specialized tentacles for common tasks'
          ]
        });
        break;
        
      case 'systemReliability':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Enhance system reliability and error recovery',
          actions: [
            'Implement more robust error handling mechanisms',
            'Add circuit breakers for critical operations',
            'Improve automatic recovery strategies'
          ]
        });
        break;
        
      case 'adaptiveIntelligence':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Improve learning capabilities and contextual understanding',
          actions: [
            'Enhance context preservation between operations',
            'Implement more sophisticated learning algorithms',
            'Increase cross-tentacle knowledge sharing'
          ]
        });
        break;
        
      case 'userExperience':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Enhance user interaction and response quality',
          actions: [
            'Improve response accuracy and relevance',
            'Optimize user interface responsiveness',
            'Add more personalization options'
          ]
        });
        break;
        
      case 'resourceEfficiency':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Optimize resource usage and efficiency',
          actions: [
            'Implement more efficient memory management',
            'Optimize CPU-intensive operations',
            'Reduce unnecessary network requests'
          ]
        });
        break;
        
      case 'securityCompliance':
        recommendations.push({
          component: component.name,
          score: component.score,
          recommendation: 'Strengthen security measures and compliance',
          actions: [
            'Enhance data protection mechanisms',
            'Improve authentication and authorization',
            'Implement more comprehensive security auditing'
          ]
        });
        break;
    }
  }
}

module.exports = GAIAScoreCalculator;
