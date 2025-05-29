/**
 * @fileoverview Mock HierarchicalReasoningFramework for integration tests
 */

class HierarchicalReasoningFramework {
  constructor(options = {}) {
    this.logger = options.logger;
    this.securityManager = options.securityManager;
    this.performanceMonitor = options.performanceMonitor;
    this.configService = options.configService;
    this.abstractionLayerManager = options.abstractionLayerManager;
    this.strategies = new Map([
      ['deductive', { id: 'deductive', priority: 1 }],
      ['inductive', { id: 'inductive', priority: 2 }],
      ['abductive', { id: 'abductive', priority: 3 }],
      ['analogical', { id: 'analogical', priority: 4 }],
      ['causal', { id: 'causal', priority: 5 }],
      ['counterfactual', { id: 'counterfactual', priority: 6 }],
      ['probabilistic', { id: 'probabilistic', priority: 7 }]
    ]);
  }

  reason(input, options = {}) {
    // Mock implementation
    const strategy = options.strategy || 'deductive';
    const abstraction = options.abstraction || 'semantic';
    
    // Return reasoning result
    return {
      conclusion: `Reasoning result for: ${JSON.stringify(input)}`,
      confidence: 0.9,
      strategy,
      abstraction,
      explanation: 'Mock reasoning explanation',
      metadata: {
        processingTime: 15,
        reasoningSteps: 3
      }
    };
  }

  getStrategies() {
    return Array.from(this.strategies.values());
  }

  getStrategy(strategyId) {
    if (!this.strategies.has(strategyId)) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }
    return this.strategies.get(strategyId);
  }

  dispose() {
    return true;
  }
}

module.exports = HierarchicalReasoningFramework;
