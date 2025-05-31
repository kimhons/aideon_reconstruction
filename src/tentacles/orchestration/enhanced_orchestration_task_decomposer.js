/**
 * Enhanced Orchestration Tentacle - Intelligent Task Decomposer
 * 
 * This file implements the Intelligent Task Decomposer component as specified in the
 * Enhanced Orchestration Tentacle architecture and interfaces.
 */

const { EOTComponent } = require('./enhanced_orchestration_foundation');

/**
 * Intelligent Task Decomposer
 * 
 * Responsible for decomposing complex goals into executable micro-tasks using
 * advanced LLMs and specialized models.
 */
class IntelligentTaskDecomposer extends EOTComponent {
  constructor(config = {}) {
    super('IntelligentTaskDecomposer', config);
    this.modelEnsemble = null;
    this.htnPlanner = null;
    this.decompositionStrategies = new Map();
    this.complexityAnalyzer = null;
  }

  async initialize(dependencies) {
    try {
      // Extract dependencies
      this.modelEnsemble = dependencies.modelEnsemble;
      this.htnPlanner = dependencies.htnPlanner;
      this.eventBus = dependencies.eventBus;
      
      // Initialize complexity analyzer
      this.complexityAnalyzer = new TaskComplexityAnalyzer(this.config.complexityAnalysis || {});
      await this.complexityAnalyzer.initialize();
      
      // Register decomposition strategies
      await this.registerDecompositionStrategies();
      
      // Subscribe to relevant events
      if (this.eventBus) {
        this.eventBus.subscribe('eot:goal:submitted', this.handleGoalSubmission.bind(this), this.id);
      }
      
      this.logger.info('Intelligent Task Decomposer initialized');
      return await super.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize Intelligent Task Decomposer:', error);
      return false;
    }
  }

  /**
   * Register available decomposition strategies
   */
  async registerDecompositionStrategies() {
    // Register default strategies
    this.decompositionStrategies.set('hierarchical', new HierarchicalDecompositionStrategy());
    this.decompositionStrategies.set('parallel', new ParallelDecompositionStrategy());
    this.decompositionStrategies.set('sequential', new SequentialDecompositionStrategy());
    
    // Register advanced strategies if configured
    if (this.config.enableAdvancedStrategies) {
      this.decompositionStrategies.set('monte_carlo', new MonteCarloDecompositionStrategy());
      this.decompositionStrategies.set('recursive', new RecursiveDecompositionStrategy());
    }
    
    this.logger.info(`Registered ${this.decompositionStrategies.size} decomposition strategies`);
  }

  /**
   * Handle goal submission event
   */
  async handleGoalSubmission(goal) {
    try {
      this.logger.info(`Received goal submission: ${goal.id}`);
      const result = await this.decomposeGoal(goal, { automatic: true });
      await this.eventBus.publish('eot:task:decomposed', result, this.id);
    } catch (error) {
      this.logger.error(`Error processing goal ${goal.id}:`, error);
      await this.eventBus.publish('eot:task:decomposition_failed', {
        goalId: goal.id,
        error: error.message
      }, this.id);
    }
  }

  /**
   * Decompose a high-level goal into a hierarchical task network (HTN)
   * @param {Object} goal - The high-level goal description
   * @param {Object} context - Current orchestration context
   * @returns {Promise<Object>} - The resulting task decomposition
   */
  async decomposeGoal(goal, context = {}) {
    this.logger.info(`Decomposing goal: ${goal.id}`);
    
    // Validate goal
    if (!goal.id || !goal.description) {
      throw new Error('Invalid goal: must contain id and description');
    }
    
    // Select decomposition strategy
    const strategyName = context.strategy || this.selectOptimalStrategy(goal, context);
    const strategy = this.decompositionStrategies.get(strategyName);
    
    if (!strategy) {
      throw new Error(`Unknown decomposition strategy: ${strategyName}`);
    }
    
    // Perform initial decomposition
    const initialDecomposition = await strategy.decompose(goal, context, this.modelEnsemble);
    
    // Analyze complexity
    const complexityScore = await this.complexityAnalyzer.analyzeComplexity(initialDecomposition);
    
    // Estimate resource requirements
    const estimatedResources = await this.estimateResourceRequirements(initialDecomposition, complexityScore);
    
    // Build dependency graph
    const dependencies = await this.buildDependencyGraph(initialDecomposition);
    
    // Create final result
    const result = {
      goalId: goal.id,
      rootTask: initialDecomposition,
      complexityScore,
      estimatedResources,
      dependencies,
      strategy: strategyName,
      timestamp: Date.now()
    };
    
    this.logger.info(`Goal ${goal.id} decomposed into ${this.countTasks(initialDecomposition)} tasks`);
    return result;
  }

  /**
   * Select the optimal decomposition strategy based on goal and context
   */
  selectOptimalStrategy(goal, context) {
    // Default to hierarchical for most cases
    if (!context.preferredStrategy) {
      return 'hierarchical';
    }
    
    // Use context-provided strategy if available
    if (this.decompositionStrategies.has(context.preferredStrategy)) {
      return context.preferredStrategy;
    }
    
    // Fallback to hierarchical
    return 'hierarchical';
  }

  /**
   * Estimate resource requirements for the decomposed tasks
   */
  async estimateResourceRequirements(taskHierarchy, complexityScore) {
    // Basic estimation based on complexity score and task count
    const taskCount = this.countTasks(taskHierarchy);
    
    // Calculate base requirements
    const baseRequirements = {
      cpu: Math.max(0.1, complexityScore * 0.2),
      memory: Math.max(128 * 1024 * 1024, taskCount * 10 * 1024 * 1024), // At least 128MB
      networkBandwidth: Math.max(1, taskCount * 0.5) // At least 1 Mbps
    };
    
    // Add GPU requirements if needed
    if (complexityScore > 0.7 || taskCount > 100) {
      baseRequirements.gpu = Math.max(0.1, complexityScore * 0.3);
    }
    
    return baseRequirements;
  }

  /**
   * Build dependency graph from task hierarchy
   */
  async buildDependencyGraph(taskHierarchy) {
    // Create a simple dependency graph based on the hierarchy
    const dependencies = {
      nodes: [],
      edges: []
    };
    
    // Helper function to traverse the hierarchy and build the graph
    const traverse = (task, parentId = null) => {
      // Add node
      dependencies.nodes.push({
        id: task.taskId,
        type: task.type
      });
      
      // Add edge from parent if exists
      if (parentId) {
        dependencies.edges.push({
          from: parentId,
          to: task.taskId,
          type: 'parent_child'
        });
      }
      
      // Process subtasks if any
      if (task.subtasks && task.subtasks.length > 0) {
        // Add dependencies between sequential subtasks
        for (let i = 1; i < task.subtasks.length; i++) {
          dependencies.edges.push({
            from: task.subtasks[i-1].taskId,
            to: task.subtasks[i].taskId,
            type: 'sequential'
          });
        }
        
        // Recursively process each subtask
        task.subtasks.forEach(subtask => traverse(subtask, task.taskId));
      }
    };
    
    // Start traversal from root
    traverse(taskHierarchy);
    
    return dependencies;
  }

  /**
   * Count total number of tasks in hierarchy
   */
  countTasks(taskHierarchy) {
    let count = 1; // Count the current task
    
    if (taskHierarchy.subtasks && taskHierarchy.subtasks.length > 0) {
      taskHierarchy.subtasks.forEach(subtask => {
        count += this.countTasks(subtask);
      });
    }
    
    return count;
  }

  async shutdown() {
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('eot:goal:submitted', this.id);
    }
    
    this.logger.info('Intelligent Task Decomposer shutdown');
    return await super.shutdown();
  }
}

/**
 * Task Complexity Analyzer
 * 
 * Analyzes the complexity of decomposed tasks
 */
class TaskComplexityAnalyzer {
  constructor(config = {}) {
    this.config = config;
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('TaskComplexityAnalyzer');
  }

  async initialize() {
    this.logger.info('Task Complexity Analyzer initialized');
    return true;
  }

  /**
   * Analyze the complexity of a task hierarchy
   * @returns {Promise<number>} Complexity score between 0 and 1
   */
  async analyzeComplexity(taskHierarchy) {
    // Count metrics
    const metrics = this.calculateComplexityMetrics(taskHierarchy);
    
    // Calculate weighted score
    let score = 0;
    score += metrics.depth * 0.2;
    score += (metrics.totalTasks / 100) * 0.3; // Normalize to ~100 tasks
    score += metrics.maxBranching * 0.15;
    score += metrics.avgBranching * 0.15;
    score += (metrics.primitiveRatio) * 0.2;
    
    // Normalize to 0-1 range
    score = Math.min(1, Math.max(0, score / 5));
    
    return score;
  }

  /**
   * Calculate complexity metrics for a task hierarchy
   */
  calculateComplexityMetrics(taskHierarchy) {
    const metrics = {
      depth: 0,
      totalTasks: 0,
      primitiveCount: 0,
      compoundCount: 0,
      maxBranching: 0,
      totalBranching: 0,
      branchingPoints: 0
    };
    
    // Helper function to traverse the hierarchy
    const traverse = (task, currentDepth) => {
      metrics.totalTasks++;
      metrics.depth = Math.max(metrics.depth, currentDepth);
      
      if (task.type === 'primitive') {
        metrics.primitiveCount++;
      } else {
        metrics.compoundCount++;
      }
      
      if (task.subtasks && task.subtasks.length > 0) {
        metrics.maxBranching = Math.max(metrics.maxBranching, task.subtasks.length);
        metrics.totalBranching += task.subtasks.length;
        metrics.branchingPoints++;
        
        task.subtasks.forEach(subtask => traverse(subtask, currentDepth + 1));
      }
    };
    
    // Start traversal from root
    traverse(taskHierarchy, 1);
    
    // Calculate derived metrics
    metrics.avgBranching = metrics.branchingPoints > 0 ? 
      metrics.totalBranching / metrics.branchingPoints : 0;
    metrics.primitiveRatio = metrics.totalTasks > 0 ? 
      metrics.primitiveCount / metrics.totalTasks : 0;
    
    return metrics;
  }
}

/**
 * Base class for decomposition strategies
 */
class DecompositionStrategy {
  constructor() {
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('DecompositionStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    throw new Error('Method not implemented');
  }
}

/**
 * Hierarchical Decomposition Strategy
 */
class HierarchicalDecompositionStrategy extends DecompositionStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('HierarchicalStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    this.logger.info(`Decomposing goal ${goal.id} using hierarchical strategy`);
    
    // Create root task
    const rootTask = {
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: goal.description,
      type: 'compound',
      subtasks: [],
      estimatedDuration: 0,
      requiredCapabilities: [],
      resourceNeeds: { cpu: 0.1, memory: 64 * 1024 * 1024 }
    };
    
    // If we have a model ensemble, use it for intelligent decomposition
    if (modelEnsemble) {
      try {
        const decompositionResult = await modelEnsemble.processWithEnsemble(
          'task_decomposition',
          {
            goal: goal.description,
            constraints: goal.constraints || {},
            context: context
          },
          { maxDepth: 3 }
        );
        
        if (decompositionResult && decompositionResult.tasks) {
          // Convert model output to our task format
          rootTask.subtasks = decompositionResult.tasks.map(task => ({
            taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            description: task.description,
            type: task.hasSubtasks ? 'compound' : 'primitive',
            subtasks: [],
            estimatedDuration: task.estimatedDuration || 60,
            requiredCapabilities: task.requiredCapabilities || [],
            resourceNeeds: task.resourceNeeds || { cpu: 0.1, memory: 32 * 1024 * 1024 }
          }));
          
          // Update root task estimated duration
          rootTask.estimatedDuration = rootTask.subtasks.reduce(
            (total, task) => total + task.estimatedDuration, 0
          );
          
          // Collect all required capabilities
          const allCapabilities = new Set();
          rootTask.subtasks.forEach(task => {
            task.requiredCapabilities.forEach(cap => allCapabilities.add(cap));
          });
          rootTask.requiredCapabilities = Array.from(allCapabilities);
          
          return rootTask;
        }
      } catch (error) {
        this.logger.error('Error using model ensemble for decomposition:', error);
        // Fall back to basic decomposition
      }
    }
    
    // Basic decomposition (fallback)
    rootTask.subtasks = this.basicDecomposition(goal);
    rootTask.estimatedDuration = rootTask.subtasks.reduce(
      (total, task) => total + task.estimatedDuration, 0
    );
    
    return rootTask;
  }
  
  /**
   * Basic decomposition without using models
   */
  basicDecomposition(goal) {
    // Simple parsing-based decomposition
    const description = goal.description.toLowerCase();
    const subtasks = [];
    
    // Add planning subtask
    subtasks.push({
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: `Plan approach for: ${goal.description}`,
      type: 'primitive',
      subtasks: [],
      estimatedDuration: 60,
      requiredCapabilities: ['planning'],
      resourceNeeds: { cpu: 0.1, memory: 32 * 1024 * 1024 }
    });
    
    // Add research subtask if needed
    if (description.includes('research') || description.includes('analyze') || 
        description.includes('investigate') || description.includes('study')) {
      subtasks.push({
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: `Research information for: ${goal.description}`,
        type: 'primitive',
        subtasks: [],
        estimatedDuration: 300,
        requiredCapabilities: ['research', 'information_retrieval'],
        resourceNeeds: { cpu: 0.2, memory: 64 * 1024 * 1024 }
      });
    }
    
    // Add implementation subtask
    subtasks.push({
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: `Implement solution for: ${goal.description}`,
      type: 'primitive',
      subtasks: [],
      estimatedDuration: 300,
      requiredCapabilities: ['implementation'],
      resourceNeeds: { cpu: 0.3, memory: 128 * 1024 * 1024 }
    });
    
    // Add verification subtask
    subtasks.push({
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: `Verify results for: ${goal.description}`,
      type: 'primitive',
      subtasks: [],
      estimatedDuration: 120,
      requiredCapabilities: ['verification'],
      resourceNeeds: { cpu: 0.1, memory: 64 * 1024 * 1024 }
    });
    
    return subtasks;
  }
}

/**
 * Parallel Decomposition Strategy
 */
class ParallelDecompositionStrategy extends DecompositionStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('ParallelStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    this.logger.info(`Decomposing goal ${goal.id} using parallel strategy`);
    
    // Create root task (implementation would be similar to HierarchicalDecompositionStrategy
    // but optimized for parallel execution)
    const rootTask = {
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: goal.description,
      type: 'compound',
      subtasks: [],
      estimatedDuration: 0,
      requiredCapabilities: [],
      resourceNeeds: { cpu: 0.1, memory: 64 * 1024 * 1024 }
    };
    
    // Basic implementation for now
    rootTask.subtasks = [
      {
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: `Parallel processing for: ${goal.description}`,
        type: 'primitive',
        subtasks: [],
        estimatedDuration: 120,
        requiredCapabilities: ['parallel_processing'],
        resourceNeeds: { cpu: 0.4, memory: 128 * 1024 * 1024 }
      }
    ];
    
    rootTask.estimatedDuration = 120;
    return rootTask;
  }
}

/**
 * Sequential Decomposition Strategy
 */
class SequentialDecompositionStrategy extends DecompositionStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('SequentialStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    this.logger.info(`Decomposing goal ${goal.id} using sequential strategy`);
    
    // Create root task (implementation would be similar to HierarchicalDecompositionStrategy
    // but optimized for sequential execution)
    const rootTask = {
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: goal.description,
      type: 'compound',
      subtasks: [],
      estimatedDuration: 0,
      requiredCapabilities: [],
      resourceNeeds: { cpu: 0.1, memory: 64 * 1024 * 1024 }
    };
    
    // Basic implementation for now
    rootTask.subtasks = [
      {
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: `Sequential processing for: ${goal.description}`,
        type: 'primitive',
        subtasks: [],
        estimatedDuration: 180,
        requiredCapabilities: ['sequential_processing'],
        resourceNeeds: { cpu: 0.2, memory: 64 * 1024 * 1024 }
      }
    ];
    
    rootTask.estimatedDuration = 180;
    return rootTask;
  }
}

/**
 * Monte Carlo Decomposition Strategy
 */
class MonteCarloDecompositionStrategy extends DecompositionStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('MonteCarloStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    this.logger.info(`Decomposing goal ${goal.id} using Monte Carlo strategy`);
    
    // Create root task (implementation would use Monte Carlo Tree Search
    // to explore alternative decomposition strategies)
    const rootTask = {
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: goal.description,
      type: 'compound',
      subtasks: [],
      estimatedDuration: 0,
      requiredCapabilities: [],
      resourceNeeds: { cpu: 0.3, memory: 128 * 1024 * 1024 }
    };
    
    // Basic implementation for now
    rootTask.subtasks = [
      {
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: `Monte Carlo exploration for: ${goal.description}`,
        type: 'primitive',
        subtasks: [],
        estimatedDuration: 240,
        requiredCapabilities: ['monte_carlo_search'],
        resourceNeeds: { cpu: 0.5, memory: 256 * 1024 * 1024 }
      }
    ];
    
    rootTask.estimatedDuration = 240;
    return rootTask;
  }
}

/**
 * Recursive Decomposition Strategy
 */
class RecursiveDecompositionStrategy extends DecompositionStrategy {
  constructor() {
    super();
    this.logger = new (require('./enhanced_orchestration_foundation').EOTLogger)('RecursiveStrategy');
  }
  
  async decompose(goal, context, modelEnsemble) {
    this.logger.info(`Decomposing goal ${goal.id} using recursive strategy`);
    
    // Create root task (implementation would use recursive decomposition
    // with dynamic depth based on complexity)
    const rootTask = {
      taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: goal.description,
      type: 'compound',
      subtasks: [],
      estimatedDuration: 0,
      requiredCapabilities: [],
      resourceNeeds: { cpu: 0.2, memory: 96 * 1024 * 1024 }
    };
    
    // Basic implementation for now
    rootTask.subtasks = [
      {
        taskId: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: `Recursive processing for: ${goal.description}`,
        type: 'primitive',
        subtasks: [],
        estimatedDuration: 200,
        requiredCapabilities: ['recursive_processing'],
        resourceNeeds: { cpu: 0.3, memory: 128 * 1024 * 1024 }
      }
    ];
    
    rootTask.estimatedDuration = 200;
    return rootTask;
  }
}

// Export the Task Decomposer and related classes
module.exports = {
  IntelligentTaskDecomposer,
  TaskComplexityAnalyzer,
  DecompositionStrategy,
  HierarchicalDecompositionStrategy,
  ParallelDecompositionStrategy,
  SequentialDecompositionStrategy,
  MonteCarloDecompositionStrategy,
  RecursiveDecompositionStrategy
};
