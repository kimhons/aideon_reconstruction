/**
 * @fileoverview GIAIA Score Visualization for displaying Aideon's intelligence and capability metrics.
 * This module provides visualization components for the GIAIA scoring system.
 * 
 * @module core/giaia/GIAIAVisualization
 */

/**
 * GIAIA Score Visualization for displaying intelligence and capability metrics.
 */
class GIAIAVisualization {
  /**
   * Creates a new GIAIA Visualization system.
   * @param {GIAIAScoreCalculator} scoreCalculator - The GIAIA Score Calculator instance.
   */
  constructor(scoreCalculator) {
    this.scoreCalculator = scoreCalculator;
    this.colorSchemes = {
      standard: {
        primary: '#3498db',
        secondary: '#2ecc71',
        accent: '#e74c3c',
        background: '#f5f5f5',
        text: '#2c3e50'
      },
      dark: {
        primary: '#3498db',
        secondary: '#2ecc71',
        accent: '#e74c3c',
        background: '#2c3e50',
        text: '#ecf0f1'
      },
      octopus: {
        primary: '#9b59b6',
        secondary: '#3498db',
        accent: '#e74c3c',
        background: '#34495e',
        text: '#ecf0f1'
      }
    };
    
    this.currentColorScheme = 'standard';
    
    // Subscribe to score updates
    this.scoreCalculator.subscribeToScoreUpdates(this.handleScoreUpdate.bind(this));
    
    console.log('GIAIA Visualization system initialized');
  }
  
  /**
   * Handles score updates from the calculator.
   * @private
   * @param {Object} scoreData - Updated score data.
   */
  handleScoreUpdate(scoreData) {
    console.log('Received score update, refreshing visualizations');
    // In a real implementation, this would trigger UI updates
  }
  
  /**
   * Sets the color scheme for visualizations.
   * @param {string} schemeName - Name of the color scheme.
   */
  setColorScheme(schemeName) {
    if (this.colorSchemes[schemeName]) {
      this.currentColorScheme = schemeName;
      console.log(`Color scheme set to: ${schemeName}`);
      return true;
    }
    console.log(`Unknown color scheme: ${schemeName}`);
    return false;
  }
  
  /**
   * Generates a dashboard HTML for the GIAIA score.
   * @param {Object} scoreData - GIAIA score data.
   * @param {Object} options - Visualization options.
   * @returns {string} - Dashboard HTML.
   */
  generateDashboardHTML(scoreData, options = {}) {
    const colors = this.colorSchemes[this.currentColorScheme];
    const showHistory = options.showHistory !== false;
    const showDomains = options.showDomains !== false;
    const showRecommendations = options.showRecommendations !== false;
    
    let html = `
      <div class="giaia-dashboard" style="font-family: Arial, sans-serif; background-color: ${colors.background}; color: ${colors.text}; padding: 20px; border-radius: 10px;">
        <div class="giaia-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h1 style="margin: 0; color: ${colors.text};">GIAIA Intelligence Score</h1>
          <div class="giaia-score-container" style="text-align: center;">
            <div class="giaia-score" style="font-size: 48px; font-weight: bold; color: ${colors.primary};">
              ${scoreData.giaiaScore}%
            </div>
            <div class="giaia-confidence" style="font-size: 14px; color: ${colors.text};">
              ±${scoreData.confidenceInterval}% confidence
            </div>
          </div>
        </div>
        
        <div class="giaia-benchmark-comparison" style="margin-bottom: 20px; padding: 15px; background-color: rgba(255,255,255,0.1); border-radius: 8px;">
          <h3 style="margin-top: 0; color: ${colors.text};">Benchmark Comparison</h3>
          <div class="benchmark-bars" style="display: flex; flex-direction: column; gap: 10px;">
            ${this.generateBenchmarkBars(scoreData.benchmarkComparison, colors)}
          </div>
        </div>
    `;
    
    if (showDomains) {
      html += `
        <div class="giaia-domains" style="margin-bottom: 20px;">
          <h3 style="color: ${colors.text};">Intelligence Domains</h3>
          <div class="domain-chart" style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${this.generateDomainCharts(scoreData.domainBreakdown, colors)}
          </div>
        </div>
      `;
    }
    
    if (showHistory && scoreData.history && scoreData.history.length > 1) {
      html += `
        <div class="giaia-history" style="margin-bottom: 20px;">
          <h3 style="color: ${colors.text};">Score History</h3>
          <div class="history-chart" style="height: 200px; background-color: rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; position: relative;">
            ${this.generateHistoryChart(scoreData.history, colors)}
          </div>
        </div>
      `;
    }
    
    if (showRecommendations && scoreData.improvementRecommendations) {
      html += `
        <div class="giaia-recommendations" style="margin-bottom: 20px; padding: 15px; background-color: rgba(255,255,255,0.1); border-radius: 8px;">
          <h3 style="margin-top: 0; color: ${colors.text};">Improvement Recommendations</h3>
          <ul style="padding-left: 20px;">
            ${this.generateRecommendationsList(scoreData.improvementRecommendations, colors)}
          </ul>
        </div>
      `;
    }
    
    html += `
      </div>
    `;
    
    return html;
  }
  
  /**
   * Generates benchmark comparison bars.
   * @private
   * @param {Object} benchmarkComparison - Benchmark comparison data.
   * @param {Object} colors - Color scheme.
   * @returns {string} - HTML for benchmark bars.
   */
  generateBenchmarkBars(benchmarkComparison, colors) {
    let html = '';
    
    for (const [benchmark, data] of Object.entries(benchmarkComparison)) {
      const percentOfBenchmark = data.percentOfBenchmark;
      const barColor = percentOfBenchmark >= 100 ? colors.secondary : colors.primary;
      const barWidth = Math.min(100, percentOfBenchmark);
      
      html += `
        <div class="benchmark-item">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="text-transform: capitalize;">${benchmark.replace(/-/g, ' ')}</span>
            <span>${data.score}% (${percentOfBenchmark}%)</span>
          </div>
          <div style="height: 10px; background-color: rgba(255,255,255,0.2); border-radius: 5px; overflow: hidden;">
            <div style="height: 100%; width: ${barWidth}%; background-color: ${barColor};"></div>
          </div>
        </div>
      `;
    }
    
    return html;
  }
  
  /**
   * Generates domain charts.
   * @private
   * @param {Object} domainBreakdown - Domain breakdown data.
   * @param {Object} colors - Color scheme.
   * @returns {string} - HTML for domain charts.
   */
  generateDomainCharts(domainBreakdown, colors) {
    let html = '';
    
    for (const [domain, score] of Object.entries(domainBreakdown)) {
      const formattedDomain = domain.replace(/-/g, ' ');
      const scorePercent = Math.round(score);
      
      // Determine color based on score
      let domainColor = colors.primary;
      if (scorePercent >= 90) {
        domainColor = colors.secondary;
      } else if (scorePercent < 70) {
        domainColor = colors.accent;
      }
      
      html += `
        <div class="domain-item" style="flex: 1; min-width: 150px; max-width: 200px; text-align: center; padding: 15px; background-color: rgba(255,255,255,0.1); border-radius: 8px;">
          <div class="domain-score" style="position: relative; width: 100px; height: 100px; margin: 0 auto 10px;">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="10" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="${domainColor}" stroke-width="10" 
                      stroke-dasharray="${2 * Math.PI * 45}" stroke-dashoffset="${2 * Math.PI * 45 * (1 - scorePercent / 100)}" 
                      transform="rotate(-90 50 50)" />
            </svg>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: bold;">
              ${scorePercent}%
            </div>
          </div>
          <div class="domain-name" style="font-size: 14px; text-transform: capitalize;">
            ${formattedDomain}
          </div>
        </div>
      `;
    }
    
    return html;
  }
  
  /**
   * Generates history chart.
   * @private
   * @param {Array} history - Score history data.
   * @param {Object} colors - Color scheme.
   * @returns {string} - HTML for history chart.
   */
  generateHistoryChart(history, colors) {
    if (!history || history.length < 2) {
      return '<div style="text-align: center; padding: 20px;">Not enough history data</div>';
    }
    
    const chartWidth = 100;
    const chartHeight = 170;
    const padding = 10;
    const dataPoints = history.length;
    const pointSpacing = (chartWidth - 2 * padding) / (dataPoints - 1);
    
    // Find min and max scores
    const scores = history.map(entry => entry.score);
    const minScore = Math.max(0, Math.min(...scores) - 5);
    const maxScore = Math.min(100, Math.max(...scores) + 5);
    const scoreRange = maxScore - minScore;
    
    // Generate SVG path
    let pathD = '';
    let confidencePathUpper = '';
    let confidencePathLower = '';
    
    history.forEach((entry, index) => {
      const x = padding + index * pointSpacing;
      const y = chartHeight - padding - ((entry.score - minScore) / scoreRange) * (chartHeight - 2 * padding);
      
      if (index === 0) {
        pathD = `M ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
      
      // Confidence interval paths
      const upperY = chartHeight - padding - ((entry.score + entry.confidenceInterval - minScore) / scoreRange) * (chartHeight - 2 * padding);
      const lowerY = chartHeight - padding - ((entry.score - entry.confidenceInterval - minScore) / scoreRange) * (chartHeight - 2 * padding);
      
      if (index === 0) {
        confidencePathUpper = `M ${x} ${upperY}`;
        confidencePathLower = `M ${x} ${lowerY}`;
      } else {
        confidencePathUpper += ` L ${x} ${upperY}`;
        confidencePathLower += ` L ${x} ${lowerY}`;
      }
    });
    
    // Create confidence area path
    const lastIndex = history.length - 1;
    const lastX = padding + lastIndex * pointSpacing;
    const confidenceAreaPath = `${confidencePathUpper} L ${lastX} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`;
    
    return `
      <svg width="100%" height="100%" viewBox="0 0 ${chartWidth} ${chartHeight}">
        <!-- Y-axis labels -->
        <text x="5" y="${chartHeight - padding}" font-size="8" fill="${colors.text}">${minScore}%</text>
        <text x="5" y="${padding + 5}" font-size="8" fill="${colors.text}">${maxScore}%</text>
        
        <!-- Confidence interval area -->
        <path d="${confidenceAreaPath}" fill="${colors.primary}" opacity="0.2" />
        
        <!-- Score line -->
        <path d="${pathD}" stroke="${colors.primary}" stroke-width="2" fill="none" />
        
        <!-- Data points -->
        ${history.map((entry, index) => {
          const x = padding + index * pointSpacing;
          const y = chartHeight - padding - ((entry.score - minScore) / scoreRange) * (chartHeight - 2 * padding);
          return `<circle cx="${x}" cy="${y}" r="3" fill="${colors.primary}" />`;
        }).join('')}
      </svg>
    `;
  }
  
  /**
   * Generates recommendations list.
   * @private
   * @param {Object} recommendations - Improvement recommendations.
   * @param {Object} colors - Color scheme.
   * @returns {string} - HTML for recommendations list.
   */
  generateRecommendationsList(recommendations, colors) {
    let html = '';
    
    // Priority domains
    if (recommendations.priorityDomains && recommendations.priorityDomains.length > 0) {
      recommendations.priorityDomains.forEach(domain => {
        html += `
          <li style="margin-bottom: 10px;">
            <strong style="color: ${colors.primary}; text-transform: capitalize;">${domain.domain.replace(/-/g, ' ')}</strong>
            (Current: ${domain.currentScore}%, Potential: +${domain.potentialImprovement.toFixed(2)})
            <ul style="margin-top: 5px;">
              ${domain.components.map(comp => `
                <li style="margin-bottom: 5px;">
                  <span style="color: ${colors.secondary}; text-transform: capitalize;">${comp.component.replace(/-/g, ' ')}</span>:
                  ${comp.improvementSuggestion}
                </li>
              `).join('')}
            </ul>
          </li>
        `;
      });
    }
    
    // General recommendations
    if (recommendations.generalRecommendations && recommendations.generalRecommendations.length > 0) {
      recommendations.generalRecommendations.forEach(rec => {
        html += `<li style="margin-bottom: 10px;">${rec}</li>`;
      });
    }
    
    return html;
  }
  
  /**
   * Generates a real-time GIAIA score gauge for UI display.
   * @param {Object} scoreData - GIAIA score data.
   * @param {Object} options - Visualization options.
   * @returns {string} - Gauge HTML.
   */
  generateScoreGauge(scoreData, options = {}) {
    const colors = this.colorSchemes[this.currentColorScheme];
    const size = options.size || 200;
    const showLabel = options.showLabel !== false;
    const showConfidence = options.showConfidence !== false;
    
    // Determine gauge color based on score
    let gaugeColor = colors.primary;
    if (scoreData.giaiaScore >= 95) {
      gaugeColor = colors.secondary;
    } else if (scoreData.giaiaScore < 70) {
      gaugeColor = colors.accent;
    }
    
    // Calculate stroke dashoffset for gauge
    const radius = size * 0.4;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - scoreData.giaiaScore / 100);
    
    return `
      <div class="giaia-gauge" style="position: relative; width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <!-- Background circle -->
          <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                  fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="${size * 0.05}" />
          
          <!-- Score arc -->
          <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                  fill="none" stroke="${gaugeColor}" stroke-width="${size * 0.05}" 
                  stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" 
                  transform="rotate(-90 ${size/2} ${size/2})" 
                  stroke-linecap="round" />
          
          ${showConfidence ? `
            <!-- Confidence interval arcs -->
            <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                    fill="none" stroke="${gaugeColor}" stroke-width="${size * 0.01}" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${circumference * (1 - (scoreData.giaiaScore + scoreData.confidenceInterval) / 100)}" 
                    transform="rotate(-90 ${size/2} ${size/2})" 
                    stroke-linecap="round" opacity="0.5" />
            
            <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                    fill="none" stroke="${gaugeColor}" stroke-width="${size * 0.01}" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${circumference * (1 - (scoreData.giaiaScore - scoreData.confidenceInterval) / 100)}" 
                    transform="rotate(-90 ${size/2} ${size/2})" 
                    stroke-linecap="round" opacity="0.5" />
          ` : ''}
        </svg>
        
        ${showLabel ? `
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <div style="font-size: ${size * 0.2}px; font-weight: bold; color: ${colors.text};">
              ${scoreData.giaiaScore}%
            </div>
            ${showConfidence ? `
              <div style="font-size: ${size * 0.08}px; color: ${colors.text};">
                ±${scoreData.confidenceInterval}%
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  /**
   * Generates a compact GIAIA score widget for taskbar or system tray.
   * @param {Object} scoreData - GIAIA score data.
   * @returns {string} - Widget HTML.
   */
  generateCompactWidget(scoreData) {
    const colors = this.colorSchemes[this.currentColorScheme];
    
    // Determine color based on score
    let scoreColor = colors.primary;
    if (scoreData.giaiaScore >= 95) {
      scoreColor = colors.secondary;
    } else if (scoreData.giaiaScore < 70) {
      scoreColor = colors.accent;
    }
    
    return `
      <div class="giaia-widget" style="display: flex; align-items: center; background-color: ${colors.background}; padding: 5px 10px; border-radius: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        <div class="giaia-icon" style="width: 20px; height: 20px; border-radius: 50%; background-color: ${scoreColor}; margin-right: 8px; position: relative;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: white; font-weight: bold;">A</div>
        </div>
        <div class="giaia-widget-score" style="font-weight: bold; color: ${colors.text};">
          ${scoreData.giaiaScore}%
        </div>
      </div>
    `;
  }
  
  /**
   * Generates an animation for score changes.
   * @param {Object} oldScore - Previous score data.
   * @param {Object} newScore - New score data.
   * @returns {string} - Animation HTML/CSS.
   */
  generateScoreChangeAnimation(oldScore, newScore) {
    const colors = this.colorSchemes[this.currentColorScheme];
    const scoreDiff = newScore.giaiaScore - oldScore.giaiaScore;
    const isImprovement = scoreDiff > 0;
    
    const animationColor = isImprovement ? colors.secondary : colors.accent;
    const animationText = isImprovement ? `+${scoreDiff.toFixed(2)}%` : `${scoreDiff.toFixed(2)}%`;
    
    return `
      <style>
        @keyframes scoreChange {
          0% { opacity: 0; transform: translateY(${isImprovement ? '20px' : '-20px'}); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(${isImprovement ? '-20px' : '20px'}); }
        }
      </style>
      
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${animationColor}; font-size: 24px; font-weight: bold; animation: scoreChange 2s ease-in-out forwards;">
        ${animationText}
      </div>
    `;
  }
  
  /**
   * Generates a visual representation of enhancement impacts.
   * @param {Array} enhancementImpacts - List of enhancement impacts.
   * @returns {string} - Impact visualization HTML.
   */
  generateEnhancementImpactVisualization(enhancementImpacts) {
    const colors = this.colorSchemes[this.currentColorScheme];
    
    if (!enhancementImpacts || enhancementImpacts.length === 0) {
      return `<div style="text-align: center; padding: 20px; color: ${colors.text};">No enhancement impact data available</div>`;
    }
    
    // Sort enhancements by impact
    const sortedImpacts = [...enhancementImpacts].sort((a, b) => b.improvement - a.improvement);
    
    let html = `
      <div class="enhancement-impacts" style="padding: 15px; background-color: ${colors.background}; border-radius: 10px;">
        <h3 style="margin-top: 0; color: ${colors.text};">Enhancement Impacts</h3>
        <div class="impact-bars" style="display: flex; flex-direction: column; gap: 15px;">
    `;
    
    sortedImpacts.forEach(impact => {
      const barColor = impact.improvement > 0 ? colors.secondary : colors.accent;
      const barWidth = Math.min(100, Math.abs(impact.improvement) * 10); // Scale for visibility
      
      html += `
        <div class="impact-item">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: ${colors.text};">${impact.enhancementName}</span>
            <span style="color: ${barColor};">${impact.improvement > 0 ? '+' : ''}${impact.improvement.toFixed(2)}%</span>
          </div>
          <div style="height: 10px; background-color: rgba(255,255,255,0.2); border-radius: 5px; overflow: hidden;">
            <div style="height: 100%; width: ${barWidth}%; background-color: ${barColor};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: ${colors.text};">
            <span>Before: ${impact.scoreBefore.toFixed(2)}%</span>
            <span>After: ${impact.scoreAfter.toFixed(2)}%</span>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
  
  /**
   * Generates a projection visualization comparing current score with projected future score.
   * @param {Object} currentScore - Current GIAIA score.
   * @param {Object} projectedScore - Projected future GIAIA score.
   * @returns {string} - Projection visualization HTML.
   */
  generateProjectionVisualization(currentScore, projectedScore) {
    const colors = this.colorSchemes[this.currentColorScheme];
    
    const improvement = projectedScore.giaiaScore - currentScore.giaiaScore;
    const improvementColor = improvement > 0 ? colors.secondary : colors.accent;
    
    return `
      <div class="score-projection" style="padding: 15px; background-color: ${colors.background}; border-radius: 10px;">
        <h3 style="margin-top: 0; color: ${colors.text};">GIAIA Score Projection</h3>
        
        <div class="projection-comparison" style="display: flex; justify-content: space-between; margin: 20px 0;">
          <div class="current-score" style="text-align: center; flex: 1;">
            <div style="font-size: 14px; color: ${colors.text};">Current</div>
            <div style="font-size: 36px; font-weight: bold; color: ${colors.primary};">${currentScore.giaiaScore}%</div>
          </div>
          
          <div class="improvement" style="text-align: center; flex: 1;">
            <div style="font-size: 14px; color: ${colors.text};">Improvement</div>
            <div style="font-size: 24px; font-weight: bold; color: ${improvementColor};">
              ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%
            </div>
          </div>
          
          <div class="projected-score" style="text-align: center; flex: 1;">
            <div style="font-size: 14px; color: ${colors.text};">Projected</div>
            <div style="font-size: 36px; font-weight: bold; color: ${colors.secondary};">${projectedScore.giaiaScore}%</div>
          </div>
        </div>
        
        <div class="projection-bar" style="height: 20px; background-color: rgba(255,255,255,0.2); border-radius: 10px; margin: 20px 0; position: relative;">
          <!-- Current score marker -->
          <div style="position: absolute; left: ${currentScore.giaiaScore}%; top: 0; bottom: 0; width: 2px; background-color: ${colors.primary};"></div>
          
          <!-- Target score marker (99%) -->
          <div style="position: absolute; left: 99%; top: 0; bottom: 0; width: 2px; background-color: ${colors.text}; border-right: 2px dashed ${colors.text};"></div>
          
          <!-- Projected score fill -->
          <div style="height: 100%; width: ${projectedScore.giaiaScore}%; background-color: ${colors.secondary}; border-radius: 10px; opacity: 0.7;"></div>
          
          <!-- Labels -->
          <div style="position: absolute; bottom: -25px; left: ${currentScore.giaiaScore}%; transform: translateX(-50%); font-size: 12px; color: ${colors.text};">Current</div>
          <div style="position: absolute; bottom: -25px; left: ${projectedScore.giaiaScore}%; transform: translateX(-50%); font-size: 12px; color: ${colors.secondary};">Projected</div>
          <div style="position: absolute; bottom: -25px; left: 99%; transform: translateX(-50%); font-size: 12px; color: ${colors.text};">Target</div>
        </div>
        
        <div style="font-size: 14px; color: ${colors.text}; margin-top: 30px;">
          Projected improvements will bring the GIAIA score from ${currentScore.giaiaScore}% to ${projectedScore.giaiaScore}%, 
          ${projectedScore.giaiaScore >= 99 ? 'achieving' : 'approaching'} the target of 99%.
        </div>
      </div>
    `;
  }
}

module.exports = GIAIAVisualization;
