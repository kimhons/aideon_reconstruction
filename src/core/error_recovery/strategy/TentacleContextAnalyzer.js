/**
 * TentacleContextAnalyzer.js
 * 
 * Analyzes the context of tentacles affected by errors and provides insights
 * for recovery strategy generation. This component is responsible for understanding
 * the state, dependencies, and interactions of tentacles to inform intelligent
 * recovery decisions.
 * 
 * @module src/core/error_recovery/strategy/TentacleContextAnalyzer
 */

'use strict';

/**
 * Class responsible for analyzing tentacle context during error recovery
 */
class TentacleContextAnalyzer {
  /**
   * Creates a new TentacleContextAnalyzer instance
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.knowledgeFramework - Knowledge framework for accessing tentacle metadata
   * @param {Object} options.tentacleRegistry - Registry of all available tentacles
   * @param {Object} options.mlLayer - Machine learning layer for enhanced analysis
   * @param {Object} options.eventBus - Event bus for communication
   */
  constructor(options = {}) {
    this.knowledgeFramework = options.knowledgeFramework;
    this.tentacleRegistry = options.tentacleRegistry;
    this.mlLayer = options.mlLayer;
    this.eventBus = options.eventBus;
    
    this.contextCache = new Map();
    this.analyzerModels = {
      dependencyAnalyzer: null,
      statePredictor: null,
      impactAssessor: null
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the analyzer and load required models
   * Public method required by RecoveryStrategyGenerator
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    if (this.mlLayer) {
      try {
        this.analyzerModels.dependencyAnalyzer = await this.mlLayer.loadModel('tentacle_dependency_analyzer');
        this.analyzerModels.statePredictor = await this.mlLayer.loadModel('tentacle_state_predictor');
        this.analyzerModels.impactAssessor = await this.mlLayer.loadModel('tentacle_impact_assessor');
      } catch (error) {
        console.warn('Failed to load ML models for TentacleContextAnalyzer:', error.message);
        // Continue without ML enhancement
      }
    }
    
    if (this.eventBus) {
      this.eventBus.on('tentacle:state:changed', this._handleTentacleStateChange.bind(this));
      this.eventBus.on('tentacle:registered', this._handleTentacleRegistered.bind(this));
      this.eventBus.on('tentacle:unregistered', this._handleTentacleUnregistered.bind(this));
    }
    
    this.isInitialized = true;
    
    if (this.eventBus) {
      this.eventBus.emit('component:initialized', {
        component: 'TentacleContextAnalyzer',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Initialize the analyzer and load required models
   * @private
   */
  async _initialize() {
    // This private method is kept for backward compatibility
    // but now delegates to the public initialize() method
    await this.initialize();
  }
  
  /**
   * Analyze the context of tentacles affected by an error
   * 
   * @param {Object} error - The error object
   * @param {Object} options - Analysis options
   * @param {boolean} options.includeIndirectDependencies - Whether to include indirectly affected tentacles
   * @param {boolean} options.predictFutureState - Whether to predict future state after recovery
   * @param {number} options.maxDepth - Maximum depth for dependency analysis
   * @returns {Object} Analysis results
   */
  async analyzeContext(error, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const {
      includeIndirectDependencies = true,
      predictFutureState = true,
      maxDepth = 3
    } = options;
    
    // Extract affected tentacle information from error
    const affectedTentacles = this._extractAffectedTentacles(error);
    
    // Get current state of affected tentacles
    const tentacleStates = await this._getTentacleStates(affectedTentacles);
    
    // Analyze dependencies between tentacles
    const dependencyGraph = await this._analyzeDependencies(affectedTentacles, {
      includeIndirect: includeIndirectDependencies,
      maxDepth
    });
    
    // Assess impact on other tentacles and system components
    const impactAssessment = await this._assessImpact(affectedTentacles, dependencyGraph);
    
    // Predict state after potential recovery actions
    let futureStatePrediction = null;
    if (predictFutureState) {
      futureStatePrediction = await this._predictFutureState(affectedTentacles, tentacleStates, error);
    }
    
    // Generate context insights
    const insights = this._generateInsights(affectedTentacles, dependencyGraph, impactAssessment);
    
    return {
      affectedTentacles,
      tentacleStates,
      dependencyGraph,
      impactAssessment,
      futureStatePrediction,
      insights,
      timestamp: Date.now()
    };
  }
  
  /**
   * Extract affected tentacles from error information
   * 
   * @param {Object} error - The error object
   * @returns {Array} List of affected tentacles
   * @private
   */
  _extractAffectedTentacles(error) {
    const affectedTentacles = [];
    
    // Direct extraction from error context if available
    if (error.context && error.context.component) {
      const tentacleId = this._getTentacleIdFromComponent(error.context.component);
      if (tentacleId) {
        affectedTentacles.push({
          id: tentacleId,
          directlyAffected: true,
          errorSource: true,
          component: error.context.component
        });
      }
    }
    
    // Extract from error context's affectedComponents if available
    if (error.context && error.context.affectedComponents) {
      for (const component of error.context.affectedComponents) {
        const tentacleId = this._getTentacleIdFromComponent(component);
        if (tentacleId && !affectedTentacles.some(t => t.id === tentacleId)) {
          affectedTentacles.push({
            id: tentacleId,
            directlyAffected: true,
            errorSource: false,
            component
          });
        }
      }
    }
    
    // If no tentacles found, try to infer from error type and message
    if (affectedTentacles.length === 0 && this.knowledgeFramework) {
      const inferredTentacles = this._inferAffectedTentacles(error);
      affectedTentacles.push(...inferredTentacles);
    }
    
    return affectedTentacles;
  }
  
  /**
   * Get tentacle ID from component name
   * 
   * @param {string} componentName - Name of the component
   * @returns {string|null} Tentacle ID or null if not found
   * @private
   */
  _getTentacleIdFromComponent(componentName) {
    if (!this.tentacleRegistry) {
      return null;
    }
    
    // Try direct lookup first
    const tentacle = this.tentacleRegistry.getTentacleByComponent(componentName);
    if (tentacle) {
      return tentacle.id;
    }
    
    // Try to infer from component name
    const allTentacles = this.tentacleRegistry.getAllTentacles();
    for (const tentacle of allTentacles) {
      if (componentName.includes(tentacle.id) || 
          componentName.includes(tentacle.name) ||
          (tentacle.components && tentacle.components.some(c => 
            componentName.includes(c.name) || componentName.includes(c.id)))) {
        return tentacle.id;
      }
    }
    
    return null;
  }
  
  /**
   * Infer affected tentacles from error information
   * 
   * @param {Object} error - The error object
   * @returns {Array} List of inferred affected tentacles
   * @private
   */
  _inferAffectedTentacles(error) {
    const inferredTentacles = [];
    
    if (!this.knowledgeFramework) {
      return inferredTentacles;
    }
    
    // Query knowledge framework for tentacles related to this error type
    const relatedTentacles = this.knowledgeFramework.query({
      type: 'error_tentacle_mapping',
      errorType: error.type,
      errorCode: error.code,
      limit: 5
    });
    
    for (const relation of relatedTentacles) {
      if (relation.tentacleId && !inferredTentacles.some(t => t.id === relation.tentacleId)) {
        inferredTentacles.push({
          id: relation.tentacleId,
          directlyAffected: true,
          errorSource: false,
          confidence: relation.confidence || 0.5,
          inferred: true
        });
      }
    }
    
    return inferredTentacles;
  }
  
  /**
   * Get current state of tentacles
   * 
   * @param {Array} tentacles - List of tentacles
   * @returns {Object} Map of tentacle states
   * @private
   */
  async _getTentacleStates(tentacles) {
    const states = {};
    
    if (!this.tentacleRegistry) {
      return states;
    }
    
    for (const tentacle of tentacles) {
      try {
        const tentacleInstance = this.tentacleRegistry.getTentacle(tentacle.id);
        if (tentacleInstance && typeof tentacleInstance.getState === 'function') {
          states[tentacle.id] = await tentacleInstance.getState();
        } else {
          // If tentacle doesn't have getState method, check cache
          states[tentacle.id] = this.contextCache.get(`state:${tentacle.id}`) || {
            status: 'unknown',
            lastUpdated: Date.now()
          };
        }
      } catch (error) {
        console.warn(`Failed to get state for tentacle ${tentacle.id}:`, error.message);
        states[tentacle.id] = {
          status: 'error',
          error: error.message,
          lastUpdated: Date.now()
        };
      }
    }
    
    return states;
  }
  
  /**
   * Analyze dependencies between tentacles
   * 
   * @param {Array} tentacles - List of tentacles
   * @param {Object} options - Analysis options
   * @returns {Object} Dependency graph
   * @private
   */
  async _analyzeDependencies(tentacles, options) {
    const dependencyGraph = {
      nodes: [],
      edges: [],
      metadata: {
        timestamp: Date.now(),
        options
      }
    };
    
    if (!this.tentacleRegistry || !this.knowledgeFramework) {
      return dependencyGraph;
    }
    
    // Add nodes for each tentacle
    for (const tentacle of tentacles) {
      dependencyGraph.nodes.push({
        id: tentacle.id,
        type: 'tentacle',
        directlyAffected: tentacle.directlyAffected,
        errorSource: tentacle.errorSource
      });
    }
    
    // Use ML model if available
    if (this.analyzerModels.dependencyAnalyzer) {
      try {
        const enhancedGraph = await this.analyzerModels.dependencyAnalyzer.predict({
          tentacles: tentacles.map(t => t.id),
          options
        });
        
        if (enhancedGraph && enhancedGraph.edges) {
          dependencyGraph.edges = enhancedGraph.edges;
          if (enhancedGraph.nodes) {
            // Merge additional nodes
            for (const node of enhancedGraph.nodes) {
              if (!dependencyGraph.nodes.some(n => n.id === node.id)) {
                dependencyGraph.nodes.push(node);
              }
            }
          }
          return dependencyGraph;
        }
      } catch (error) {
        console.warn('ML dependency analysis failed:', error.message);
        // Fall back to knowledge-based analysis
      }
    }
    
    // Knowledge-based dependency analysis
    for (const tentacle of tentacles) {
      const dependencies = this.knowledgeFramework.query({
        type: 'tentacle_dependency',
        tentacleId: tentacle.id,
        direction: 'both',
        limit: options.maxDepth * 5
      });
      
      for (const dep of dependencies) {
        // Add edge for each dependency
        dependencyGraph.edges.push({
          source: dep.sourceId,
          target: dep.targetId,
          type: dep.type || 'depends_on',
          weight: dep.weight || 1.0,
          metadata: dep.metadata || {}
        });
        
        // Add nodes for dependencies if not already included
        if (options.includeIndirect) {
          for (const id of [dep.sourceId, dep.targetId]) {
            if (!dependencyGraph.nodes.some(n => n.id === id)) {
              dependencyGraph.nodes.push({
                id,
                type: 'tentacle',
                directlyAffected: false,
                errorSource: false
              });
            }
          }
        }
      }
    }
    
    return dependencyGraph;
  }
  
  /**
   * Assess impact of errors on tentacles and system components
   * 
   * @param {Array} tentacles - List of affected tentacles
   * @param {Object} dependencyGraph - Dependency graph
   * @returns {Object} Impact assessment
   * @private
   */
  async _assessImpact(tentacles, dependencyGraph) {
    const impactAssessment = {
      systemImpact: {
        severity: 'low',
        scope: 'isolated',
        recoverable: true
      },
      tentacleImpacts: {},
      userImpact: {
        visible: false,
        severity: 'low',
        affectedWorkflows: []
      }
    };
    
    // Use ML model if available
    if (this.analyzerModels.impactAssessor) {
      try {
        const mlAssessment = await this.analyzerModels.impactAssessor.predict({
          tentacles: tentacles.map(t => t.id),
          dependencyGraph
        });
        
        if (mlAssessment) {
          return mlAssessment;
        }
      } catch (error) {
        console.warn('ML impact assessment failed:', error.message);
        // Fall back to rule-based assessment
      }
    }
    
    // Rule-based impact assessment
    for (const tentacle of tentacles) {
      impactAssessment.tentacleImpacts[tentacle.id] = {
        severity: tentacle.errorSource ? 'high' : 'medium',
        functionalityLoss: tentacle.errorSource ? 'complete' : 'partial',
        recoverable: true
      };
    }
    
    // Assess system-wide impact based on dependency graph
    if (dependencyGraph.nodes.length > 5) {
      impactAssessment.systemImpact.severity = 'medium';
      impactAssessment.systemImpact.scope = 'widespread';
    }
    
    if (dependencyGraph.nodes.some(n => n.id.includes('core') || n.id.includes('central'))) {
      impactAssessment.systemImpact.severity = 'high';
    }
    
    // Assess user impact
    const userFacingTentacles = tentacles.filter(t => 
      t.id.includes('ui') || 
      t.id.includes('user') || 
      t.id.includes('interface') ||
      t.id.includes('assistant')
    );
    
    if (userFacingTentacles.length > 0) {
      impactAssessment.userImpact.visible = true;
      impactAssessment.userImpact.severity = 'medium';
    }
    
    return impactAssessment;
  }
  
  /**
   * Predict future state after potential recovery actions
   * 
   * @param {Array} tentacles - List of affected tentacles
   * @param {Object} currentStates - Current tentacle states
   * @param {Object} error - The error object
   * @returns {Object} Future state prediction
   * @private
   */
  async _predictFutureState(tentacles, currentStates, error) {
    const prediction = {
      tentacleStates: {},
      confidence: 0.7,
      timestamp: Date.now()
    };
    
    // Use ML model if available
    if (this.analyzerModels.statePredictor) {
      try {
        const mlPrediction = await this.analyzerModels.statePredictor.predict({
          tentacles: tentacles.map(t => t.id),
          currentStates,
          error
        });
        
        if (mlPrediction) {
          return mlPrediction;
        }
      } catch (error) {
        console.warn('ML state prediction failed:', error.message);
        // Fall back to rule-based prediction
      }
    }
    
    // Simple rule-based prediction
    for (const tentacle of tentacles) {
      const currentState = currentStates[tentacle.id] || { status: 'unknown' };
      
      prediction.tentacleStates[tentacle.id] = {
        status: 'recovered',
        previousStatus: currentState.status,
        confidence: tentacle.errorSource ? 0.7 : 0.9,
        estimatedRecoveryTimeMs: tentacle.errorSource ? 2000 : 1000
      };
    }
    
    return prediction;
  }
  
  /**
   * Generate insights based on analysis results
   * 
   * @param {Array} tentacles - List of affected tentacles
   * @param {Object} dependencyGraph - Dependency graph
   * @param {Object} impactAssessment - Impact assessment
   * @returns {Array} List of insights
   * @private
   */
  _generateInsights(tentacles, dependencyGraph, impactAssessment) {
    const insights = [];
    
    // Critical tentacle insight
    const criticalTentacles = tentacles.filter(t => t.errorSource);
    if (criticalTentacles.length > 0) {
      insights.push({
        type: 'critical_tentacle',
        description: `Primary error source identified in ${criticalTentacles.length} tentacle(s)`,
        tentacles: criticalTentacles.map(t => t.id),
        priority: 'high'
      });
    }
    
    // Dependency insight
    if (dependencyGraph.edges.length > 0) {
      const dependentCount = new Set(dependencyGraph.edges.map(e => e.target)).size;
      if (dependentCount > 3) {
        insights.push({
          type: 'high_dependency',
          description: `Error affects ${dependentCount} dependent tentacles`,
          dependentCount,
          priority: 'medium'
        });
      }
    }
    
    // User impact insight
    if (impactAssessment.userImpact.visible) {
      insights.push({
        type: 'user_visible',
        description: 'Error has user-visible impact',
        severity: impactAssessment.userImpact.severity,
        priority: 'high'
      });
    }
    
    // System impact insight
    if (impactAssessment.systemImpact.severity === 'high') {
      insights.push({
        type: 'system_critical',
        description: 'Error has critical system-wide impact',
        scope: impactAssessment.systemImpact.scope,
        priority: 'critical'
      });
    }
    
    return insights;
  }
  
  /**
   * Handle tentacle state change event
   * 
   * @param {Object} event - The state change event
   * @private
   */
  _handleTentacleStateChange(event) {
    if (!event || !event.tentacleId) {
      return;
    }
    
    // Update cache with new state
    this.contextCache.set(`state:${event.tentacleId}`, {
      status: event.status,
      lastUpdated: event.timestamp || Date.now(),
      metadata: event.metadata || {}
    });
  }
  
  /**
   * Handle tentacle registered event
   * 
   * @param {Object} event - The registration event
   * @private
   */
  _handleTentacleRegistered(event) {
    if (!event || !event.tentacle || !event.tentacle.id) {
      return;
    }
    
    // Update cache with initial state
    this.contextCache.set(`state:${event.tentacle.id}`, {
      status: 'registered',
      lastUpdated: event.timestamp || Date.now()
    });
  }
  
  /**
   * Handle tentacle unregistered event
   * 
   * @param {Object} event - The unregistration event
   * @private
   */
  _handleTentacleUnregistered(event) {
    if (!event || !event.tentacleId) {
      return;
    }
    
    // Update cache with unregistered state
    this.contextCache.set(`state:${event.tentacleId}`, {
      status: 'unregistered',
      lastUpdated: event.timestamp || Date.now()
    });
  }
}

module.exports = TentacleContextAnalyzer;
