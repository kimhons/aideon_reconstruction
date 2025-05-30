/**
 * @fileoverview Mock ConfigService for testing.
 */
class MockConfigService {
  constructor() {
    this.config = {
      'context.fusion.strategies': {
        'text': { weight: 1.0 },
        'visual': { weight: 0.8 },
        'audio': { weight: 0.7 }
      },
      'context.prioritization.factors': {
        'recency': 0.5,
        'frequency': 0.3,
        'relevance': 0.2
      },
      'context.compression.levels': {
        'none': 0,
        'low': 1,
        'medium': 6,
        'high': 9
      },
      'context.security.accessLevels': {
        'public': 0,
        'internal': 1,
        'restricted': 2,
        'confidential': 3
      },
      'context.analytics.analysisInterval': 60000
    };
  }
  
  get(key) {
    const parts = key.split('.');
    let value = this.config;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }
    
    return value;
  }
  
  set(key, value) {
    const parts = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}

module.exports = MockConfigService;
