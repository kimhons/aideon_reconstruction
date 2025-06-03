/**
 * @fileoverview Advanced metrics aggregation and analysis utilities for the Standardized Metrics Collection system.
 * This module provides tools for complex metrics processing, trend analysis, anomaly detection,
 * and predictive analytics based on collected metrics data.
 * 
 * @module core/metrics/MetricsAnalytics
 */

/**
 * Performs trend analysis on time series metrics data.
 * @param {Array} metricsData - Array of metric data points
 * @param {Object} options - Analysis options
 * @returns {Object} - Trend analysis results
 */
function analyzeTrends(metricsData, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length < 2) {
    throw new Error('Metrics data must be an array with at least 2 data points');
  }
  
  const defaultOptions = {
    windowSize: Math.max(2, Math.floor(metricsData.length / 10)), // Default to 10% of data points
    smoothing: true,
    detectChangePoints: true,
    forecastPoints: Math.floor(metricsData.length * 0.2) // Default to 20% of data length
  };
  
  const analysisOptions = { ...defaultOptions, ...options };
  
  // Extract timestamps and values
  const timestamps = metricsData.map(d => d.timestamp);
  const values = metricsData.map(d => d.value);
  
  // Apply smoothing if enabled
  let smoothedValues = values;
  if (analysisOptions.smoothing) {
    smoothedValues = applyExponentialSmoothing(values, 0.3); // Alpha = 0.3 for moderate smoothing
  }
  
  // Calculate moving averages
  const movingAvg = calculateMovingAverage(smoothedValues, analysisOptions.windowSize);
  
  // Calculate rate of change
  const rateOfChange = calculateRateOfChange(smoothedValues);
  
  // Detect change points if enabled
  let changePoints = [];
  if (analysisOptions.detectChangePoints) {
    changePoints = detectChangePoints(smoothedValues, rateOfChange, 2.0); // 2.0 standard deviations
  }
  
  // Calculate linear regression for trend direction
  const regression = calculateLinearRegression(timestamps, smoothedValues);
  
  // Generate forecast if requested
  let forecast = [];
  if (analysisOptions.forecastPoints > 0) {
    forecast = generateForecast(timestamps, smoothedValues, regression, analysisOptions.forecastPoints);
  }
  
  // Determine overall trend direction
  const trendDirection = regression.slope > 0 ? 'increasing' : 
                        regression.slope < 0 ? 'decreasing' : 'stable';
  
  // Calculate trend strength (R-squared)
  const trendStrength = regression.r2;
  
  // Calculate volatility (coefficient of variation)
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const volatility = mean !== 0 ? stdDev / Math.abs(mean) : 0;
  
  return {
    trendDirection,
    trendStrength,
    volatility,
    regression: {
      slope: regression.slope,
      intercept: regression.intercept,
      r2: regression.r2
    },
    movingAverage: movingAvg,
    rateOfChange,
    changePoints,
    forecast
  };
}

/**
 * Applies exponential smoothing to a time series.
 * @private
 * @param {Array<number>} values - Array of values
 * @param {number} alpha - Smoothing factor (0 < alpha < 1)
 * @returns {Array<number>} - Smoothed values
 */
function applyExponentialSmoothing(values, alpha) {
  if (values.length === 0) return [];
  
  const smoothed = [values[0]]; // First value remains the same
  
  for (let i = 1; i < values.length; i++) {
    const smoothedValue = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
    smoothed.push(smoothedValue);
  }
  
  return smoothed;
}

/**
 * Calculates moving average for a time series.
 * @private
 * @param {Array<number>} values - Array of values
 * @param {number} windowSize - Size of the moving window
 * @returns {Array<number>} - Moving averages
 */
function calculateMovingAverage(values, windowSize) {
  const result = [];
  
  // Fill with nulls for the first windowSize-1 points
  for (let i = 0; i < windowSize - 1; i++) {
    result.push(null);
  }
  
  // Calculate moving averages
  for (let i = windowSize - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += values[i - j];
    }
    result.push(sum / windowSize);
  }
  
  return result;
}

/**
 * Calculates rate of change between consecutive points.
 * @private
 * @param {Array<number>} values - Array of values
 * @returns {Array<number>} - Rate of change values
 */
function calculateRateOfChange(values) {
  const result = [null]; // First point has no rate of change
  
  for (let i = 1; i < values.length; i++) {
    const previousValue = values[i - 1];
    const currentValue = values[i];
    
    // Avoid division by zero
    if (previousValue !== 0) {
      const roc = (currentValue - previousValue) / Math.abs(previousValue);
      result.push(roc);
    } else {
      result.push(currentValue > 0 ? 1 : currentValue < 0 ? -1 : 0);
    }
  }
  
  return result;
}

/**
 * Detects significant change points in a time series.
 * @private
 * @param {Array<number>} values - Array of values
 * @param {Array<number>} rateOfChange - Rate of change values
 * @param {number} threshold - Standard deviation threshold for change detection
 * @returns {Array<number>} - Indices of change points
 */
function detectChangePoints(values, rateOfChange, threshold) {
  const changePoints = [];
  
  // Calculate mean and standard deviation of rate of change
  const validRoc = rateOfChange.filter(roc => roc !== null);
  const mean = validRoc.reduce((sum, val) => sum + val, 0) / validRoc.length;
  const variance = validRoc.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validRoc.length;
  const stdDev = Math.sqrt(variance);
  
  // Detect points with rate of change beyond threshold
  for (let i = 1; i < values.length; i++) {
    if (rateOfChange[i] !== null) {
      const deviation = Math.abs(rateOfChange[i] - mean);
      if (deviation > threshold * stdDev) {
        changePoints.push(i);
      }
    }
  }
  
  return changePoints;
}

/**
 * Calculates linear regression for a time series.
 * @private
 * @param {Array<number>} timestamps - Array of timestamps
 * @param {Array<number>} values - Array of values
 * @returns {Object} - Regression parameters
 */
function calculateLinearRegression(timestamps, values) {
  const n = values.length;
  
  // Normalize timestamps to avoid numerical issues
  const baseTime = timestamps[0];
  const normalizedTime = timestamps.map(t => (t - baseTime) / (1000 * 60 * 60)); // Convert to hours
  
  // Calculate means
  const meanX = normalizedTime.reduce((sum, val) => sum + val, 0) / n;
  const meanY = values.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (normalizedTime[i] - meanX) * (values[i] - meanY);
    denominator += Math.pow(normalizedTime[i] - meanX, 2);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  
  // Calculate R-squared
  const predictions = normalizedTime.map(x => slope * x + intercept);
  const totalSumOfSquares = values.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
  const residualSumOfSquares = values.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);
  const r2 = totalSumOfSquares !== 0 ? 1 - (residualSumOfSquares / totalSumOfSquares) : 0;
  
  return {
    slope,
    intercept,
    r2
  };
}

/**
 * Generates forecast points based on linear regression.
 * @private
 * @param {Array<number>} timestamps - Array of timestamps
 * @param {Array<number>} values - Array of values
 * @param {Object} regression - Regression parameters
 * @param {number} numPoints - Number of forecast points
 * @returns {Array<Object>} - Forecast data points
 */
function generateForecast(timestamps, values, regression, numPoints) {
  const forecast = [];
  
  // Calculate time interval between points (average)
  const timeIntervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    timeIntervals.push(timestamps[i] - timestamps[i - 1]);
  }
  const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
  
  // Normalize timestamps to avoid numerical issues
  const baseTime = timestamps[0];
  const normalizedTime = timestamps.map(t => (t - baseTime) / (1000 * 60 * 60)); // Convert to hours
  
  // Generate forecast points
  const lastTimestamp = timestamps[timestamps.length - 1];
  const lastNormalizedTime = normalizedTime[normalizedTime.length - 1];
  
  for (let i = 1; i <= numPoints; i++) {
    const forecastTimestamp = lastTimestamp + (i * avgInterval);
    const forecastNormalizedTime = lastNormalizedTime + (i * avgInterval / (1000 * 60 * 60));
    const forecastValue = regression.slope * forecastNormalizedTime + regression.intercept;
    
    forecast.push({
      timestamp: forecastTimestamp,
      value: forecastValue,
      isForecast: true
    });
  }
  
  return forecast;
}

/**
 * Detects anomalies in metrics data using statistical methods.
 * @param {Array} metricsData - Array of metric data points
 * @param {Object} options - Detection options
 * @returns {Object} - Anomaly detection results
 */
function detectAnomalies(metricsData, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length < 10) {
    throw new Error('Metrics data must be an array with at least 10 data points');
  }
  
  const defaultOptions = {
    method: 'zscore', // 'zscore', 'iqr', or 'mad'
    threshold: 3.0, // Z-score threshold
    iqrMultiplier: 1.5, // IQR multiplier for outlier detection
    madMultiplier: 3.0, // MAD multiplier for outlier detection
    smoothing: true
  };
  
  const detectionOptions = { ...defaultOptions, ...options };
  
  // Extract values
  const values = metricsData.map(d => d.value);
  
  // Apply smoothing if enabled
  let processedValues = values;
  if (detectionOptions.smoothing) {
    processedValues = applyExponentialSmoothing(values, 0.3);
  }
  
  // Detect anomalies based on selected method
  let anomalies = [];
  
  switch (detectionOptions.method) {
    case 'zscore':
      anomalies = detectAnomaliesByZScore(metricsData, processedValues, detectionOptions.threshold);
      break;
    case 'iqr':
      anomalies = detectAnomaliesByIQR(metricsData, processedValues, detectionOptions.iqrMultiplier);
      break;
    case 'mad':
      anomalies = detectAnomaliesByMAD(metricsData, processedValues, detectionOptions.madMultiplier);
      break;
    default:
      throw new Error(`Unknown anomaly detection method: ${detectionOptions.method}`);
  }
  
  return {
    anomalies,
    anomalyCount: anomalies.length,
    anomalyPercentage: (anomalies.length / metricsData.length) * 100,
    method: detectionOptions.method
  };
}

/**
 * Detects anomalies using Z-score method.
 * @private
 * @param {Array} metricsData - Original metrics data
 * @param {Array<number>} values - Processed values
 * @param {number} threshold - Z-score threshold
 * @returns {Array} - Detected anomalies
 */
function detectAnomaliesByZScore(metricsData, values, threshold) {
  // Calculate mean and standard deviation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Detect anomalies
  const anomalies = [];
  
  for (let i = 0; i < values.length; i++) {
    const zScore = stdDev !== 0 ? Math.abs((values[i] - mean) / stdDev) : 0;
    
    if (zScore > threshold) {
      anomalies.push({
        ...metricsData[i],
        score: zScore,
        deviation: values[i] - mean
      });
    }
  }
  
  return anomalies;
}

/**
 * Detects anomalies using Interquartile Range (IQR) method.
 * @private
 * @param {Array} metricsData - Original metrics data
 * @param {Array<number>} values - Processed values
 * @param {number} multiplier - IQR multiplier
 * @returns {Array} - Detected anomalies
 */
function detectAnomaliesByIQR(metricsData, values, multiplier) {
  // Sort values for quartile calculation
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // Calculate quartiles
  const q1Index = Math.floor(sortedValues.length * 0.25);
  const q3Index = Math.floor(sortedValues.length * 0.75);
  
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  const iqr = q3 - q1;
  
  // Calculate bounds
  const lowerBound = q1 - (multiplier * iqr);
  const upperBound = q3 + (multiplier * iqr);
  
  // Detect anomalies
  const anomalies = [];
  
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lowerBound || values[i] > upperBound) {
      anomalies.push({
        ...metricsData[i],
        score: values[i] < lowerBound ? 
          (lowerBound - values[i]) / iqr : 
          (values[i] - upperBound) / iqr,
        deviation: values[i] < lowerBound ? 
          values[i] - lowerBound : 
          values[i] - upperBound
      });
    }
  }
  
  return anomalies;
}

/**
 * Detects anomalies using Median Absolute Deviation (MAD) method.
 * @private
 * @param {Array} metricsData - Original metrics data
 * @param {Array<number>} values - Processed values
 * @param {number} multiplier - MAD multiplier
 * @returns {Array} - Detected anomalies
 */
function detectAnomaliesByMAD(metricsData, values, multiplier) {
  // Calculate median
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  
  // Calculate absolute deviations
  const absoluteDeviations = values.map(val => Math.abs(val - median));
  
  // Calculate MAD (median of absolute deviations)
  const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b);
  const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)];
  
  // Detect anomalies
  const anomalies = [];
  
  for (let i = 0; i < values.length; i++) {
    const score = mad !== 0 ? Math.abs(values[i] - median) / mad : 0;
    
    if (score > multiplier) {
      anomalies.push({
        ...metricsData[i],
        score,
        deviation: values[i] - median
      });
    }
  }
  
  return anomalies;
}

/**
 * Performs correlation analysis between multiple metrics.
 * @param {Object} metricsMap - Map of metric name to array of metric data points
 * @param {Object} options - Analysis options
 * @returns {Object} - Correlation analysis results
 */
function analyzeCorrelations(metricsMap, options = {}) {
  if (!metricsMap || typeof metricsMap !== 'object') {
    throw new Error('Metrics map must be an object mapping metric names to data arrays');
  }
  
  const metricNames = Object.keys(metricsMap);
  if (metricNames.length < 2) {
    throw new Error('At least 2 metrics are required for correlation analysis');
  }
  
  const defaultOptions = {
    method: 'pearson', // 'pearson' or 'spearman'
    timeAlignment: true, // Align metrics by timestamp
    significanceThreshold: 0.5 // Correlation coefficient threshold for significance
  };
  
  const analysisOptions = { ...defaultOptions, ...options };
  
  // Align metrics by timestamp if enabled
  let alignedMetrics = metricsMap;
  if (analysisOptions.timeAlignment) {
    alignedMetrics = alignMetricsByTime(metricsMap);
  }
  
  // Calculate correlation matrix
  const correlationMatrix = {};
  
  for (let i = 0; i < metricNames.length; i++) {
    const metricA = metricNames[i];
    correlationMatrix[metricA] = {};
    
    for (let j = 0; j < metricNames.length; j++) {
      const metricB = metricNames[j];
      
      if (i === j) {
        // Self-correlation is always 1
        correlationMatrix[metricA][metricB] = 1.0;
      } else if (j > i) {
        // Calculate correlation
        const correlation = calculateCorrelation(
          alignedMetrics[metricA].map(d => d.value),
          alignedMetrics[metricB].map(d => d.value),
          analysisOptions.method
        );
        
        correlationMatrix[metricA][metricB] = correlation;
        correlationMatrix[metricB] = correlationMatrix[metricB] || {};
        correlationMatrix[metricB][metricA] = correlation; // Matrix is symmetric
      }
    }
  }
  
  // Find significant correlations
  const significantCorrelations = [];
  
  for (let i = 0; i < metricNames.length; i++) {
    const metricA = metricNames[i];
    
    for (let j = i + 1; j < metricNames.length; j++) {
      const metricB = metricNames[j];
      const correlation = correlationMatrix[metricA][metricB];
      
      if (Math.abs(correlation) >= analysisOptions.significanceThreshold) {
        significantCorrelations.push({
          metrics: [metricA, metricB],
          correlation,
          strength: getCorrelationStrength(correlation),
          direction: correlation > 0 ? 'positive' : 'negative'
        });
      }
    }
  }
  
  // Sort by absolute correlation value (descending)
  significantCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  return {
    correlationMatrix,
    significantCorrelations,
    method: analysisOptions.method
  };
}

/**
 * Aligns metrics by timestamp for correlation analysis.
 * @private
 * @param {Object} metricsMap - Map of metric name to array of metric data points
 * @returns {Object} - Aligned metrics map
 */
function alignMetricsByTime(metricsMap) {
  const metricNames = Object.keys(metricsMap);
  const alignedMetrics = {};
  
  // Find common time range
  let minTime = Infinity;
  let maxTime = -Infinity;
  
  for (const metricName of metricNames) {
    const metricData = metricsMap[metricName];
    
    if (metricData.length > 0) {
      const metricMinTime = Math.min(...metricData.map(d => d.timestamp));
      const metricMaxTime = Math.max(...metricData.map(d => d.timestamp));
      
      minTime = Math.min(minTime, metricMinTime);
      maxTime = Math.max(maxTime, metricMaxTime);
    }
  }
  
  // Create time buckets (1-minute intervals)
  const bucketSize = 60000; // 1 minute in milliseconds
  const buckets = {};
  
  for (let time = minTime; time <= maxTime; time += bucketSize) {
    buckets[time] = {};
  }
  
  // Assign metrics to buckets
  for (const metricName of metricNames) {
    const metricData = metricsMap[metricName];
    
    for (const dataPoint of metricData) {
      const bucketTime = Math.floor(dataPoint.timestamp / bucketSize) * bucketSize;
      
      if (buckets[bucketTime]) {
        buckets[bucketTime][metricName] = dataPoint.value;
      }
    }
  }
  
  // Create aligned metric arrays
  for (const metricName of metricNames) {
    alignedMetrics[metricName] = [];
    
    for (const bucketTime in buckets) {
      if (buckets[bucketTime][metricName] !== undefined) {
        alignedMetrics[metricName].push({
          timestamp: parseInt(bucketTime),
          value: buckets[bucketTime][metricName]
        });
      }
    }
  }
  
  return alignedMetrics;
}

/**
 * Calculates correlation between two arrays of values.
 * @private
 * @param {Array<number>} valuesA - First array of values
 * @param {Array<number>} valuesB - Second array of values
 * @param {string} method - Correlation method ('pearson' or 'spearman')
 * @returns {number} - Correlation coefficient
 */
function calculateCorrelation(valuesA, valuesB, method) {
  if (valuesA.length !== valuesB.length) {
    throw new Error('Value arrays must have the same length');
  }
  
  if (valuesA.length === 0) {
    return 0;
  }
  
  if (method === 'spearman') {
    // Convert to ranks for Spearman correlation
    valuesA = convertToRanks(valuesA);
    valuesB = convertToRanks(valuesB);
  }
  
  // Calculate means
  const meanA = valuesA.reduce((sum, val) => sum + val, 0) / valuesA.length;
  const meanB = valuesB.reduce((sum, val) => sum + val, 0) / valuesB.length;
  
  // Calculate correlation
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  
  for (let i = 0; i < valuesA.length; i++) {
    const diffA = valuesA[i] - meanA;
    const diffB = valuesB[i] - meanB;
    
    numerator += diffA * diffB;
    denominatorA += diffA * diffA;
    denominatorB += diffB * diffB;
  }
  
  const denominator = Math.sqrt(denominatorA * denominatorB);
  
  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Converts an array of values to ranks for Spearman correlation.
 * @private
 * @param {Array<number>} values - Array of values
 * @returns {Array<number>} - Array of ranks
 */
function convertToRanks(values) {
  // Create array of {value, index} pairs
  const pairs = values.map((value, index) => ({ value, index }));
  
  // Sort by value
  pairs.sort((a, b) => a.value - b.value);
  
  // Assign ranks
  const ranks = new Array(values.length);
  
  for (let i = 0; i < pairs.length; i++) {
    ranks[pairs[i].index] = i + 1;
  }
  
  return ranks;
}

/**
 * Gets descriptive strength of correlation coefficient.
 * @private
 * @param {number} correlation - Correlation coefficient
 * @returns {string} - Correlation strength description
 */
function getCorrelationStrength(correlation) {
  const absCorrelation = Math.abs(correlation);
  
  if (absCorrelation >= 0.9) {
    return 'very strong';
  } else if (absCorrelation >= 0.7) {
    return 'strong';
  } else if (absCorrelation >= 0.5) {
    return 'moderate';
  } else if (absCorrelation >= 0.3) {
    return 'weak';
  } else {
    return 'very weak';
  }
}

/**
 * Aggregates metrics data by dimension.
 * @param {Array} metricsData - Array of metric data points
 * @param {string} dimensionName - Dimension to aggregate by
 * @param {Object} options - Aggregation options
 * @returns {Object} - Aggregated metrics
 */
function aggregateByDimension(metricsData, dimensionName, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length === 0) {
    throw new Error('Metrics data must be a non-empty array');
  }
  
  if (!dimensionName) {
    throw new Error('Dimension name is required');
  }
  
  const defaultOptions = {
    metrics: ['count', 'min', 'max', 'avg', 'sum', 'stdDev']
  };
  
  const aggregationOptions = { ...defaultOptions, ...options };
  
  // Group by dimension value
  const groups = {};
  
  for (const dataPoint of metricsData) {
    const dimensionValue = dataPoint.dimensions && dataPoint.dimensions[dimensionName];
    
    if (dimensionValue !== undefined) {
      if (!groups[dimensionValue]) {
        groups[dimensionValue] = [];
      }
      
      groups[dimensionValue].push(dataPoint);
    }
  }
  
  // Calculate aggregations for each group
  const aggregations = {};
  
  for (const dimensionValue in groups) {
    const groupData = groups[dimensionValue];
    const values = groupData.map(d => d.value);
    
    const aggregation = {};
    
    if (aggregationOptions.metrics.includes('count')) {
      aggregation.count = values.length;
    }
    
    if (aggregationOptions.metrics.includes('min')) {
      aggregation.min = Math.min(...values);
    }
    
    if (aggregationOptions.metrics.includes('max')) {
      aggregation.max = Math.max(...values);
    }
    
    if (aggregationOptions.metrics.includes('sum')) {
      aggregation.sum = values.reduce((sum, val) => sum + val, 0);
    }
    
    if (aggregationOptions.metrics.includes('avg')) {
      aggregation.avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    if (aggregationOptions.metrics.includes('stdDev')) {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      aggregation.stdDev = Math.sqrt(variance);
    }
    
    aggregations[dimensionValue] = aggregation;
  }
  
  return {
    dimension: dimensionName,
    aggregations
  };
}

module.exports = {
  analyzeTrends,
  detectAnomalies,
  analyzeCorrelations,
  aggregateByDimension
};
