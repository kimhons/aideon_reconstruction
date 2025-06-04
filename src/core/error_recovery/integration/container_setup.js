/**
 * container_setup.js
 * 
 * Sets up the dependency container for the Autonomous Error Recovery System.
 * This module initializes and registers all components with the dependency container.
 * 
 * @module core/error_recovery/integration/container_setup
 */

const path = require('path');
const DependencyContainer = require('../foundation/DependencyContainer');
const EventBus = require('../foundation/EventBus');
const ContextManager = require('../foundation/ContextManager');
// Fix: Import MetricsCollector correctly without destructuring
const MetricsCollector = require('./MetricsCollector');
const { AutonomousRecoveryOrchestrator, CircuitBreaker } = require('./AutonomousRecoveryOrchestrator');
const EnhancedNeuralCoordinationHub = require('../foundation/EnhancedNeuralCoordinationHub');
const EnhancedIntegrationValidationRunner = require('./EnhancedIntegrationValidationRunner');
const CausalAnalyzer = require('../CausalAnalyzer');
const RecoveryStrategyGenerator = require('../RecoveryStrategyGenerator');
const RecoveryLearningSystem = require('../RecoveryLearningSystem');

/**
 * Creates and configures a dependency container for the Autonomous Error Recovery System.
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Logger instance
 * @param {Object} options.config - Configuration settings
 * @returns {DependencyContainer} Configured dependency container
 */
function createContainer(options = {}) {
  const logger = options.logger || console;
  const config = options.config || {};
  
  // Create container
  const container = new DependencyContainer({ logger });
  
  // Register foundation components
  // Fix: Register eventBus as a factory function instead of an object instance
  container.register('eventBus', () => {
    return new EventBus();
  });
  
  container.register('contextManager', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new ContextManager({
      eventEmitter: eventBus,
      logger,
      config: config.contextManager
    });
  });
  
  // Fix: Register MetricsCollector correctly
  container.register('metricsCollector', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new MetricsCollector({
      eventEmitter: eventBus,
      logger,
      config: config.metricsCollector
    });
  });
  
  container.register('neuralCoordinationHub', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new EnhancedNeuralCoordinationHub({
      eventEmitter: eventBus,
      logger,
      config: config.neuralCoordinationHub
    });
  });
  
  // Register recovery action registry
  container.register('recoveryActionRegistry', async (container) => {
    // Simple in-memory implementation for testing
    const actions = new Map();
    
    // Add some default actions
    actions.set('CheckNetworkAction', {
      id: 'CheckNetworkAction',
      name: 'Check Network Connectivity',
      description: 'Checks if network connectivity is available',
      resourceHints: {
        cpu: 0.1,
        memory: 10,
        disk: 0,
        network: 0.5
      },
      estimatedDuration: 3000,
      potentialSideEffects: []
    });
    
    actions.set('RestartNetworkAction', {
      id: 'RestartNetworkAction',
      name: 'Restart Network Services',
      description: 'Restarts network services to recover connectivity',
      resourceHints: {
        cpu: 0.3,
        memory: 20,
        disk: 0,
        network: 0
      },
      estimatedDuration: 8000,
      potentialSideEffects: [
        { type: 'service_disruption', severity: 'medium', duration: 5000 }
      ]
    });
    
    actions.set('DiagnoseAction', {
      id: 'DiagnoseAction',
      name: 'Diagnose Issue',
      description: 'Performs diagnostics to identify the issue',
      resourceHints: {
        cpu: 0.5,
        memory: 50,
        disk: 0.1,
        network: 0.1
      },
      estimatedDuration: 10000,
      potentialSideEffects: []
    });
    
    actions.set('RestartComponentAction', {
      id: 'RestartComponentAction',
      name: 'Restart Component',
      description: 'Restarts a specific component',
      resourceHints: {
        cpu: 0.2,
        memory: 30,
        disk: 0,
        network: 0
      },
      estimatedDuration: 5000,
      potentialSideEffects: [
        { type: 'service_disruption', severity: 'low', duration: 3000 }
      ]
    });
    
    return {
      getAction: async (actionId) => {
        return actions.get(actionId);
      },
      
      registerAction: async (action) => {
        actions.set(action.id, action);
      }
    };
  });
  
  // Register historical data manager
  container.register('historicalDataManager', async (container) => {
    // Simple in-memory implementation for testing
    const strategyPerformance = new Map();
    
    return {
      getStrategyPerformance: async (strategyId) => {
        return strategyPerformance.get(strategyId) || {
          successRate: 0.5,
          executionCount: 0,
          averageDuration: 0
        };
      },
      
      recordStrategyExecution: async (strategyId, result) => {
        const current = strategyPerformance.get(strategyId) || {
          successRate: 0.5,
          executionCount: 0,
          averageDuration: 0
        };
        
        const newCount = current.executionCount + 1;
        const newSuccessRate = ((current.successRate * current.executionCount) + (result.success ? 1 : 0)) / newCount;
        const newAvgDuration = ((current.averageDuration * current.executionCount) + result.duration) / newCount;
        
        strategyPerformance.set(strategyId, {
          successRate: newSuccessRate,
          executionCount: newCount,
          averageDuration: newAvgDuration
        });
      },
      
      getRecommendations: async (analysisResult) => {
        // In a real implementation, this would return recommendations based on analysis
        // For testing, we'll return an empty array
        return [];
      }
    };
  });
  
  // Register strategy template registry (with factory function to avoid circular dependency)
  // IMPORTANT: This is registered before RecoveryStrategyGenerator to break circular dependency
  container.register('strategyTemplateRegistry', async (container) => {
    // Simple in-memory implementation for testing
    const templates = new Map();
    
    // Add some default templates
    templates.set('network-connectivity', {
      id: 'network-connectivity',
      name: 'Network Connectivity Recovery',
      description: 'Recovers from network connectivity issues',
      confidence: 0.8,
      template: {
        name: 'Network Connectivity Recovery',
        description: 'Recovers from network connectivity issues',
        actions: [
          {
            actionId: 'CheckNetworkAction',
            parameters: { timeout: 5000 }
          },
          {
            actionId: 'RestartNetworkAction',
            parameters: { mode: 'safe' }
          }
        ],
        metadata: {
          tags: ['network', 'connectivity'],
          experimental: false
        }
      }
    });
    
    templates.set('data-corruption', {
      id: 'data-corruption',
      name: 'Data Corruption Recovery',
      description: 'Recovers from data corruption issues',
      confidence: 0.7,
      template: {
        name: 'Data Corruption Recovery',
        description: 'Recovers from data corruption issues',
        actions: [
          {
            actionId: 'VerifyDataIntegrityAction',
            parameters: { level: 'deep' }
          },
          {
            actionId: 'RestoreFromBackupAction',
            parameters: { backupType: 'latest' }
          }
        ],
        metadata: {
          tags: ['data', 'corruption', 'integrity'],
          experimental: false
        }
      }
    });
    
    // Create registry interface without any dependencies on RecoveryStrategyGenerator
    const registry = {
      getApplicableTemplates: async (analysisResult) => {
        // In a real implementation, this would filter templates based on analysis
        // For testing, we'll return all templates
        return Array.from(templates.values());
      },
      
      getTemplate: async (templateId) => {
        return templates.get(templateId);
      },
      
      registerTemplate: async (template) => {
        templates.set(template.id, template);
      }
    };
    
    // Return the registry interface directly without resolving any other dependencies
    return registry;
  });
  
  // Register core components
  container.register('causalAnalyzer', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new CausalAnalyzer({
      container,
      eventEmitter: eventBus,
      logger,
      config: config.causalAnalyzer
    });
  });
  
  // Register RecoveryStrategyGenerator after strategyTemplateRegistry is registered
  // to avoid circular dependency during initialization
  container.register('recoveryStrategyGenerator', async (container) => {
    // First, ensure strategyTemplateRegistry is fully initialized
    await container.resolve('strategyTemplateRegistry');
    const eventBus = await container.resolve('eventBus');
    
    // Now create the RecoveryStrategyGenerator
    const recoveryStrategyGenerator = new RecoveryStrategyGenerator({
      container,
      eventEmitter: eventBus,
      logger,
      config: config.recoveryStrategyGenerator
    });
    
    // Initialize after registration to avoid circular dependency
    await recoveryStrategyGenerator.initialize();
    
    return recoveryStrategyGenerator;
  });
  
  // Fix: Register learningSystem with both 'learningSystem' and 'recoveryLearningSystem' keys
  const createLearningSystem = async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new RecoveryLearningSystem({
      container,
      eventEmitter: eventBus,
      logger,
      config: config.learningSystem
    });
  };
  
  container.register('learningSystem', createLearningSystem);
  
  // Fix: Add explicit registration for recoveryLearningSystem (required by orchestrator)
  container.register('recoveryLearningSystem', createLearningSystem);
  
  // Register integration components
  container.register('validationRunner', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new EnhancedIntegrationValidationRunner({
      container,
      eventEmitter: eventBus,
      logger,
      config: config.validationRunner
    });
  });
  
  container.register('circuitBreaker', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new CircuitBreaker({
      eventEmitter: eventBus,
      logger,
      config: config.circuitBreaker
    });
  });
  
  container.register('orchestrator', async (container) => {
    const eventBus = await container.resolve('eventBus');
    return new AutonomousRecoveryOrchestrator({
      container,
      eventEmitter: eventBus,
      logger,
      config: config.orchestrator
    });
  });
  
  // Register aliases for backward compatibility
  container.register('recoveryOrchestrator', async (container) => {
    return container.resolve('orchestrator');
  });
  
  container.register('integrationValidationRunner', async (container) => {
    return container.resolve('validationRunner');
  });
  
  container.register('resolutionExecutor', async (container) => {
    // Simple mock implementation for testing
    return {
      executeStrategy: async (strategy, analysisResult) => {
        return {
          successful: true,
          results: {
            actions: strategy.actions.map(a => ({
              actionId: a.actionId || a.type,
              successful: true,
              message: `Successfully executed ${a.actionId || a.type}`
            }))
          },
          duration: 100,
          timestamp: Date.now()
        };
      }
    };
  });
  
  logger.info('Dependency container configured for Autonomous Error Recovery System');
  
  return container;
}

module.exports = { createContainer };
