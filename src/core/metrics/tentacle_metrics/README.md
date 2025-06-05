# Tentacle Metrics System

## Overview

The Tentacle Metrics System extends Aideon's core metrics infrastructure to provide standardized metrics collection, analysis, and anomaly detection specifically for tentacles. This system is a critical component for improving the GAIA Score by enabling comprehensive performance monitoring, optimization, and quality assurance across all tentacles.

## Key Features

- **Standardized Metrics Collection**: Consistent metrics definitions and collection across all tentacles
- **Automatic Tentacle Registration**: Seamless integration with the tentacle registry
- **Real-time Anomaly Detection**: Automatic detection of performance anomalies with configurable thresholds
- **Operation Tracking**: Comprehensive tracking of tentacle operations with timing and status
- **Resource Usage Monitoring**: CPU, memory, and other resource usage tracking
- **Communication Metrics**: Inter-tentacle communication monitoring
- **Quality Metrics**: Success rates, error rates, and other quality indicators
- **Learning Progress Tracking**: Monitoring of tentacle learning and improvement

## Usage

### Basic Setup

```javascript
const MetricsCollector = require('../MetricsCollector');
const TentacleMetricsManager = require('./TentacleMetricsManager');

// Create a metrics collector
const metricsCollector = new MetricsCollector({
  enableRealTimeAnalysis: true
});

// Create a tentacle metrics manager
const tentacleMetrics = new TentacleMetricsManager({
  metricsCollector,
  autoRegisterTentacles: true,
  anomalyDetectionThreshold: 3.0,
  enableRealTimeAlerts: true
});
```

### Registering Tentacles

```javascript
// Register a tentacle manually
tentacleMetrics.registerTentacle('financial-analysis-tentacle', 'financial');

// Tentacles are also auto-registered when metrics are recorded
```

### Recording Metrics

```javascript
// Record a simple metric
tentacleMetrics.recordTentacleMetric(
  'financial-analysis-tentacle',
  'operation.count',
  1,
  { operation_type: 'analysis' }
);

// Track operation duration
const opContext = tentacleMetrics.startOperation(
  'financial-analysis-tentacle',
  'analysis',
  { priority: 'high' }
);

// ... perform operation ...

tentacleMetrics.endOperation(opContext, 'success', { result: 'completed' });

// Record resource usage
tentacleMetrics.recordResourceUsage(
  'financial-analysis-tentacle',
  {
    cpuUsage: 15.5,
    memoryUsage: 1024 * 1024 * 50 // 50 MB
  }
);

// Record communication
tentacleMetrics.recordCommunication(
  'financial-analysis-tentacle',
  'data-integration-tentacle',
  'data-request',
  1024 * 10 // 10 KB
);

// Record learning progress
tentacleMetrics.recordLearningProgress(
  'financial-analysis-tentacle',
  5.2 // 5.2% improvement
);
```

### Monitoring Anomalies

```javascript
// Subscribe to anomaly alerts
const unsubscribe = tentacleMetrics.subscribeToAnomalyAlerts((anomaly) => {
  console.log(`Anomaly detected in ${anomaly.tentacleId}:`, anomaly);
  
  // Take corrective action
  // ...
});

// Later, unsubscribe when no longer needed
unsubscribe();
```

### Querying Metrics

```javascript
// Get metrics for a specific tentacle
const metrics = await tentacleMetrics.getTentacleMetrics(
  'financial-analysis-tentacle',
  {
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
    dimensions: {
      operation_type: 'analysis'
    }
  }
);

// Get a summary of all tentacles
const summary = tentacleMetrics.getTentacleRegistrySummary();
```

## Integration with Other Systems

The Tentacle Metrics System integrates with:

1. **Core Metrics System**: Extends the base metrics infrastructure
2. **Tentacle Registry**: For automatic tentacle registration and discovery
3. **Autonomous Error Recovery System**: For anomaly detection and recovery
4. **Performance Optimization**: For identifying optimization opportunities
5. **Metrics Dashboard**: For visualization and monitoring

## Implementation Notes

- The system uses statistical analysis to detect anomalies based on z-scores
- Metrics are stored efficiently with automatic retention management
- Real-time alerts are provided through an event emitter pattern
- The system is designed to scale to hundreds of tentacles with minimal overhead

## Future Enhancements

- Integration with machine learning for predictive anomaly detection
- Enhanced visualization capabilities for tentacle performance
- Cross-tentacle correlation analysis
- Automated performance optimization recommendations
