/**
 * @fileoverview Visualization utilities for the Standardized Metrics Collection system.
 * This module provides tools for generating visual representations of metrics data
 * for dashboards, reports, and real-time monitoring.
 * 
 * @module core/metrics/MetricsVisualization
 */

/**
 * Generates a time series chart configuration for metrics data.
 * @param {Array} metricsData - Array of metric data points
 * @param {Object} options - Chart configuration options
 * @returns {Object} - Chart configuration object
 */
function generateTimeSeriesChart(metricsData, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length === 0) {
    throw new Error('Metrics data must be a non-empty array');
  }
  
  const defaultOptions = {
    title: 'Metrics Time Series',
    xAxisLabel: 'Time',
    yAxisLabel: 'Value',
    timeFormat: 'HH:mm:ss',
    lineColor: '#4285F4',
    backgroundColor: '#FFFFFF',
    gridLines: true,
    animation: true,
    responsive: true
  };
  
  const chartOptions = { ...defaultOptions, ...options };
  
  // Extract timestamps and values
  const timestamps = metricsData.map(d => new Date(d.timestamp));
  const values = metricsData.map(d => d.value);
  
  // Calculate min, max, avg for y-axis scaling
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Generate chart configuration
  return {
    type: 'line',
    data: {
      labels: timestamps,
      datasets: [{
        label: chartOptions.title,
        data: values,
        borderColor: chartOptions.lineColor,
        backgroundColor: chartOptions.lineColor + '20', // Add transparency
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true
      }]
    },
    options: {
      responsive: chartOptions.responsive,
      animation: chartOptions.animation,
      title: {
        display: true,
        text: chartOptions.title
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute',
            displayFormats: {
              minute: chartOptions.timeFormat
            }
          },
          title: {
            display: true,
            text: chartOptions.xAxisLabel
          },
          grid: {
            display: chartOptions.gridLines
          }
        },
        y: {
          title: {
            display: true,
            text: chartOptions.yAxisLabel
          },
          suggestedMin: min > 0 ? 0 : min * 1.1,
          suggestedMax: max * 1.1,
          grid: {
            display: chartOptions.gridLines
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        },
        legend: {
          display: true,
          position: 'top'
        },
        annotation: {
          annotations: [{
            type: 'line',
            mode: 'horizontal',
            scaleID: 'y',
            value: avg,
            borderColor: '#FF9900',
            borderWidth: 1,
            label: {
              content: `Avg: ${avg.toFixed(2)}`,
              enabled: true,
              position: 'right'
            }
          }]
        }
      }
    }
  };
}

/**
 * Generates a histogram chart configuration for metrics data distribution.
 * @param {Array} metricsData - Array of metric data points
 * @param {Object} options - Chart configuration options
 * @returns {Object} - Chart configuration object
 */
function generateHistogramChart(metricsData, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length === 0) {
    throw new Error('Metrics data must be a non-empty array');
  }
  
  const defaultOptions = {
    title: 'Metrics Distribution',
    xAxisLabel: 'Value',
    yAxisLabel: 'Frequency',
    barColor: '#34A853',
    backgroundColor: '#FFFFFF',
    buckets: 10,
    gridLines: true,
    animation: true,
    responsive: true
  };
  
  const chartOptions = { ...defaultOptions, ...options };
  
  // Extract values
  const values = metricsData.map(d => d.value);
  
  // Calculate histogram buckets
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketSize = (max - min) / chartOptions.buckets;
  
  const buckets = Array(chartOptions.buckets).fill(0);
  const bucketLabels = [];
  
  // Create bucket labels
  for (let i = 0; i < chartOptions.buckets; i++) {
    const bucketStart = min + (i * bucketSize);
    const bucketEnd = bucketStart + bucketSize;
    bucketLabels.push(`${bucketStart.toFixed(2)} - ${bucketEnd.toFixed(2)}`);
  }
  
  // Fill buckets
  values.forEach(value => {
    if (value === max) {
      // Edge case: max value goes in the last bucket
      buckets[chartOptions.buckets - 1]++;
    } else {
      const bucketIndex = Math.floor((value - min) / bucketSize);
      buckets[bucketIndex]++;
    }
  });
  
  // Generate chart configuration
  return {
    type: 'bar',
    data: {
      labels: bucketLabels,
      datasets: [{
        label: chartOptions.title,
        data: buckets,
        backgroundColor: chartOptions.barColor,
        borderColor: chartOptions.barColor,
        borderWidth: 1
      }]
    },
    options: {
      responsive: chartOptions.responsive,
      animation: chartOptions.animation,
      title: {
        display: true,
        text: chartOptions.title
      },
      scales: {
        x: {
          title: {
            display: true,
            text: chartOptions.xAxisLabel
          },
          grid: {
            display: chartOptions.gridLines
          }
        },
        y: {
          title: {
            display: true,
            text: chartOptions.yAxisLabel
          },
          beginAtZero: true,
          grid: {
            display: chartOptions.gridLines
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        },
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  };
}

/**
 * Generates a gauge chart configuration for current metric value.
 * @param {number} value - Current metric value
 * @param {Object} options - Chart configuration options
 * @returns {Object} - Chart configuration object
 */
function generateGaugeChart(value, options = {}) {
  if (typeof value !== 'number') {
    throw new Error('Value must be a number');
  }
  
  const defaultOptions = {
    title: 'Metric Gauge',
    min: 0,
    max: 100,
    thresholds: [
      { value: 33, color: '#34A853' }, // Green
      { value: 66, color: '#FBBC05' }, // Yellow
      { value: 100, color: '#EA4335' } // Red
    ],
    backgroundColor: '#FFFFFF',
    animation: true,
    responsive: true
  };
  
  const chartOptions = { ...defaultOptions, ...options };
  
  // Determine color based on thresholds
  let gaugeColor = chartOptions.thresholds[0].color;
  for (const threshold of chartOptions.thresholds) {
    if (value <= threshold.value) {
      gaugeColor = threshold.color;
      break;
    }
  }
  
  // Calculate percentage for gauge
  const percentage = Math.min(100, Math.max(0, 
    ((value - chartOptions.min) / (chartOptions.max - chartOptions.min)) * 100
  ));
  
  // Generate chart configuration
  return {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [percentage, 100 - percentage],
        backgroundColor: [gaugeColor, '#E0E0E0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: chartOptions.responsive,
      animation: chartOptions.animation,
      circumference: 180,
      rotation: 270,
      cutout: '75%',
      plugins: {
        tooltip: {
          enabled: false
        },
        legend: {
          display: false
        },
        title: {
          display: true,
          text: chartOptions.title,
          position: 'bottom'
        },
        datalabels: {
          formatter: () => value.toFixed(1),
          color: '#000000',
          font: {
            size: 20,
            weight: 'bold'
          },
          anchor: 'center',
          align: 'center'
        }
      }
    }
  };
}

/**
 * Generates a heatmap chart configuration for metrics data across dimensions.
 * @param {Array} metricsData - Array of metric data points with dimensions
 * @param {string} xDimension - Dimension name for x-axis
 * @param {string} yDimension - Dimension name for y-axis
 * @param {Object} options - Chart configuration options
 * @returns {Object} - Chart configuration object
 */
function generateHeatmapChart(metricsData, xDimension, yDimension, options = {}) {
  if (!Array.isArray(metricsData) || metricsData.length === 0) {
    throw new Error('Metrics data must be a non-empty array');
  }
  
  if (!xDimension || !yDimension) {
    throw new Error('X and Y dimensions are required');
  }
  
  const defaultOptions = {
    title: 'Metrics Heatmap',
    colorScale: ['#E0F2F1', '#26A69A', '#00796B', '#004D40'],
    backgroundColor: '#FFFFFF',
    gridLines: true,
    animation: true,
    responsive: true
  };
  
  const chartOptions = { ...defaultOptions, ...options };
  
  // Extract unique dimension values
  const xValues = [...new Set(metricsData.map(d => d.dimensions[xDimension]))];
  const yValues = [...new Set(metricsData.map(d => d.dimensions[yDimension]))];
  
  // Create data matrix
  const dataMatrix = Array(yValues.length).fill().map(() => Array(xValues.length).fill(null));
  
  // Fill data matrix with average values
  const valueCounts = {};
  
  metricsData.forEach(d => {
    const xIndex = xValues.indexOf(d.dimensions[xDimension]);
    const yIndex = yValues.indexOf(d.dimensions[yDimension]);
    
    if (xIndex >= 0 && yIndex >= 0) {
      const key = `${xIndex}-${yIndex}`;
      
      if (!valueCounts[key]) {
        valueCounts[key] = { sum: 0, count: 0 };
      }
      
      valueCounts[key].sum += d.value;
      valueCounts[key].count++;
    }
  });
  
  // Calculate averages
  Object.keys(valueCounts).forEach(key => {
    const [xIndex, yIndex] = key.split('-').map(Number);
    dataMatrix[yIndex][xIndex] = valueCounts[key].sum / valueCounts[key].count;
  });
  
  // Generate chart configuration
  return {
    type: 'heatmap',
    data: {
      labels: yValues,
      datasets: xValues.map((xValue, xIndex) => ({
        label: xValue,
        data: dataMatrix.map(row => row[xIndex])
      }))
    },
    options: {
      responsive: chartOptions.responsive,
      animation: chartOptions.animation,
      title: {
        display: true,
        text: chartOptions.title
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xDimension
          },
          grid: {
            display: chartOptions.gridLines
          }
        },
        y: {
          title: {
            display: true,
            text: yDimension
          },
          grid: {
            display: chartOptions.gridLines
          }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => {
              const item = items[0];
              return `${yValues[item.dataIndex]} / ${xValues[item.datasetIndex]}`;
            },
            label: (item) => {
              return `Value: ${item.raw !== null ? item.raw.toFixed(2) : 'N/A'}`;
            }
          }
        },
        legend: {
          display: false
        },
        colorschemes: {
          scheme: chartOptions.colorScale
        }
      }
    }
  };
}

/**
 * Generates a dashboard configuration with multiple charts.
 * @param {Object} metricsCollector - MetricsCollector instance
 * @param {Object} options - Dashboard configuration options
 * @returns {Object} - Dashboard configuration object
 */
async function generateMetricsDashboard(metricsCollector, options = {}) {
  if (!metricsCollector) {
    throw new Error('MetricsCollector instance is required');
  }
  
  const defaultOptions = {
    title: 'Metrics Dashboard',
    refreshInterval: 60000, // 1 minute
    timeRange: 3600000, // 1 hour
    layout: '2x2', // 2 rows, 2 columns
    metrics: [] // List of metrics to display
  };
  
  const dashboardOptions = { ...defaultOptions, ...options };
  
  // If no metrics specified, use all available metrics
  if (dashboardOptions.metrics.length === 0) {
    dashboardOptions.metrics = Object.keys(metricsCollector.metricDefinitions);
  }
  
  // Limit to first 4 metrics for default layout
  const displayMetrics = dashboardOptions.metrics.slice(0, 4);
  
  // Query data for each metric
  const now = Date.now();
  const startTime = now - dashboardOptions.timeRange;
  
  const dashboardData = {
    title: dashboardOptions.title,
    refreshInterval: dashboardOptions.refreshInterval,
    timestamp: now,
    charts: []
  };
  
  // Generate charts for each metric
  for (const metricName of displayMetrics) {
    try {
      const metricData = await metricsCollector.queryMetrics({
        metricName,
        startTime,
        endTime: now
      });
      
      const metricDef = metricsCollector.metricDefinitions[metricName];
      
      if (metricData.length > 0) {
        // Create appropriate chart based on metric type
        switch (metricDef.type) {
          case 'counter':
          case 'gauge':
            dashboardData.charts.push(
              generateTimeSeriesChart(metricData, {
                title: metricDef.description || metricName,
                yAxisLabel: metricDef.options.unit || 'Value'
              })
            );
            break;
            
          case 'histogram':
            dashboardData.charts.push(
              generateHistogramChart(metricData, {
                title: metricDef.description || metricName,
                xAxisLabel: metricDef.options.unit || 'Value'
              })
            );
            break;
            
          case 'summary':
            // For summary, show both time series and current gauge
            dashboardData.charts.push(
              generateTimeSeriesChart(metricData, {
                title: metricDef.description || metricName,
                yAxisLabel: metricDef.options.unit || 'Value'
              })
            );
            
            // Add gauge for latest value
            if (metricData.length > 0) {
              const latestValue = metricData[metricData.length - 1].value;
              dashboardData.charts.push(
                generateGaugeChart(latestValue, {
                  title: `Current: ${metricDef.description || metricName}`,
                  min: metricDef.options.min !== undefined ? metricDef.options.min : 0,
                  max: metricDef.options.max !== undefined ? metricDef.options.max : 100
                })
              );
            }
            break;
        }
      }
    } catch (error) {
      console.error(`Error generating chart for metric ${metricName}:`, error);
    }
  }
  
  return dashboardData;
}

module.exports = {
  generateTimeSeriesChart,
  generateHistogramChart,
  generateGaugeChart,
  generateHeatmapChart,
  generateMetricsDashboard
};
