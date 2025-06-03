# Standardized Metrics Collection System

## Overview

The Standardized Metrics Collection system provides a comprehensive framework for collecting, processing, analyzing, and visualizing metrics across all components of the Aideon system. This system enables performance monitoring, resource optimization, anomaly detection, and data-driven decision making.

## Key Components

### MetricsCollector

The `MetricsCollector` class serves as the central component of the metrics collection system, providing a standardized interface for:

- Defining metrics and dimensions
- Recording metric values with optional dimensions
- Flushing metrics to persistent storage
- Querying historical metrics data
- Calculating statistics on metric values
- Subscribing to real-time metric events
- Collecting system-level metrics automatically

## Features

### Metric Types

The system supports multiple metric types:

- **Counter**: Monotonically increasing values (e.g., request count, error count)
- **Gauge**: Values that can increase or decrease (e.g., memory usage, CPU usage)
- **Histogram**: Distribution of values (e.g., request duration, response size)
- **Summary**: Statistical summary of values (e.g., percentiles of request duration)

### Dimensions

Metrics can be segmented by dimensions, which provide additional context:

- **User-defined dimensions**: Custom dimensions for specific use cases
- **System dimensions**: Automatically added dimensions like hostname, process ID
- **Dimension validation**: Optional validation of dimension values against allowed values

### Storage and Retention

Metrics are stored with configurable retention policies:

- **In-memory buffer**: For real-time access and processing
- **Persistent storage**: JSON files with timestamp-based organization
- **Retention period**: Configurable retention period for historical data
- **Automatic cleanup**: Removal of metrics data beyond the retention period

### Real-Time Analysis

The system provides real-time metrics processing capabilities:

- **Event-based subscription**: Subscribe to metric events as they occur
- **Real-time alerting**: Set up alerts based on metric thresholds
- **Stream processing**: Process metrics in real-time for immediate insights

### System Metrics

The system automatically collects key system-level metrics:

- **CPU usage**: Overall and per-core CPU utilization
- **Memory usage**: Total, used, and available memory
- **Disk usage**: Storage utilization and I/O statistics
- **Network usage**: Bytes sent/received and connection statistics

## Usage Examples

### Basic Usage

```javascript
const MetricsCollector = require('./MetricsCollector');

// Create a metrics collector instance
const metrics = new MetricsCollector({
  storageDir: '/path/to/metrics/storage',
  flushInterval: 60000, // 1 minute
  retentionPeriod: 30 // 30 days
});

// Define metrics
metrics.defineMetric('api.request.count', 'counter', 'API request count');
metrics.defineMetric('api.request.duration', 'histogram', 'API request duration in ms');

// Define dimensions
metrics.defineDimension('endpoint', 'API endpoint');
metrics.defineDimension('status', 'HTTP status code');

// Record metrics
metrics.recordMetric('api.request.count', 1, {
  endpoint: '/users',
  status: '200'
});

metrics.recordMetric('api.request.duration', 42, {
  endpoint: '/users',
  status: '200'
});

// Query metrics
const results = await metrics.queryMetrics({
  metricName: 'api.request.duration',
  startTime: Date.now() - 3600000, // Last hour
  dimensions: { endpoint: '/users' }
});

// Calculate statistics
const stats = metrics.calculateStatistics(results);
console.log(`Average request duration: ${stats.avg}ms`);
console.log(`95th percentile: ${stats.p95}ms`);

// Clean up
await metrics.stop();
```

### Real-Time Monitoring

```javascript
// Subscribe to real-time metric events
const unsubscribe = metrics.subscribeToMetrics((metric) => {
  if (metric.name === 'api.request.duration' && metric.value > 1000) {
    console.log(`Slow request detected: ${metric.value}ms for ${metric.dimensions.endpoint}`);
  }
});

// Later, unsubscribe when no longer needed
unsubscribe();
```

## Integration with Other Components

The Standardized Metrics Collection system integrates with other Aideon components:

- **Performance Optimization**: Provides data for performance analysis and optimization
- **Advanced Caching Strategies**: Monitors cache performance and usage patterns
- **Error Recovery**: Tracks error rates and recovery effectiveness
- **Configuration System**: Adapts metrics collection based on configuration
- **Tentacles**: Each tentacle can define and record domain-specific metrics

## Future Enhancements

Planned enhancements for the metrics collection system include:

- **Distributed metrics aggregation**: Aggregating metrics across multiple instances
- **Advanced visualization**: Enhanced dashboards and visualization tools
- **Machine learning integration**: Anomaly detection and predictive analytics
- **Custom metric types**: Support for user-defined metric types
- **Metric metadata**: Additional metadata for richer context and analysis
