/**
 * @fileoverview QueryProcessor for the Knowledge Graph Manager.
 * Processes graph queries with advanced optimization.
 * 
 * @author Aideon AI Team
 * @copyright 2025 AlienNova
 * @license Proprietary
 */

const { EventEmitter } = require('events');

/**
 * Query execution plan step types
 * @enum {string}
 */
const PlanStepType = {
  NODE_LOOKUP: 'NODE_LOOKUP',
  EDGE_LOOKUP: 'EDGE_LOOKUP',
  TRAVERSAL: 'TRAVERSAL',
  FILTER: 'FILTER',
  PROJECTION: 'PROJECTION',
  SORT: 'SORT',
  LIMIT: 'LIMIT',
  JOIN: 'JOIN',
  AGGREGATE: 'AGGREGATE',
  UNION: 'UNION',
  INTERSECTION: 'INTERSECTION',
  DIFFERENCE: 'DIFFERENCE'
};

/**
 * Processes graph queries with advanced optimization.
 */
class QueryProcessor extends EventEmitter {
  /**
   * Creates a new QueryProcessor instance.
   * 
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance
   * @param {Object} [options.configService] - Configuration service
   * @param {Object} [options.performanceMonitor] - Performance monitor
   * @param {Object} [options.storageAdapter] - Graph storage adapter
   * @param {Object} [options.indexManager] - Index manager
   */
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.configService = options.configService;
    this.performanceMonitor = options.performanceMonitor;
    this.storageAdapter = options.storageAdapter;
    this.indexManager = options.indexManager;
    
    this.initialized = false;
    this.queryCache = new Map();
    this.statistics = {
      queriesProcessed: 0,
      optimizationTime: 0,
      executionTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Initializes the query processor.
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Initializing QueryProcessor');
    }
    
    // Load configuration if available
    if (this.configService) {
      const config = this.configService.get('cognitive.knowledge.queryProcessor', {
        enableOptimization: true,
        maxQueryCacheSize: 100,
        defaultTimeout: 30000, // 30 seconds
        maxResultSize: 10000,
        enableParallelExecution: true,
        costModel: 'dynamic'
      });
      
      this.config = config;
    } else {
      this.config = {
        enableOptimization: true,
        maxQueryCacheSize: 100,
        defaultTimeout: 30000, // 30 seconds
        maxResultSize: 10000,
        enableParallelExecution: true,
        costModel: 'dynamic'
      };
    }
    
    this.initialized = true;
    
    if (this.logger) {
      this.logger.info('QueryProcessor initialized');
    }
    
    this.emit('initialized');
  }
  
  /**
   * Processes a graph query.
   * 
   * @param {Object} querySpec - Query specification
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.useCache=true] - Whether to use query cache
   * @param {boolean} [options.optimize=true] - Whether to optimize the query
   * @param {number} [options.timeout] - Query timeout in milliseconds
   * @returns {Promise<Object>} - Query results
   */
  async processQuery(querySpec, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const useCache = options.useCache !== false;
    const optimize = options.optimize !== false && this.config.enableOptimization;
    const timeout = options.timeout || this.config.defaultTimeout;
    
    let timerId;
    if (this.performanceMonitor) {
      timerId = this.performanceMonitor.startTimer('queryProcessor_processQuery');
    }
    
    try {
      // Validate query
      this.validateQuery(querySpec);
      
      // Check cache
      if (useCache) {
        const cacheKey = this.generateQueryCacheKey(querySpec);
        const cachedResult = this.queryCache.get(cacheKey);
        
        if (cachedResult) {
          this.statistics.cacheHits++;
          
          if (this.logger) {
            this.logger.debug('Query cache hit');
          }
          
          return cachedResult;
        }
        
        this.statistics.cacheMisses++;
      }
      
      // Optimize query
      let executionPlan;
      let optimizationTime = 0;
      
      if (optimize) {
        const optimizationStart = Date.now();
        executionPlan = await this.optimizeQuery(querySpec);
        optimizationTime = Date.now() - optimizationStart;
        this.statistics.optimizationTime += optimizationTime;
      } else {
        executionPlan = this.generateBasicExecutionPlan(querySpec);
      }
      
      // Execute query with timeout
      const executionStart = Date.now();
      const result = await this.executeQueryWithTimeout(executionPlan, timeout);
      const executionTime = Date.now() - executionStart;
      this.statistics.executionTime += executionTime;
      
      // Update statistics
      this.statistics.queriesProcessed++;
      
      // Cache result
      if (useCache) {
        const cacheKey = this.generateQueryCacheKey(querySpec);
        this.queryCache.set(cacheKey, result);
        this.enforceCacheLimit();
      }
      
      // Add execution metadata
      result.metadata = {
        executionTime,
        optimizationTime,
        timestamp: Date.now(),
        planSteps: executionPlan.length
      };
      
      return result;
    } finally {
      if (this.performanceMonitor && timerId) {
        this.performanceMonitor.endTimer(timerId);
      }
    }
  }
  
  /**
   * Validates a query specification.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @throws {Error} If the query is invalid
   */
  validateQuery(querySpec) {
    if (!querySpec) {
      throw new Error('Query specification is required');
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    // Validate query type
    if (!querySpec.type) {
      throw new Error('Query type is required');
    }
    
    const validTypes = ['node', 'edge', 'traversal', 'pattern', 'aggregate'];
    if (!validTypes.includes(querySpec.type)) {
      throw new Error(`Invalid query type: ${querySpec.type}. Valid types: ${validTypes.join(', ')}`);
    }
    
    // Validate query-specific parameters
    switch (querySpec.type) {
      case 'node':
        if (!querySpec.nodeId && !querySpec.criteria) {
          throw new Error('Node query requires either nodeId or criteria');
        }
        break;
        
      case 'edge':
        if (!querySpec.edgeId && !querySpec.criteria && 
            !(querySpec.sourceId || querySpec.targetId)) {
          throw new Error('Edge query requires either edgeId, criteria, or source/target node IDs');
        }
        break;
        
      case 'traversal':
        if (!querySpec.startNodeId) {
          throw new Error('Traversal query requires startNodeId');
        }
        if (!querySpec.direction) {
          querySpec.direction = 'outgoing'; // Default direction
        }
        if (!['outgoing', 'incoming', 'both'].includes(querySpec.direction)) {
          throw new Error(`Invalid traversal direction: ${querySpec.direction}`);
        }
        break;
        
      case 'pattern':
        if (!querySpec.pattern || !Array.isArray(querySpec.pattern)) {
          throw new Error('Pattern query requires a pattern array');
        }
        break;
        
      case 'aggregate':
        if (!querySpec.aggregation || !querySpec.aggregation.type) {
          throw new Error('Aggregate query requires an aggregation type');
        }
        if (!querySpec.target) {
          throw new Error('Aggregate query requires a target');
        }
        break;
    }
    
    // Validate common optional parameters
    if (querySpec.limit !== undefined && 
        (typeof querySpec.limit !== 'number' || querySpec.limit < 0)) {
      throw new Error('Limit must be a non-negative number');
    }
    
    if (querySpec.offset !== undefined && 
        (typeof querySpec.offset !== 'number' || querySpec.offset < 0)) {
      throw new Error('Offset must be a non-negative number');
    }
    
    if (querySpec.sort && 
        (!Array.isArray(querySpec.sort) || querySpec.sort.length === 0)) {
      throw new Error('Sort must be a non-empty array');
    }
  }
  
  /**
   * Optimizes a query for efficient execution.
   * 
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array<Object>>} - Optimized execution plan
   */
  async optimizeQuery(querySpec) {
    // Generate possible execution plans
    const executionPlans = await this.generateExecutionPlans(querySpec);
    
    // Apply optimization rules to each plan
    const optimizedPlans = await Promise.all(
      executionPlans.map(plan => this.applyOptimizationRules(plan))
    );
    
    // Estimate costs for each plan
    const plansWithCosts = await this.estimateCosts(optimizedPlans);
    
    // Select the plan with the lowest cost
    plansWithCosts.sort((a, b) => a.cost - b.cost);
    
    if (this.logger) {
      this.logger.debug(`Selected execution plan with cost ${plansWithCosts[0].cost}`);
    }
    
    return plansWithCosts[0].plan;
  }
  
  /**
   * Generates possible execution plans for a query.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array<Array<Object>>>} - Possible execution plans
   */
  async generateExecutionPlans(querySpec) {
    // In a real implementation, this would generate multiple possible plans
    // For this example, we'll generate a single plan based on the query type
    
    const basicPlan = this.generateBasicExecutionPlan(querySpec);
    
    // For simple queries, just return the basic plan
    if (['node', 'edge'].includes(querySpec.type)) {
      return [basicPlan];
    }
    
    // For more complex queries, generate alternative plans
    const plans = [basicPlan];
    
    if (querySpec.type === 'traversal') {
      // Alternative plan: use index if available
      if (this.indexManager) {
        const indexPlan = this.generateIndexBasedPlan(querySpec);
        if (indexPlan) {
          plans.push(indexPlan);
        }
      }
      
      // Alternative plan: bidirectional search
      if (querySpec.endNodeId && querySpec.maxDepth > 2) {
        const bidirectionalPlan = this.generateBidirectionalSearchPlan(querySpec);
        plans.push(bidirectionalPlan);
      }
    }
    
    if (querySpec.type === 'pattern') {
      // Alternative plan: different join orders
      const joinOrderPlans = this.generateAlternativeJoinOrders(querySpec);
      plans.push(...joinOrderPlans);
    }
    
    return plans;
  }
  
  /**
   * Generates a basic execution plan for a query.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {Array<Object>} - Basic execution plan
   */
  generateBasicExecutionPlan(querySpec) {
    const plan = [];
    
    switch (querySpec.type) {
      case 'node':
        if (querySpec.nodeId) {
          plan.push({
            type: PlanStepType.NODE_LOOKUP,
            nodeId: querySpec.nodeId
          });
        } else {
          plan.push({
            type: PlanStepType.NODE_LOOKUP,
            criteria: querySpec.criteria
          });
        }
        break;
        
      case 'edge':
        if (querySpec.edgeId) {
          plan.push({
            type: PlanStepType.EDGE_LOOKUP,
            edgeId: querySpec.edgeId
          });
        } else if (querySpec.sourceId && querySpec.targetId) {
          plan.push({
            type: PlanStepType.EDGE_LOOKUP,
            sourceId: querySpec.sourceId,
            targetId: querySpec.targetId,
            edgeType: querySpec.edgeType
          });
        } else {
          plan.push({
            type: PlanStepType.EDGE_LOOKUP,
            criteria: querySpec.criteria
          });
        }
        break;
        
      case 'traversal':
        plan.push({
          type: PlanStepType.NODE_LOOKUP,
          nodeId: querySpec.startNodeId
        });
        
        plan.push({
          type: PlanStepType.TRAVERSAL,
          direction: querySpec.direction || 'outgoing',
          edgeTypes: querySpec.edgeTypes,
          maxDepth: querySpec.maxDepth || 1,
          strategy: 'breadth-first'
        });
        break;
        
      case 'pattern':
        // For each step in the pattern
        for (let i = 0; i < querySpec.pattern.length; i++) {
          const step = querySpec.pattern[i];
          
          if (i === 0) {
            // First step: node lookup
            plan.push({
              type: PlanStepType.NODE_LOOKUP,
              criteria: step.node
            });
          } else {
            // Subsequent steps: traversal
            plan.push({
              type: PlanStepType.TRAVERSAL,
              direction: step.direction || 'outgoing',
              edgeTypes: step.edgeTypes,
              nodeTypes: step.nodeTypes,
              maxDepth: 1
            });
          }
        }
        break;
        
      case 'aggregate':
        // First, get the target data
        if (querySpec.target.type === 'node') {
          plan.push({
            type: PlanStepType.NODE_LOOKUP,
            criteria: querySpec.target.criteria
          });
        } else if (querySpec.target.type === 'edge') {
          plan.push({
            type: PlanStepType.EDGE_LOOKUP,
            criteria: querySpec.target.criteria
          });
        }
        
        // Then, apply aggregation
        plan.push({
          type: PlanStepType.AGGREGATE,
          aggregation: querySpec.aggregation
        });
        break;
    }
    
    // Add common operations
    if (querySpec.filter) {
      plan.push({
        type: PlanStepType.FILTER,
        conditions: querySpec.filter
      });
    }
    
    if (querySpec.sort) {
      plan.push({
        type: PlanStepType.SORT,
        sortBy: querySpec.sort
      });
    }
    
    if (querySpec.limit !== undefined || querySpec.offset !== undefined) {
      plan.push({
        type: PlanStepType.LIMIT,
        limit: querySpec.limit,
        offset: querySpec.offset
      });
    }
    
    if (querySpec.projection) {
      plan.push({
        type: PlanStepType.PROJECTION,
        fields: querySpec.projection
      });
    }
    
    return plan;
  }
  
  /**
   * Generates an index-based execution plan.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {Array<Object>|null} - Index-based plan or null if not applicable
   */
  generateIndexBasedPlan(querySpec) {
    // This is a simplified example
    // In a real implementation, this would check available indexes and generate a plan
    
    if (querySpec.type !== 'traversal' || !this.indexManager) {
      return null;
    }
    
    // Check if there's an index for the edge types
    const hasIndex = querySpec.edgeTypes && querySpec.edgeTypes.length > 0;
    
    if (!hasIndex) {
      return null;
    }
    
    const plan = [
      {
        type: PlanStepType.NODE_LOOKUP,
        nodeId: querySpec.startNodeId
      },
      {
        type: PlanStepType.TRAVERSAL,
        direction: querySpec.direction || 'outgoing',
        edgeTypes: querySpec.edgeTypes,
        maxDepth: querySpec.maxDepth || 1,
        strategy: 'index-based'
      }
    ];
    
    // Add common operations
    if (querySpec.filter) {
      plan.push({
        type: PlanStepType.FILTER,
        conditions: querySpec.filter
      });
    }
    
    if (querySpec.sort) {
      plan.push({
        type: PlanStepType.SORT,
        sortBy: querySpec.sort
      });
    }
    
    if (querySpec.limit !== undefined || querySpec.offset !== undefined) {
      plan.push({
        type: PlanStepType.LIMIT,
        limit: querySpec.limit,
        offset: querySpec.offset
      });
    }
    
    return plan;
  }
  
  /**
   * Generates a bidirectional search plan for traversal queries.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {Array<Object>} - Bidirectional search plan
   */
  generateBidirectionalSearchPlan(querySpec) {
    if (querySpec.type !== 'traversal' || !querySpec.endNodeId) {
      return [];
    }
    
    const plan = [
      {
        type: PlanStepType.NODE_LOOKUP,
        nodeId: querySpec.startNodeId
      },
      {
        type: PlanStepType.NODE_LOOKUP,
        nodeId: querySpec.endNodeId
      },
      {
        type: PlanStepType.TRAVERSAL,
        strategy: 'bidirectional',
        direction: querySpec.direction || 'outgoing',
        edgeTypes: querySpec.edgeTypes,
        maxDepth: Math.ceil((querySpec.maxDepth || 1) / 2)
      }
    ];
    
    // Add common operations
    if (querySpec.filter) {
      plan.push({
        type: PlanStepType.FILTER,
        conditions: querySpec.filter
      });
    }
    
    if (querySpec.sort) {
      plan.push({
        type: PlanStepType.SORT,
        sortBy: querySpec.sort
      });
    }
    
    if (querySpec.limit !== undefined || querySpec.offset !== undefined) {
      plan.push({
        type: PlanStepType.LIMIT,
        limit: querySpec.limit,
        offset: querySpec.offset
      });
    }
    
    return plan;
  }
  
  /**
   * Generates alternative join orders for pattern queries.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {Array<Array<Object>>} - Alternative join order plans
   */
  generateAlternativeJoinOrders(querySpec) {
    if (querySpec.type !== 'pattern' || querySpec.pattern.length <= 2) {
      return [];
    }
    
    // In a real implementation, this would generate multiple join orders
    // For this example, we'll generate a single alternative
    
    const pattern = [...querySpec.pattern];
    const alternativePattern = [pattern[0]];
    
    // Reorder the pattern (simple reversal for this example)
    for (let i = pattern.length - 1; i > 0; i--) {
      alternativePattern.push(pattern[i]);
    }
    
    const plan = [];
    
    // Generate plan from alternative pattern
    for (let i = 0; i < alternativePattern.length; i++) {
      const step = alternativePattern[i];
      
      if (i === 0) {
        // First step: node lookup
        plan.push({
          type: PlanStepType.NODE_LOOKUP,
          criteria: step.node
        });
      } else {
        // Subsequent steps: traversal
        plan.push({
          type: PlanStepType.TRAVERSAL,
          direction: step.direction || 'outgoing',
          edgeTypes: step.edgeTypes,
          nodeTypes: step.nodeTypes,
          maxDepth: 1
        });
      }
    }
    
    // Add common operations
    if (querySpec.filter) {
      plan.push({
        type: PlanStepType.FILTER,
        conditions: querySpec.filter
      });
    }
    
    if (querySpec.sort) {
      plan.push({
        type: PlanStepType.SORT,
        sortBy: querySpec.sort
      });
    }
    
    if (querySpec.limit !== undefined || querySpec.offset !== undefined) {
      plan.push({
        type: PlanStepType.LIMIT,
        limit: querySpec.limit,
        offset: querySpec.offset
      });
    }
    
    return [plan];
  }
  
  /**
   * Applies optimization rules to an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Promise<Array<Object>>} - Optimized plan
   */
  async applyOptimizationRules(plan) {
    let optimizedPlan = [...plan];
    
    // Rule 1: Push down filters
    optimizedPlan = this.pushDownFilters(optimizedPlan);
    
    // Rule 2: Merge adjacent filters
    optimizedPlan = this.mergeAdjacentFilters(optimizedPlan);
    
    // Rule 3: Optimize traversals
    optimizedPlan = this.optimizeTraversals(optimizedPlan);
    
    // Rule 4: Optimize limit and sort
    optimizedPlan = this.optimizeLimitAndSort(optimizedPlan);
    
    return optimizedPlan;
  }
  
  /**
   * Pushes down filters in an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Array<Object>} - Optimized plan
   */
  pushDownFilters(plan) {
    const result = [];
    const filters = [];
    
    // Collect all filters
    for (let i = 0; i < plan.length; i++) {
      if (plan[i].type === PlanStepType.FILTER) {
        filters.push(plan[i]);
      } else {
        result.push(plan[i]);
      }
    }
    
    if (filters.length === 0) {
      return plan;
    }
    
    // Find the earliest possible position for each filter
    for (const filter of filters) {
      let inserted = false;
      
      for (let i = 0; i < result.length; i++) {
        if (this.canPushFilterBefore(filter, result.slice(i))) {
          result.splice(i, 0, filter);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        result.push(filter);
      }
    }
    
    return result;
  }
  
  /**
   * Checks if a filter can be pushed before a sequence of plan steps.
   * 
   * @private
   * @param {Object} filter - Filter step
   * @param {Array<Object>} steps - Subsequent plan steps
   * @returns {boolean} - Whether the filter can be pushed
   */
  canPushFilterBefore(filter, steps) {
    // This is a simplified implementation
    // In a real system, this would check if the filter references
    // attributes that are available at this point in the plan
    
    if (steps.length === 0) {
      return true;
    }
    
    const firstStep = steps[0];
    
    // Can't push before NODE_LOOKUP or EDGE_LOOKUP with specific ID
    if ((firstStep.type === PlanStepType.NODE_LOOKUP && firstStep.nodeId) ||
        (firstStep.type === PlanStepType.EDGE_LOOKUP && firstStep.edgeId)) {
      return false;
    }
    
    // Can push before NODE_LOOKUP or EDGE_LOOKUP with criteria
    if ((firstStep.type === PlanStepType.NODE_LOOKUP && firstStep.criteria) ||
        (firstStep.type === PlanStepType.EDGE_LOOKUP && firstStep.criteria)) {
      return true;
    }
    
    // Can't push before TRAVERSAL
    if (firstStep.type === PlanStepType.TRAVERSAL) {
      return false;
    }
    
    // Can push before SORT, LIMIT, PROJECTION
    if ([PlanStepType.SORT, PlanStepType.LIMIT, PlanStepType.PROJECTION].includes(firstStep.type)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Merges adjacent filters in an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Array<Object>} - Optimized plan
   */
  mergeAdjacentFilters(plan) {
    const result = [];
    
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      if (step.type === PlanStepType.FILTER && 
          result.length > 0 && 
          result[result.length - 1].type === PlanStepType.FILTER) {
        // Merge with previous filter
        const prevFilter = result[result.length - 1];
        prevFilter.conditions = [...prevFilter.conditions, ...step.conditions];
      } else {
        result.push(step);
      }
    }
    
    return result;
  }
  
  /**
   * Optimizes traversals in an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Array<Object>} - Optimized plan
   */
  optimizeTraversals(plan) {
    const result = [];
    
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      if (step.type === PlanStepType.TRAVERSAL) {
        // Clone the step
        const optimizedStep = { ...step };
        
        // Check if there's a filter after this traversal
        if (i + 1 < plan.length && plan[i + 1].type === PlanStepType.FILTER) {
          // Try to incorporate filter into traversal
          const filter = plan[i + 1];
          
          // Check if filter can be applied during traversal
          if (this.canIncorporateFilterInTraversal(filter)) {
            optimizedStep.filter = filter.conditions;
            result.push(optimizedStep);
            i++; // Skip the filter step
            continue;
          }
        }
        
        result.push(optimizedStep);
      } else {
        result.push(step);
      }
    }
    
    return result;
  }
  
  /**
   * Checks if a filter can be incorporated into a traversal.
   * 
   * @private
   * @param {Object} filter - Filter step
   * @returns {boolean} - Whether the filter can be incorporated
   */
  canIncorporateFilterInTraversal(filter) {
    // This is a simplified implementation
    // In a real system, this would check if the filter conditions
    // can be applied during traversal
    
    return filter.conditions.every(condition => 
      condition.property && 
      (condition.property.startsWith('node.') || condition.property.startsWith('edge.'))
    );
  }
  
  /**
   * Optimizes limit and sort operations in an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Array<Object>} - Optimized plan
   */
  optimizeLimitAndSort(plan) {
    const result = [];
    let hasLimit = false;
    let hasSort = false;
    let limitStep = null;
    let sortStep = null;
    
    // Collect limit and sort steps
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      if (step.type === PlanStepType.LIMIT) {
        hasLimit = true;
        limitStep = step;
      } else if (step.type === PlanStepType.SORT) {
        hasSort = true;
        sortStep = step;
      } else {
        result.push(step);
      }
    }
    
    // Add sort before limit
    if (hasSort) {
      result.push(sortStep);
    }
    
    if (hasLimit) {
      result.push(limitStep);
    }
    
    return result;
  }
  
  /**
   * Estimates costs for execution plans.
   * 
   * @private
   * @param {Array<Array<Object>>} plans - Execution plans
   * @returns {Promise<Array<Object>>} - Plans with cost estimates
   */
  async estimateCosts(plans) {
    const results = [];
    
    for (const plan of plans) {
      const cost = await this.estimatePlanCost(plan);
      results.push({ plan, cost });
    }
    
    return results;
  }
  
  /**
   * Estimates the cost of an execution plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Promise<number>} - Cost estimate
   */
  async estimatePlanCost(plan) {
    let totalCost = 0;
    
    for (const step of plan) {
      switch (step.type) {
        case PlanStepType.NODE_LOOKUP:
          totalCost += step.nodeId ? 1 : 100; // ID lookup is cheap, criteria lookup is expensive
          break;
          
        case PlanStepType.EDGE_LOOKUP:
          totalCost += step.edgeId ? 1 : 100; // ID lookup is cheap, criteria lookup is expensive
          break;
          
        case PlanStepType.TRAVERSAL:
          // Cost depends on strategy and depth
          if (step.strategy === 'index-based') {
            totalCost += 10 * step.maxDepth;
          } else if (step.strategy === 'bidirectional') {
            totalCost += 50 * step.maxDepth;
          } else {
            totalCost += 100 * step.maxDepth;
          }
          break;
          
        case PlanStepType.FILTER:
          totalCost += 10 * step.conditions.length;
          break;
          
        case PlanStepType.SORT:
          totalCost += 50; // Sorting is relatively expensive
          break;
          
        case PlanStepType.LIMIT:
          totalCost += 1; // Limit is cheap
          break;
          
        case PlanStepType.PROJECTION:
          totalCost += 5; // Projection is relatively cheap
          break;
          
        case PlanStepType.JOIN:
          totalCost += 200; // Joins are expensive
          break;
          
        case PlanStepType.AGGREGATE:
          totalCost += 100; // Aggregation is expensive
          break;
          
        default:
          totalCost += 50; // Default cost for unknown steps
      }
    }
    
    return totalCost;
  }
  
  /**
   * Executes a query plan with a timeout.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Query results
   */
  async executeQueryWithTimeout(plan, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query execution timed out after ${timeout}ms`));
      }, timeout);
      
      this.executePlan(plan)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
  
  /**
   * Executes a query plan.
   * 
   * @private
   * @param {Array<Object>} plan - Execution plan
   * @returns {Promise<Object>} - Query results
   */
  async executePlan(plan) {
    if (!this.storageAdapter) {
      throw new Error('Storage adapter is required for query execution');
    }
    
    let intermediateResults = [];
    
    for (const step of plan) {
      switch (step.type) {
        case PlanStepType.NODE_LOOKUP:
          intermediateResults = await this.executeNodeLookup(step, intermediateResults);
          break;
          
        case PlanStepType.EDGE_LOOKUP:
          intermediateResults = await this.executeEdgeLookup(step, intermediateResults);
          break;
          
        case PlanStepType.TRAVERSAL:
          intermediateResults = await this.executeTraversal(step, intermediateResults);
          break;
          
        case PlanStepType.FILTER:
          intermediateResults = this.executeFilter(step, intermediateResults);
          break;
          
        case PlanStepType.SORT:
          intermediateResults = this.executeSort(step, intermediateResults);
          break;
          
        case PlanStepType.LIMIT:
          intermediateResults = this.executeLimit(step, intermediateResults);
          break;
          
        case PlanStepType.PROJECTION:
          intermediateResults = this.executeProjection(step, intermediateResults);
          break;
          
        case PlanStepType.AGGREGATE:
          intermediateResults = await this.executeAggregate(step, intermediateResults);
          break;
          
        default:
          throw new Error(`Unsupported plan step type: ${step.type}`);
      }
      
      // Check result size limit
      if (intermediateResults.length > this.config.maxResultSize) {
        throw new Error(`Query result size exceeds limit (${this.config.maxResultSize})`);
      }
    }
    
    return {
      results: intermediateResults,
      count: intermediateResults.length
    };
  }
  
  /**
   * Executes a node lookup step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Promise<Array<Object>>} - Step results
   */
  async executeNodeLookup(step, previousResults) {
    if (step.nodeId) {
      // Single node lookup by ID
      const node = await this.storageAdapter.retrieveNode(step.nodeId);
      return node ? [node] : [];
    } else if (step.criteria) {
      // Query nodes by criteria
      return await this.storageAdapter.queryNodes(step.criteria);
    } else {
      throw new Error('Node lookup requires either nodeId or criteria');
    }
  }
  
  /**
   * Executes an edge lookup step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Promise<Array<Object>>} - Step results
   */
  async executeEdgeLookup(step, previousResults) {
    if (step.edgeId) {
      // Single edge lookup by ID
      const edge = await this.storageAdapter.retrieveEdge(step.edgeId);
      return edge ? [edge] : [];
    } else if (step.sourceId && step.targetId) {
      // Query edges by source and target
      const criteria = {
        sourceId: step.sourceId,
        targetId: step.targetId
      };
      
      if (step.edgeType) {
        criteria.type = step.edgeType;
      }
      
      return await this.storageAdapter.queryEdges(criteria);
    } else if (step.criteria) {
      // Query edges by criteria
      return await this.storageAdapter.queryEdges(step.criteria);
    } else {
      throw new Error('Edge lookup requires either edgeId, source/target IDs, or criteria');
    }
  }
  
  /**
   * Executes a traversal step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Promise<Array<Object>>} - Step results
   */
  async executeTraversal(step, previousResults) {
    if (previousResults.length === 0) {
      return [];
    }
    
    const results = [];
    const visited = new Set();
    
    // For each starting node
    for (const startNode of previousResults) {
      if (!startNode.id) {
        continue;
      }
      
      // Execute traversal from this node
      const traversalResults = await this.traverseGraph(
        startNode.id,
        step.direction,
        step.edgeTypes,
        step.maxDepth,
        step.strategy,
        step.filter,
        visited
      );
      
      results.push(...traversalResults);
    }
    
    return results;
  }
  
  /**
   * Traverses the graph from a starting node.
   * 
   * @private
   * @param {string} startNodeId - Starting node ID
   * @param {string} direction - Traversal direction
   * @param {Array<string>} edgeTypes - Edge types to follow
   * @param {number} maxDepth - Maximum traversal depth
   * @param {string} strategy - Traversal strategy
   * @param {Array<Object>} filter - Filter conditions
   * @param {Set<string>} visited - Set of visited node IDs
   * @returns {Promise<Array<Object>>} - Traversal results
   */
  async traverseGraph(startNodeId, direction, edgeTypes, maxDepth, strategy, filter, visited) {
    // This is a simplified implementation
    // In a real system, this would implement different traversal strategies
    
    if (strategy === 'bidirectional') {
      // Bidirectional search is complex and not implemented in this example
      throw new Error('Bidirectional search not implemented in this example');
    }
    
    const results = [];
    const queue = [{ nodeId: startNodeId, depth: 0 }];
    visited.add(startNodeId);
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();
      
      if (depth > 0) {
        // Add this node to results (skip the start node)
        const node = await this.storageAdapter.retrieveNode(nodeId);
        if (node) {
          // Apply filter if provided
          if (!filter || this.passesFilter(node, filter)) {
            results.push(node);
          }
        }
      }
      
      if (depth < maxDepth) {
        // Find connected nodes
        const edgeCriteria = {};
        
        if (direction === 'outgoing' || direction === 'both') {
          edgeCriteria.sourceId = nodeId;
        }
        
        if (direction === 'incoming' || direction === 'both') {
          edgeCriteria.targetId = nodeId;
        }
        
        if (edgeTypes && edgeTypes.length > 0) {
          edgeCriteria.type = { $in: edgeTypes };
        }
        
        const edges = await this.storageAdapter.queryEdges(edgeCriteria);
        
        for (const edge of edges) {
          const nextNodeId = direction === 'incoming' ? edge.sourceId : edge.targetId;
          
          if (!visited.has(nextNodeId)) {
            visited.add(nextNodeId);
            queue.push({ nodeId: nextNodeId, depth: depth + 1 });
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Executes a filter step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Array<Object>} - Step results
   */
  executeFilter(step, previousResults) {
    return previousResults.filter(item => this.passesFilter(item, step.conditions));
  }
  
  /**
   * Checks if an item passes a filter.
   * 
   * @private
   * @param {Object} item - Item to check
   * @param {Array<Object>} conditions - Filter conditions
   * @returns {boolean} - Whether the item passes the filter
   */
  passesFilter(item, conditions) {
    for (const condition of conditions) {
      const { property, operator, value } = condition;
      
      // Get property value (support nested properties)
      const propertyValue = this.getPropertyValue(item, property);
      
      // Check condition
      if (!this.evaluateCondition(propertyValue, operator, value)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Gets a property value from an object, supporting nested properties.
   * 
   * @private
   * @param {Object} obj - Object to get property from
   * @param {string} property - Property path (e.g., 'properties.name')
   * @returns {any} - Property value
   */
  getPropertyValue(obj, property) {
    const parts = property.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }
  
  /**
   * Evaluates a condition.
   * 
   * @private
   * @param {any} propertyValue - Property value
   * @param {string} operator - Condition operator
   * @param {any} conditionValue - Condition value
   * @returns {boolean} - Whether the condition is met
   */
  evaluateCondition(propertyValue, operator, conditionValue) {
    switch (operator) {
      case '=':
      case '==':
      case 'eq':
        return propertyValue === conditionValue;
        
      case '!=':
      case 'ne':
        return propertyValue !== conditionValue;
        
      case '<':
      case 'lt':
        return propertyValue < conditionValue;
        
      case '<=':
      case 'lte':
        return propertyValue <= conditionValue;
        
      case '>':
      case 'gt':
        return propertyValue > conditionValue;
        
      case '>=':
      case 'gte':
        return propertyValue >= conditionValue;
        
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(propertyValue);
        
      case 'nin':
        return Array.isArray(conditionValue) && !conditionValue.includes(propertyValue);
        
      case 'contains':
        return typeof propertyValue === 'string' && 
               propertyValue.includes(conditionValue);
        
      case 'startsWith':
        return typeof propertyValue === 'string' && 
               propertyValue.startsWith(conditionValue);
        
      case 'endsWith':
        return typeof propertyValue === 'string' && 
               propertyValue.endsWith(conditionValue);
        
      case 'regex':
        return typeof propertyValue === 'string' && 
               new RegExp(conditionValue).test(propertyValue);
        
      case 'exists':
        return propertyValue !== undefined && propertyValue !== null;
        
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
  
  /**
   * Executes a sort step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Array<Object>} - Step results
   */
  executeSort(step, previousResults) {
    const sortBy = step.sortBy;
    
    return [...previousResults].sort((a, b) => {
      for (const sort of sortBy) {
        const { property, direction } = sort;
        const aValue = this.getPropertyValue(a, property);
        const bValue = this.getPropertyValue(b, property);
        
        if (aValue === bValue) {
          continue;
        }
        
        const directionMultiplier = direction === 'desc' ? -1 : 1;
        
        if (aValue === undefined || aValue === null) {
          return directionMultiplier;
        }
        
        if (bValue === undefined || bValue === null) {
          return -directionMultiplier;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return directionMultiplier * aValue.localeCompare(bValue);
        }
        
        return directionMultiplier * (aValue < bValue ? -1 : 1);
      }
      
      return 0;
    });
  }
  
  /**
   * Executes a limit step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Array<Object>} - Step results
   */
  executeLimit(step, previousResults) {
    const offset = step.offset || 0;
    const limit = step.limit !== undefined ? step.limit : previousResults.length;
    
    return previousResults.slice(offset, offset + limit);
  }
  
  /**
   * Executes a projection step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Array<Object>} - Step results
   */
  executeProjection(step, previousResults) {
    const fields = step.fields;
    
    return previousResults.map(item => {
      const result = {};
      
      for (const field of fields) {
        const value = this.getPropertyValue(item, field);
        
        // Set the value in the result (support nested fields)
        this.setPropertyValue(result, field, value);
      }
      
      return result;
    });
  }
  
  /**
   * Sets a property value in an object, supporting nested properties.
   * 
   * @private
   * @param {Object} obj - Object to set property in
   * @param {string} property - Property path (e.g., 'properties.name')
   * @param {any} value - Property value
   */
  setPropertyValue(obj, property, value) {
    const parts = property.split('.');
    const lastPart = parts.pop();
    let current = obj;
    
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[lastPart] = value;
  }
  
  /**
   * Executes an aggregate step.
   * 
   * @private
   * @param {Object} step - Plan step
   * @param {Array<Object>} previousResults - Results from previous step
   * @returns {Promise<Array<Object>>} - Step results
   */
  async executeAggregate(step, previousResults) {
    const { aggregation } = step;
    const { type, field } = aggregation;
    
    switch (type) {
      case 'count':
        return [{ count: previousResults.length }];
        
      case 'sum':
        {
          let sum = 0;
          
          for (const item of previousResults) {
            const value = this.getPropertyValue(item, field);
            
            if (typeof value === 'number') {
              sum += value;
            }
          }
          
          return [{ sum }];
        }
        
      case 'avg':
        {
          let sum = 0;
          let count = 0;
          
          for (const item of previousResults) {
            const value = this.getPropertyValue(item, field);
            
            if (typeof value === 'number') {
              sum += value;
              count++;
            }
          }
          
          const avg = count > 0 ? sum / count : 0;
          
          return [{ avg }];
        }
        
      case 'min':
        {
          let min = null;
          
          for (const item of previousResults) {
            const value = this.getPropertyValue(item, field);
            
            if (typeof value === 'number') {
              if (min === null || value < min) {
                min = value;
              }
            }
          }
          
          return [{ min }];
        }
        
      case 'max':
        {
          let max = null;
          
          for (const item of previousResults) {
            const value = this.getPropertyValue(item, field);
            
            if (typeof value === 'number') {
              if (max === null || value > max) {
                max = value;
              }
            }
          }
          
          return [{ max }];
        }
        
      case 'group':
        {
          const groups = new Map();
          
          for (const item of previousResults) {
            const groupValue = this.getPropertyValue(item, field);
            const groupKey = groupValue !== undefined && groupValue !== null ? 
              groupValue.toString() : 'null';
            
            if (!groups.has(groupKey)) {
              groups.set(groupKey, []);
            }
            
            groups.get(groupKey).push(item);
          }
          
          const result = [];
          
          for (const [groupKey, groupItems] of groups.entries()) {
            result.push({
              group: groupKey,
              count: groupItems.length,
              items: groupItems
            });
          }
          
          return result;
        }
        
      default:
        throw new Error(`Unsupported aggregation type: ${type}`);
    }
  }
  
  /**
   * Generates a cache key for a query.
   * 
   * @private
   * @param {Object} querySpec - Query specification
   * @returns {string} - Cache key
   */
  generateQueryCacheKey(querySpec) {
    return JSON.stringify(querySpec);
  }
  
  /**
   * Enforces the query cache size limit.
   * 
   * @private
   */
  enforceCacheLimit() {
    if (this.queryCache.size <= this.config.maxQueryCacheSize) {
      return;
    }
    
    // Remove oldest entries
    const entriesToRemove = this.queryCache.size - this.config.maxQueryCacheSize;
    const keys = Array.from(this.queryCache.keys()).slice(0, entriesToRemove);
    
    for (const key of keys) {
      this.queryCache.delete(key);
    }
  }
  
  /**
   * Explains a query execution plan.
   * 
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Object>} - Query explanation
   */
  async explainQuery(querySpec) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Validate query
    this.validateQuery(querySpec);
    
    // Generate possible execution plans
    const executionPlans = await this.generateExecutionPlans(querySpec);
    
    // Apply optimization rules to each plan
    const optimizedPlans = await Promise.all(
      executionPlans.map(plan => this.applyOptimizationRules(plan))
    );
    
    // Estimate costs for each plan
    const plansWithCosts = await this.estimateCosts(optimizedPlans);
    
    // Sort by cost
    plansWithCosts.sort((a, b) => a.cost - b.cost);
    
    // Format explanation
    return {
      query: querySpec,
      possiblePlans: plansWithCosts.map((planWithCost, index) => ({
        planNumber: index + 1,
        cost: planWithCost.cost,
        steps: planWithCost.plan.map(step => ({
          type: step.type,
          ...step
        })),
        selected: index === 0
      })),
      selectedPlan: {
        cost: plansWithCosts[0].cost,
        steps: plansWithCosts[0].plan.map(step => ({
          type: step.type,
          ...step
        }))
      }
    };
  }
  
  /**
   * Gets query processor statistics.
   * 
   * @returns {Object} - Statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      cacheSize: this.queryCache.size,
      maxCacheSize: this.config.maxQueryCacheSize,
      cacheHitRate: this.statistics.queriesProcessed > 0 ? 
        this.statistics.cacheHits / this.statistics.queriesProcessed : 0,
      averageOptimizationTime: this.statistics.queriesProcessed > 0 ? 
        this.statistics.optimizationTime / this.statistics.queriesProcessed : 0,
      averageExecutionTime: this.statistics.queriesProcessed > 0 ? 
        this.statistics.executionTime / this.statistics.queriesProcessed : 0
    };
  }
  
  /**
   * Resets query processor statistics.
   */
  resetStatistics() {
    this.statistics = {
      queriesProcessed: 0,
      optimizationTime: 0,
      executionTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Clears the query cache.
   */
  clearCache() {
    this.queryCache.clear();
    
    if (this.logger) {
      this.logger.debug('Query cache cleared');
    }
  }
  
  /**
   * Shuts down the query processor.
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }
    
    if (this.logger) {
      this.logger.debug('Shutting down QueryProcessor');
    }
    
    this.queryCache.clear();
    this.initialized = false;
    
    this.emit('shutdown');
  }
}

module.exports = { QueryProcessor, PlanStepType };
