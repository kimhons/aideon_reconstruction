/**
 * @fileoverview Project Management Decision Framework for the Decision Intelligence Tentacle
 * 
 * This framework provides specialized decision support for project management domains,
 * including resource allocation, risk management, schedule optimization, stakeholder
 * analysis, and project selection.
 */

const { Logger } = require('../../../../core/logging/Logger');
const { EventEmitter } = require('../../../../core/events/EventEmitter');

/**
 * Project Management Decision Framework for project management decision support
 */
class ProjectManagementDecisionFramework {
  /**
   * Creates a new instance of the Project Management Decision Framework
   * @param {Object} aideon Reference to the Aideon core system
   * @param {Object} config Configuration options
   */
  constructor(aideon, config = {}) {
    this.id = 'project_management';
    this.name = 'Project Management Decision Framework';
    this.version = '1.0.0';
    this.author = 'Aideon';
    this.category = 'project_management';
    this.tags = ['project', 'management', 'resource', 'schedule', 'risk'];
    
    this.aideon = aideon;
    this.logger = new Logger('ProjectManagementDecisionFramework');
    this.events = new EventEmitter();
    this.initialized = false;
    
    // Configuration
    this.config = {
      riskTolerance: config.riskTolerance || 0.5, // 0-1 scale, higher means more risk-tolerant
      resourceOptimizationStrategy: config.resourceOptimizationStrategy || 'balanced', // 'cost', 'time', 'quality', 'balanced'
      stakeholderWeightStrategy: config.stakeholderWeightStrategy || 'influence', // 'influence', 'interest', 'power', 'balanced'
      scheduleOptimizationPriority: config.scheduleOptimizationPriority || 'balanced', // 'speed', 'flexibility', 'resource_efficiency', 'balanced'
      ...config
    };
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.evaluateOptions = this.evaluateOptions.bind(this);
    this.getStatus = this.getStatus.bind(this);
  }
  
  /**
   * Initializes the Project Management Decision Framework
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize() {
    if (this.initialized) {
      this.logger.info('Already initialized');
      return;
    }
    
    this.logger.info('Initializing Project Management Decision Framework');
    
    try {
      // Load configuration
      await this._loadConfiguration();
      
      // Initialize components
      this.resourceAllocator = this._createResourceAllocator();
      this.riskManager = this._createRiskManager();
      this.scheduleOptimizer = this._createScheduleOptimizer();
      this.stakeholderAnalyzer = this._createStakeholderAnalyzer();
      this.projectSelector = this._createProjectSelector();
      
      this.initialized = true;
      this.logger.info('Project Management Decision Framework initialized successfully');
      
      // Emit initialized event
      this.events.emit('initialized', { component: 'projectManagementDecisionFramework' });
    } catch (error) {
      this.logger.error('Initialization failed', error);
      throw error;
    }
  }
  
  /**
   * Loads configuration from the Aideon configuration system
   * @private
   * @returns {Promise<void>} A promise that resolves when configuration is loaded
   */
  async _loadConfiguration() {
    if (this.aideon && this.aideon.config) {
      const config = this.aideon.config.getNamespace('tentacles')?.getNamespace('decisionIntelligence')?.getNamespace('frameworks')?.getNamespace('projectManagement');
      
      if (config) {
        this.config.riskTolerance = config.get('riskTolerance') || this.config.riskTolerance;
        this.config.resourceOptimizationStrategy = config.get('resourceOptimizationStrategy') || this.config.resourceOptimizationStrategy;
        this.config.stakeholderWeightStrategy = config.get('stakeholderWeightStrategy') || this.config.stakeholderWeightStrategy;
        this.config.scheduleOptimizationPriority = config.get('scheduleOptimizationPriority') || this.config.scheduleOptimizationPriority;
      }
    }
    
    this.logger.info('Configuration loaded', { config: this.config });
  }
  
  /**
   * Creates a resource allocator based on configuration
   * @private
   * @returns {Object} Resource allocator
   */
  _createResourceAllocator() {
    this.logger.info('Creating resource allocator', { strategy: this.config.resourceOptimizationStrategy });
    
    return {
      /**
       * Allocates resources for project options
       * @param {Array<Object>} options Array of options to analyze
       * @param {Object} context Decision context
       * @returns {Object} Resource allocation results
       */
      allocateResources: (options, context) => {
        const results = {};
        
        for (const option of options) {
          // Get resource requirements
          const resourceRequirements = this._getResourceRequirements(option, context);
          
          // Get resource availability
          const resourceAvailability = this._getResourceAvailability(context);
          
          // Calculate resource allocation
          const resourceAllocation = this._calculateResourceAllocation(
            resourceRequirements,
            resourceAvailability,
            this.config.resourceOptimizationStrategy
          );
          
          // Calculate resource utilization
          const resourceUtilization = this._calculateResourceUtilization(resourceAllocation, resourceAvailability);
          
          // Calculate resource efficiency
          const resourceEfficiency = this._calculateResourceEfficiency(resourceAllocation, resourceRequirements);
          
          // Calculate resource cost
          const resourceCost = this._calculateResourceCost(resourceAllocation, context);
          
          results[option.id] = {
            allocation: resourceAllocation,
            utilization: resourceUtilization,
            efficiency: resourceEfficiency,
            cost: resourceCost,
            strategy: this.config.resourceOptimizationStrategy
          };
        }
        
        return results;
      }
    };
  }
  
  /**
   * Creates a risk manager
   * @private
   * @returns {Object} Risk manager
   */
  _createRiskManager() {
    this.logger.info('Creating risk manager', { riskTolerance: this.config.riskTolerance });
    
    return {
      /**
       * Manages risks for project options
       * @param {Array<Object>} options Array of options to analyze
       * @param {Object} context Decision context
       * @returns {Object} Risk management results
       */
      manageRisks: (options, context) => {
        const results = {};
        
        for (const option of options) {
          // Identify risks
          const risks = this._identifyRisks(option, context);
          
          // Assess risk impact
          const riskImpact = this._assessRiskImpact(risks, context);
          
          // Assess risk probability
          const riskProbability = this._assessRiskProbability(risks, context);
          
          // Calculate risk exposure
          const riskExposure = this._calculateRiskExposure(riskImpact, riskProbability);
          
          // Develop risk response strategies
          const riskResponses = this._developRiskResponses(
            risks,
            riskImpact,
            riskProbability,
            this.config.riskTolerance
          );
          
          // Calculate residual risk
          const residualRisk = this._calculateResidualRisk(riskExposure, riskResponses);
          
          results[option.id] = {
            risks,
            impact: riskImpact,
            probability: riskProbability,
            exposure: riskExposure,
            responses: riskResponses,
            residualRisk,
            riskTolerance: this.config.riskTolerance
          };
        }
        
        return results;
      }
    };
  }
  
  /**
   * Creates a schedule optimizer
   * @private
   * @returns {Object} Schedule optimizer
   */
  _createScheduleOptimizer() {
    this.logger.info('Creating schedule optimizer', { priority: this.config.scheduleOptimizationPriority });
    
    return {
      /**
       * Optimizes schedules for project options
       * @param {Array<Object>} options Array of options to analyze
       * @param {Object} context Decision context
       * @returns {Object} Schedule optimization results
       */
      optimizeSchedule: (options, context) => {
        const results = {};
        
        for (const option of options) {
          // Get tasks
          const tasks = this._getTasks(option, context);
          
          // Get dependencies
          const dependencies = this._getDependencies(option, context);
          
          // Get milestones
          const milestones = this._getMilestones(option, context);
          
          // Calculate critical path
          const criticalPath = this._calculateCriticalPath(tasks, dependencies);
          
          // Optimize schedule
          const optimizedSchedule = this._optimizeSchedule(
            tasks,
            dependencies,
            milestones,
            criticalPath,
            this.config.scheduleOptimizationPriority
          );
          
          // Calculate schedule metrics
          const scheduleMetrics = this._calculateScheduleMetrics(optimizedSchedule, criticalPath);
          
          results[option.id] = {
            schedule: optimizedSchedule,
            criticalPath,
            metrics: scheduleMetrics,
            priority: this.config.scheduleOptimizationPriority
          };
        }
        
        return results;
      }
    };
  }
  
  /**
   * Creates a stakeholder analyzer
   * @private
   * @returns {Object} Stakeholder analyzer
   */
  _createStakeholderAnalyzer() {
    this.logger.info('Creating stakeholder analyzer', { weightStrategy: this.config.stakeholderWeightStrategy });
    
    return {
      /**
       * Analyzes stakeholders for project options
       * @param {Array<Object>} options Array of options to analyze
       * @param {Object} context Decision context
       * @returns {Object} Stakeholder analysis results
       */
      analyzeStakeholders: (options, context) => {
        const results = {};
        
        for (const option of options) {
          // Identify stakeholders
          const stakeholders = this._identifyStakeholders(option, context);
          
          // Assess stakeholder influence
          const stakeholderInfluence = this._assessStakeholderInfluence(stakeholders, context);
          
          // Assess stakeholder interest
          const stakeholderInterest = this._assessStakeholderInterest(stakeholders, option, context);
          
          // Calculate stakeholder power
          const stakeholderPower = this._calculateStakeholderPower(stakeholderInfluence, stakeholderInterest);
          
          // Calculate stakeholder weights
          const stakeholderWeights = this._calculateStakeholderWeights(
            stakeholderInfluence,
            stakeholderInterest,
            stakeholderPower,
            this.config.stakeholderWeightStrategy
          );
          
          // Calculate stakeholder satisfaction
          const stakeholderSatisfaction = this._calculateStakeholderSatisfaction(stakeholders, option, stakeholderWeights);
          
          results[option.id] = {
            stakeholders,
            influence: stakeholderInfluence,
            interest: stakeholderInterest,
            power: stakeholderPower,
            weights: stakeholderWeights,
            satisfaction: stakeholderSatisfaction,
            weightStrategy: this.config.stakeholderWeightStrategy
          };
        }
        
        return results;
      }
    };
  }
  
  /**
   * Creates a project selector
   * @private
   * @returns {Object} Project selector
   */
  _createProjectSelector() {
    this.logger.info('Creating project selector');
    
    return {
      /**
       * Selects projects from options
       * @param {Array<Object>} options Array of options to analyze
       * @param {Object} context Decision context
       * @returns {Object} Project selection results
       */
      selectProjects: (options, context) => {
        const results = {};
        
        // Calculate strategic alignment
        const strategicAlignment = this._calculateStrategicAlignment(options, context);
        
        // Calculate return on investment
        const returnOnInvestment = this._calculateReturnOnInvestment(options, context);
        
        // Calculate resource constraints
        const resourceConstraints = this._calculateResourceConstraints(options, context);
        
        // Calculate project interdependencies
        const projectInterdependencies = this._calculateProjectInterdependencies(options, context);
        
        // Calculate project scores
        const projectScores = this._calculateProjectScores(
          strategicAlignment,
          returnOnInvestment,
          resourceConstraints,
          projectInterdependencies,
          context
        );
        
        // Optimize project portfolio
        const optimizedPortfolio = this._optimizeProjectPortfolio(
          options,
          projectScores,
          resourceConstraints,
          projectInterdependencies,
          context
        );
        
        for (const option of options) {
          results[option.id] = {
            strategicAlignment: strategicAlignment[option.id],
            returnOnInvestment: returnOnInvestment[option.id],
            resourceConstraints: resourceConstraints[option.id],
            interdependencies: projectInterdependencies[option.id],
            score: projectScores[option.id],
            inOptimalPortfolio: optimizedPortfolio.includes(option.id)
          };
        }
        
        return {
          projectScores: results,
          optimizedPortfolio
        };
      }
    };
  }
  
  /**
   * Gets resource requirements for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Object} Resource requirements
   */
  _getResourceRequirements(option, context) {
    try {
      // Use provided resource requirements if available
      if (option.resourceRequirements) {
        return option.resourceRequirements;
      }
      
      // Use tasks to determine resource requirements
      const tasks = this._getTasks(option, context);
      
      if (tasks.length === 0) {
        return {
          human: {},
          financial: {},
          material: {},
          total: {
            humanHours: 0,
            cost: 0
          }
        };
      }
      
      // Calculate human resource requirements
      const humanResources = {};
      let totalHumanHours = 0;
      
      for (const task of tasks) {
        if (task.resources && task.resources.human) {
          for (const [role, hours] of Object.entries(task.resources.human)) {
            humanResources[role] = (humanResources[role] || 0) + hours;
            totalHumanHours += hours;
          }
        }
      }
      
      // Calculate financial resource requirements
      const financialResources = {};
      let totalFinancialCost = 0;
      
      for (const task of tasks) {
        if (task.resources && task.resources.financial) {
          for (const [category, cost] of Object.entries(task.resources.financial)) {
            financialResources[category] = (financialResources[category] || 0) + cost;
            totalFinancialCost += cost;
          }
        }
      }
      
      // Calculate material resource requirements
      const materialResources = {};
      
      for (const task of tasks) {
        if (task.resources && task.resources.material) {
          for (const [item, quantity] of Object.entries(task.resources.material)) {
            materialResources[item] = (materialResources[item] || 0) + quantity;
          }
        }
      }
      
      return {
        human: humanResources,
        financial: financialResources,
        material: materialResources,
        total: {
          humanHours: totalHumanHours,
          cost: totalFinancialCost
        }
      };
    } catch (error) {
      this.logger.error('Error getting resource requirements', error);
      
      return {
        human: {},
        financial: {},
        material: {},
        total: {
          humanHours: 0,
          cost: 0
        }
      };
    }
  }
  
  /**
   * Gets resource availability from context
   * @private
   * @param {Object} context Decision context
   * @returns {Object} Resource availability
   */
  _getResourceAvailability(context) {
    try {
      // Use provided resource availability if available
      if (context.resourceAvailability) {
        return context.resourceAvailability;
      }
      
      // Default resource availability
      return {
        human: {},
        financial: {
          budget: 100000
        },
        material: {}
      };
    } catch (error) {
      this.logger.error('Error getting resource availability', error);
      
      return {
        human: {},
        financial: {
          budget: 100000
        },
        material: {}
      };
    }
  }
  
  /**
   * Calculates resource allocation
   * @private
   * @param {Object} requirements Resource requirements
   * @param {Object} availability Resource availability
   * @param {string} strategy Resource optimization strategy
   * @returns {Object} Resource allocation
   */
  _calculateResourceAllocation(requirements, availability, strategy) {
    try {
      const allocation = {
        human: {},
        financial: {},
        material: {}
      };
      
      // Allocate human resources
      for (const [role, requiredHours] of Object.entries(requirements.human)) {
        const availableHours = availability.human[role] || 0;
        
        let allocatedHours = 0;
        
        switch (strategy) {
          case 'cost':
            // Minimize allocation to reduce cost
            allocatedHours = Math.min(requiredHours, availableHours * 0.8);
            break;
          case 'time':
            // Maximize allocation to reduce time
            allocatedHours = Math.min(requiredHours * 1.2, availableHours);
            break;
          case 'quality':
            // Allocate more than required to ensure quality
            allocatedHours = Math.min(requiredHours * 1.1, availableHours);
            break;
          case 'balanced':
          default:
            // Allocate exactly what's required if available
            allocatedHours = Math.min(requiredHours, availableHours);
        }
        
        allocation.human[role] = allocatedHours;
      }
      
      // Allocate financial resources
      for (const [category, requiredCost] of Object.entries(requirements.financial)) {
        const availableCost = availability.financial[category] || 
                             (category === 'budget' ? 0 : availability.financial.budget || 0);
        
        let allocatedCost = 0;
        
        switch (strategy) {
          case 'cost':
            // Minimize allocation to reduce cost
            allocatedCost = requiredCost * 0.9;
            break;
          case 'time':
          case 'quality':
            // Allocate more than required to ensure quality or reduce time
            allocatedCost = Math.min(requiredCost * 1.1, availableCost);
            break;
          case 'balanced':
          default:
            // Allocate exactly what's required if available
            allocatedCost = Math.min(requiredCost, availableCost);
        }
        
        allocation.financial[category] = allocatedCost;
      }
      
      // Allocate material resources
      for (const [item, requiredQuantity] of Object.entries(requirements.material)) {
        const availableQuantity = availability.material[item] || 0;
        
        let allocatedQuantity = 0;
        
        switch (strategy) {
          case 'cost':
            // Minimize allocation to reduce cost
            allocatedQuantity = Math.min(requiredQuantity, availableQuantity * 0.9);
            break;
          case 'time':
          case 'quality':
            // Allocate more than required to ensure quality or reduce time
            allocatedQuantity = Math.min(requiredQuantity * 1.1, availableQuantity);
            break;
          case 'balanced':
          default:
            // Allocate exactly what's required if available
            allocatedQuantity = Math.min(requiredQuantity, availableQuantity);
        }
        
        allocation.material[item] = allocatedQuantity;
      }
      
      return allocation;
    } catch (error) {
      this.logger.error('Error calculating resource allocation', error);
      
      return {
        human: {},
        financial: {},
        material: {}
      };
    }
  }
  
  /**
   * Calculates resource utilization
   * @private
   * @param {Object} allocation Resource allocation
   * @param {Object} availability Resource availability
   * @returns {Object} Resource utilization
   */
  _calculateResourceUtilization(allocation, availability) {
    try {
      const utilization = {
        human: {},
        financial: {},
        material: {},
        overall: 0
      };
      
      // Calculate human resource utilization
      let totalHumanUtilization = 0;
      let humanResourceCount = 0;
      
      for (const [role, allocatedHours] of Object.entries(allocation.human)) {
        const availableHours = availability.human[role] || 0;
        
        if (availableHours > 0) {
          utilization.human[role] = allocatedHours / availableHours;
          totalHumanUtilization += utilization.human[role];
          humanResourceCount++;
        } else {
          utilization.human[role] = 0;
        }
      }
      
      // Calculate financial resource utilization
      let totalFinancialUtilization = 0;
      let financialResourceCount = 0;
      
      for (const [category, allocatedCost] of Object.entries(allocation.financial)) {
        const availableCost = availability.financial[category] || 
                             (category === 'budget' ? 0 : availability.financial.budget || 0);
        
        if (availableCost > 0) {
          utilization.financial[category] = allocatedCost / availableCost;
          totalFinancialUtilization += utilization.financial[category];
          financialResourceCount++;
        } else {
          utilization.financial[category] = 0;
        }
      }
      
      // Calculate material resource utilization
      let totalMaterialUtilization = 0;
      let materialResourceCount = 0;
      
      for (const [item, allocatedQuantity] of Object.entries(allocation.material)) {
        const availableQuantity = availability.material[item] || 0;
        
        if (availableQuantity > 0) {
          utilization.material[item] = allocatedQuantity / availableQuantity;
          totalMaterialUtilization += utilization.material[item];
          materialResourceCount++;
        } else {
          utilization.material[item] = 0;
        }
      }
      
      // Calculate overall utilization
      const avgHumanUtilization = humanResourceCount > 0 ? totalHumanUtilization / humanResourceCount : 0;
      const avgFinancialUtilization = financialResourceCount > 0 ? totalFinancialUtilization / financialResourceCount : 0;
      const avgMaterialUtilization = materialResourceCount > 0 ? totalMaterialUtilization / materialResourceCount : 0;
      
      const resourceTypeCount = (humanResourceCount > 0 ? 1 : 0) + 
                               (financialResourceCount > 0 ? 1 : 0) + 
                               (materialResourceCount > 0 ? 1 : 0);
      
      utilization.overall = resourceTypeCount > 0 ? 
        (avgHumanUtilization + avgFinancialUtilization + avgMaterialUtilization) / resourceTypeCount : 0;
      
      return utilization;
    } catch (error) {
      this.logger.error('Error calculating resource utilization', error);
      
      return {
        human: {},
        financial: {},
        material: {},
        overall: 0
      };
    }
  }
  
  /**
   * Calculates resource efficiency
   * @private
   * @param {Object} allocation Resource allocation
   * @param {Object} requirements Resource requirements
   * @returns {Object} Resource efficiency
   */
  _calculateResourceEfficiency(allocation, requirements) {
    try {
      const efficiency = {
        human: {},
        financial: {},
        material: {},
        overall: 0
      };
      
      // Calculate human resource efficiency
      let totalHumanEfficiency = 0;
      let humanResourceCount = 0;
      
      for (const [role, allocatedHours] of Object.entries(allocation.human)) {
        const requiredHours = requirements.human[role] || 0;
        
        if (requiredHours > 0) {
          // Efficiency is optimal at 1.0 (allocated = required)
          // Less than 1.0 means under-allocation, more than 1.0 means over-allocation
          const ratio = allocatedHours / requiredHours;
          
          // Convert to efficiency score (0-1 scale, with 1 being optimal)
          efficiency.human[role] = ratio <= 1 ? ratio : 1 / ratio;
          
          totalHumanEfficiency += efficiency.human[role];
          humanResourceCount++;
        } else {
          efficiency.human[role] = 0;
        }
      }
      
      // Calculate financial resource efficiency
      let totalFinancialEfficiency = 0;
      let financialResourceCount = 0;
      
      for (const [category, allocatedCost] of Object.entries(allocation.financial)) {
        const requiredCost = requirements.financial[category] || 0;
        
        if (requiredCost > 0) {
          // Efficiency is optimal at 1.0 (allocated = required)
          // Less than 1.0 means under-allocation, more than 1.0 means over-allocation
          const ratio = allocatedCost / requiredCost;
          
          // Convert to efficiency score (0-1 scale, with 1 being optimal)
          efficiency.financial[category] = ratio <= 1 ? ratio : 1 / ratio;
          
          totalFinancialEfficiency += efficiency.financial[category];
          financialResourceCount++;
        } else {
          efficiency.financial[category] = 0;
        }
      }
      
      // Calculate material resource efficiency
      let totalMaterialEfficiency = 0;
      let materialResourceCount = 0;
      
      for (const [item, allocatedQuantity] of Object.entries(allocation.material)) {
        const requiredQuantity = requirements.material[item] || 0;
        
        if (requiredQuantity > 0) {
          // Efficiency is optimal at 1.0 (allocated = required)
          // Less than 1.0 means under-allocation, more than 1.0 means over-allocation
          const ratio = allocatedQuantity / requiredQuantity;
          
          // Convert to efficiency score (0-1 scale, with 1 being optimal)
          efficiency.material[item] = ratio <= 1 ? ratio : 1 / ratio;
          
          totalMaterialEfficiency += efficiency.material[item];
          materialResourceCount++;
        } else {
          efficiency.material[item] = 0;
        }
      }
      
      // Calculate overall efficiency
      const avgHumanEfficiency = humanResourceCount > 0 ? totalHumanEfficiency / humanResourceCount : 0;
      const avgFinancialEfficiency = financialResourceCount > 0 ? totalFinancialEfficiency / financialResourceCount : 0;
      const avgMaterialEfficiency = materialResourceCount > 0 ? totalMaterialEfficiency / materialResourceCount : 0;
      
      const resourceTypeCount = (humanResourceCount > 0 ? 1 : 0) + 
                               (financialResourceCount > 0 ? 1 : 0) + 
                               (materialResourceCount > 0 ? 1 : 0);
      
      efficiency.overall = resourceTypeCount > 0 ? 
        (avgHumanEfficiency + avgFinancialEfficiency + avgMaterialEfficiency) / resourceTypeCount : 0;
      
      return efficiency;
    } catch (error) {
      this.logger.error('Error calculating resource efficiency', error);
      
      return {
        human: {},
        financial: {},
        material: {},
        overall: 0
      };
    }
  }
  
  /**
   * Calculates resource cost
   * @private
   * @param {Object} allocation Resource allocation
   * @param {Object} context Decision context
   * @returns {Object} Resource cost
   */
  _calculateResourceCost(allocation, context) {
    try {
      const cost = {
        human: 0,
        financial: 0,
        material: 0,
        total: 0
      };
      
      // Get resource rates from context
      const resourceRates = context.resourceRates || {
        human: {},
        material: {}
      };
      
      // Calculate human resource cost
      for (const [role, allocatedHours] of Object.entries(allocation.human)) {
        const hourlyRate = resourceRates.human[role] || 50; // Default hourly rate
        const roleCost = allocatedHours * hourlyRate;
        
        cost.human += roleCost;
      }
      
      // Calculate financial resource cost (direct costs)
      for (const [category, allocatedCost] of Object.entries(allocation.financial)) {
        cost.financial += allocatedCost;
      }
      
      // Calculate material resource cost
      for (const [item, allocatedQuantity] of Object.entries(allocation.material)) {
        const unitCost = resourceRates.material[item] || 1; // Default unit cost
        const itemCost = allocatedQuantity * unitCost;
        
        cost.material += itemCost;
      }
      
      // Calculate total cost
      cost.total = cost.human + cost.financial + cost.material;
      
      return cost;
    } catch (error) {
      this.logger.error('Error calculating resource cost', error);
      
      return {
        human: 0,
        financial: 0,
        material: 0,
        total: 0
      };
    }
  }
  
  /**
   * Identifies risks for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Array<Object>} Identified risks
   */
  _identifyRisks(option, context) {
    try {
      // Use provided risks if available
      if (option.risks) {
        return option.risks;
      }
      
      // Generate risks based on option characteristics
      const risks = [];
      
      // Get resource requirements
      const resourceRequirements = this._getResourceRequirements(option, context);
      
      // Get resource availability
      const resourceAvailability = this._getResourceAvailability(context);
      
      // Check for resource risks
      for (const [role, requiredHours] of Object.entries(resourceRequirements.human)) {
        const availableHours = resourceAvailability.human[role] || 0;
        
        if (requiredHours > availableHours) {
          risks.push({
            id: `resource_shortage_${role}`,
            category: 'resource',
            description: `Shortage of ${role} resources`,
            source: 'internal'
          });
        }
      }
      
      // Check for budget risks
      const totalCost = resourceRequirements.total.cost;
      const availableBudget = resourceAvailability.financial.budget || 0;
      
      if (totalCost > availableBudget) {
        risks.push({
          id: 'budget_overrun',
          category: 'financial',
          description: 'Project budget overrun',
          source: 'internal'
        });
      }
      
      // Check for schedule risks
      const tasks = this._getTasks(option, context);
      const dependencies = this._getDependencies(option, context);
      
      if (tasks.length > 0) {
        // Check for tight deadlines
        const criticalPath = this._calculateCriticalPath(tasks, dependencies);
        const projectDuration = criticalPath.duration;
        const deadline = option.deadline || context.deadline;
        
        if (deadline && projectDuration > deadline) {
          risks.push({
            id: 'schedule_overrun',
            category: 'schedule',
            description: 'Project schedule overrun',
            source: 'internal'
          });
        }
        
        // Check for complex dependencies
        const complexityThreshold = 0.5; // Threshold for dependency complexity
        const dependencyComplexity = this._calculateDependencyComplexity(tasks, dependencies);
        
        if (dependencyComplexity > complexityThreshold) {
          risks.push({
            id: 'complex_dependencies',
            category: 'schedule',
            description: 'Complex task dependencies',
            source: 'internal'
          });
        }
      }
      
      // Check for stakeholder risks
      const stakeholders = this._identifyStakeholders(option, context);
      
      if (stakeholders.length > 0) {
        // Check for stakeholder alignment
        const stakeholderAlignment = this._calculateStakeholderAlignment(stakeholders, option);
        
        if (stakeholderAlignment < 0.6) { // Threshold for stakeholder alignment
          risks.push({
            id: 'stakeholder_misalignment',
            category: 'stakeholder',
            description: 'Stakeholder misalignment',
            source: 'external'
          });
        }
      }
      
      // Add generic risks
      risks.push({
        id: 'scope_creep',
        category: 'scope',
        description: 'Scope creep',
        source: 'internal'
      });
      
      risks.push({
        id: 'quality_issues',
        category: 'quality',
        description: 'Quality issues',
        source: 'internal'
      });
      
      risks.push({
        id: 'external_factors',
        category: 'external',
        description: 'External factors',
        source: 'external'
      });
      
      return risks;
    } catch (error) {
      this.logger.error('Error identifying risks', error);
      
      return [
        {
          id: 'generic_risk',
          category: 'general',
          description: 'Generic project risk',
          source: 'internal'
        }
      ];
    }
  }
  
  /**
   * Calculates dependency complexity
   * @private
   * @param {Array<Object>} tasks Tasks
   * @param {Array<Object>} dependencies Dependencies
   * @returns {number} Dependency complexity
   */
  _calculateDependencyComplexity(tasks, dependencies) {
    try {
      if (tasks.length <= 1 || dependencies.length === 0) {
        return 0;
      }
      
      // Calculate maximum possible dependencies
      const maxDependencies = tasks.length * (tasks.length - 1) / 2;
      
      // Calculate dependency ratio
      const dependencyRatio = dependencies.length / maxDependencies;
      
      // Calculate dependency depth
      let maxDepth = 0;
      
      for (const task of tasks) {
        const depth = this._calculateTaskDependencyDepth(task.id, dependencies, 0);
        maxDepth = Math.max(maxDepth, depth);
      }
      
      // Normalize depth (assuming max reasonable depth is 10)
      const normalizedDepth = Math.min(maxDepth / 10, 1);
      
      // Calculate overall complexity
      const complexity = (dependencyRatio * 0.5) + (normalizedDepth * 0.5);
      
      return complexity;
    } catch (error) {
      this.logger.error('Error calculating dependency complexity', error);
      return 0.5;
    }
  }
  
  /**
   * Calculates task dependency depth
   * @private
   * @param {string} taskId Task ID
   * @param {Array<Object>} dependencies Dependencies
   * @param {number} currentDepth Current depth
   * @returns {number} Task dependency depth
   */
  _calculateTaskDependencyDepth(taskId, dependencies, currentDepth) {
    try {
      // Find dependencies where this task is the successor
      const taskDependencies = dependencies.filter(dep => dep.successor === taskId);
      
      if (taskDependencies.length === 0) {
        return currentDepth;
      }
      
      let maxDepth = currentDepth;
      
      for (const dependency of taskDependencies) {
        const predecessorDepth = this._calculateTaskDependencyDepth(
          dependency.predecessor,
          dependencies,
          currentDepth + 1
        );
        
        maxDepth = Math.max(maxDepth, predecessorDepth);
      }
      
      return maxDepth;
    } catch (error) {
      this.logger.error('Error calculating task dependency depth', error);
      return currentDepth;
    }
  }
  
  /**
   * Calculates stakeholder alignment
   * @private
   * @param {Array<Object>} stakeholders Stakeholders
   * @param {Object} option Option to analyze
   * @returns {number} Stakeholder alignment
   */
  _calculateStakeholderAlignment(stakeholders, option) {
    try {
      if (stakeholders.length === 0) {
        return 1;
      }
      
      let totalAlignment = 0;
      
      for (const stakeholder of stakeholders) {
        // Use provided alignment if available
        if (stakeholder.alignment !== undefined) {
          totalAlignment += stakeholder.alignment;
          continue;
        }
        
        // Calculate alignment based on interests and option characteristics
        let alignment = 0.5; // Default neutral alignment
        
        if (stakeholder.interests) {
          let interestAlignment = 0;
          let interestCount = 0;
          
          for (const [interest, importance] of Object.entries(stakeholder.interests)) {
            // Check if option addresses this interest
            const interestScore = option[interest] || 0.5;
            
            interestAlignment += interestScore * importance;
            interestCount += importance;
          }
          
          if (interestCount > 0) {
            alignment = interestAlignment / interestCount;
          }
        }
        
        totalAlignment += alignment;
      }
      
      return totalAlignment / stakeholders.length;
    } catch (error) {
      this.logger.error('Error calculating stakeholder alignment', error);
      return 0.5;
    }
  }
  
  /**
   * Assesses risk impact
   * @private
   * @param {Array<Object>} risks Risks
   * @param {Object} context Decision context
   * @returns {Object} Risk impact assessment
   */
  _assessRiskImpact(risks, context) {
    try {
      const impact = {};
      
      for (const risk of risks) {
        // Use provided impact if available
        if (risk.impact !== undefined) {
          impact[risk.id] = risk.impact;
          continue;
        }
        
        // Calculate impact based on risk category and context
        let impactScore = 0.5; // Default medium impact
        
        switch (risk.category) {
          case 'resource':
            impactScore = 0.6; // Medium-high impact
            break;
          case 'financial':
            impactScore = 0.7; // High impact
            break;
          case 'schedule':
            impactScore = 0.6; // Medium-high impact
            break;
          case 'scope':
            impactScore = 0.5; // Medium impact
            break;
          case 'quality':
            impactScore = 0.6; // Medium-high impact
            break;
          case 'stakeholder':
            impactScore = 0.5; // Medium impact
            break;
          case 'external':
            impactScore = 0.4; // Medium-low impact
            break;
          default:
            impactScore = 0.5; // Medium impact
        }
        
        // Adjust impact based on project characteristics
        if (context.projectSize === 'large') {
          impactScore *= 1.2;
        } else if (context.projectSize === 'small') {
          impactScore *= 0.8;
        }
        
        if (context.projectComplexity === 'high') {
          impactScore *= 1.2;
        } else if (context.projectComplexity === 'low') {
          impactScore *= 0.8;
        }
        
        // Ensure impact is between 0 and 1
        impactScore = Math.max(0, Math.min(1, impactScore));
        
        impact[risk.id] = impactScore;
      }
      
      return impact;
    } catch (error) {
      this.logger.error('Error assessing risk impact', error);
      
      const impact = {};
      
      for (const risk of risks) {
        impact[risk.id] = 0.5; // Default medium impact
      }
      
      return impact;
    }
  }
  
  /**
   * Assesses risk probability
   * @private
   * @param {Array<Object>} risks Risks
   * @param {Object} context Decision context
   * @returns {Object} Risk probability assessment
   */
  _assessRiskProbability(risks, context) {
    try {
      const probability = {};
      
      for (const risk of risks) {
        // Use provided probability if available
        if (risk.probability !== undefined) {
          probability[risk.id] = risk.probability;
          continue;
        }
        
        // Calculate probability based on risk category and context
        let probabilityScore = 0.5; // Default medium probability
        
        switch (risk.category) {
          case 'resource':
            probabilityScore = 0.6; // Medium-high probability
            break;
          case 'financial':
            probabilityScore = 0.5; // Medium probability
            break;
          case 'schedule':
            probabilityScore = 0.7; // High probability
            break;
          case 'scope':
            probabilityScore = 0.7; // High probability
            break;
          case 'quality':
            probabilityScore = 0.5; // Medium probability
            break;
          case 'stakeholder':
            probabilityScore = 0.4; // Medium-low probability
            break;
          case 'external':
            probabilityScore = 0.3; // Low probability
            break;
          default:
            probabilityScore = 0.5; // Medium probability
        }
        
        // Adjust probability based on project characteristics
        if (context.projectSize === 'large') {
          probabilityScore *= 1.2;
        } else if (context.projectSize === 'small') {
          probabilityScore *= 0.8;
        }
        
        if (context.projectComplexity === 'high') {
          probabilityScore *= 1.2;
        } else if (context.projectComplexity === 'low') {
          probabilityScore *= 0.8;
        }
        
        // Adjust probability based on risk source
        if (risk.source === 'external') {
          probabilityScore *= 0.9; // External risks are slightly less likely
        }
        
        // Ensure probability is between 0 and 1
        probabilityScore = Math.max(0, Math.min(1, probabilityScore));
        
        probability[risk.id] = probabilityScore;
      }
      
      return probability;
    } catch (error) {
      this.logger.error('Error assessing risk probability', error);
      
      const probability = {};
      
      for (const risk of risks) {
        probability[risk.id] = 0.5; // Default medium probability
      }
      
      return probability;
    }
  }
  
  /**
   * Calculates risk exposure
   * @private
   * @param {Object} impact Risk impact
   * @param {Object} probability Risk probability
   * @returns {Object} Risk exposure
   */
  _calculateRiskExposure(impact, probability) {
    try {
      const exposure = {};
      
      for (const riskId of Object.keys(impact)) {
        if (probability[riskId] !== undefined) {
          exposure[riskId] = impact[riskId] * probability[riskId];
        }
      }
      
      return exposure;
    } catch (error) {
      this.logger.error('Error calculating risk exposure', error);
      
      const exposure = {};
      
      for (const riskId of Object.keys(impact)) {
        exposure[riskId] = 0.25; // Default medium-low exposure
      }
      
      return exposure;
    }
  }
  
  /**
   * Develops risk response strategies
   * @private
   * @param {Array<Object>} risks Risks
   * @param {Object} impact Risk impact
   * @param {Object} probability Risk probability
   * @param {number} riskTolerance Risk tolerance
   * @returns {Object} Risk response strategies
   */
  _developRiskResponses(risks, impact, probability, riskTolerance) {
    try {
      const responses = {};
      
      for (const risk of risks) {
        // Calculate exposure
        const exposure = impact[risk.id] * probability[risk.id];
        
        // Determine response strategy based on exposure and tolerance
        let strategy = 'accept';
        let effectivenessScore = 0;
        
        if (exposure > 0.6) {
          // High exposure
          if (riskTolerance < 0.3) {
            strategy = 'avoid';
            effectivenessScore = 0.9;
          } else if (riskTolerance < 0.7) {
            strategy = 'mitigate';
            effectivenessScore = 0.7;
          } else {
            strategy = 'transfer';
            effectivenessScore = 0.6;
          }
        } else if (exposure > 0.3) {
          // Medium exposure
          if (riskTolerance < 0.3) {
            strategy = 'mitigate';
            effectivenessScore = 0.7;
          } else if (riskTolerance < 0.7) {
            strategy = 'transfer';
            effectivenessScore = 0.6;
          } else {
            strategy = 'accept';
            effectivenessScore = 0.3;
          }
        } else {
          // Low exposure
          if (riskTolerance < 0.3) {
            strategy = 'mitigate';
            effectivenessScore = 0.7;
          } else {
            strategy = 'accept';
            effectivenessScore = 0.3;
          }
        }
        
        // Generate response actions based on strategy
        const actions = this._generateRiskResponseActions(risk, strategy);
        
        responses[risk.id] = {
          strategy,
          effectiveness: effectivenessScore,
          actions
        };
      }
      
      return responses;
    } catch (error) {
      this.logger.error('Error developing risk responses', error);
      
      const responses = {};
      
      for (const risk of risks) {
        responses[risk.id] = {
          strategy: 'accept',
          effectiveness: 0.3,
          actions: []
        };
      }
      
      return responses;
    }
  }
  
  /**
   * Generates risk response actions
   * @private
   * @param {Object} risk Risk
   * @param {string} strategy Response strategy
   * @returns {Array<string>} Response actions
   */
  _generateRiskResponseActions(risk, strategy) {
    try {
      const actions = [];
      
      switch (strategy) {
        case 'avoid':
          actions.push(`Redesign project to eliminate ${risk.category} risk`);
          actions.push(`Establish clear boundaries for ${risk.category} aspects`);
          actions.push(`Implement strict controls for ${risk.category} factors`);
          break;
        case 'mitigate':
          actions.push(`Develop contingency plans for ${risk.category} issues`);
          actions.push(`Implement monitoring system for ${risk.category} factors`);
          actions.push(`Allocate additional resources to ${risk.category} management`);
          break;
        case 'transfer':
          actions.push(`Outsource ${risk.category} components to specialized providers`);
          actions.push(`Obtain insurance for ${risk.category} risks`);
          actions.push(`Establish shared responsibility agreements for ${risk.category} aspects`);
          break;
        case 'accept':
          actions.push(`Document ${risk.category} risk in risk register`);
          actions.push(`Monitor ${risk.category} factors for changes`);
          actions.push(`Establish thresholds for ${risk.category} risk escalation`);
          break;
        default:
          actions.push(`Monitor ${risk.category} risk`);
      }
      
      return actions;
    } catch (error) {
      this.logger.error('Error generating risk response actions', error);
      return [`Monitor ${risk.category} risk`];
    }
  }
  
  /**
   * Calculates residual risk
   * @private
   * @param {Object} exposure Risk exposure
   * @param {Object} responses Risk responses
   * @returns {Object} Residual risk
   */
  _calculateResidualRisk(exposure, responses) {
    try {
      const residualRisk = {};
      
      for (const riskId of Object.keys(exposure)) {
        if (responses[riskId] !== undefined) {
          const responseEffectiveness = responses[riskId].effectiveness;
          
          // Calculate residual risk based on exposure and response effectiveness
          residualRisk[riskId] = exposure[riskId] * (1 - responseEffectiveness);
        } else {
          residualRisk[riskId] = exposure[riskId];
        }
      }
      
      // Calculate overall residual risk
      let totalResidualRisk = 0;
      
      for (const riskId of Object.keys(residualRisk)) {
        totalResidualRisk += residualRisk[riskId];
      }
      
      const overallResidualRisk = Object.keys(residualRisk).length > 0 ? 
        totalResidualRisk / Object.keys(residualRisk).length : 0;
      
      residualRisk.overall = overallResidualRisk;
      
      return residualRisk;
    } catch (error) {
      this.logger.error('Error calculating residual risk', error);
      
      const residualRisk = {};
      
      for (const riskId of Object.keys(exposure)) {
        residualRisk[riskId] = exposure[riskId] * 0.7; // Assume 30% risk reduction
      }
      
      residualRisk.overall = 0.3; // Default medium-low residual risk
      
      return residualRisk;
    }
  }
  
  /**
   * Gets tasks for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Array<Object>} Tasks
   */
  _getTasks(option, context) {
    try {
      // Use provided tasks if available
      if (option.tasks) {
        return option.tasks;
      }
      
      // Generate generic tasks
      return [
        {
          id: 'task1',
          name: 'Planning',
          duration: 5,
          resources: {
            human: {
              'project_manager': 40,
              'business_analyst': 20
            },
            financial: {
              'planning': 5000
            },
            material: {}
          }
        },
        {
          id: 'task2',
          name: 'Design',
          duration: 10,
          resources: {
            human: {
              'designer': 80,
              'subject_matter_expert': 20
            },
            financial: {
              'design': 10000
            },
            material: {}
          }
        },
        {
          id: 'task3',
          name: 'Implementation',
          duration: 20,
          resources: {
            human: {
              'developer': 160,
              'tester': 40
            },
            financial: {
              'implementation': 20000
            },
            material: {
              'equipment': 5
            }
          }
        },
        {
          id: 'task4',
          name: 'Testing',
          duration: 10,
          resources: {
            human: {
              'tester': 80,
              'quality_assurance': 40
            },
            financial: {
              'testing': 8000
            },
            material: {}
          }
        },
        {
          id: 'task5',
          name: 'Deployment',
          duration: 5,
          resources: {
            human: {
              'developer': 20,
              'operations': 40
            },
            financial: {
              'deployment': 7000
            },
            material: {}
          }
        }
      ];
    } catch (error) {
      this.logger.error('Error getting tasks', error);
      return [];
    }
  }
  
  /**
   * Gets dependencies for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Array<Object>} Dependencies
   */
  _getDependencies(option, context) {
    try {
      // Use provided dependencies if available
      if (option.dependencies) {
        return option.dependencies;
      }
      
      // Generate generic dependencies
      return [
        {
          predecessor: 'task1',
          successor: 'task2',
          type: 'finish_to_start',
          lag: 0
        },
        {
          predecessor: 'task2',
          successor: 'task3',
          type: 'finish_to_start',
          lag: 0
        },
        {
          predecessor: 'task3',
          successor: 'task4',
          type: 'finish_to_start',
          lag: 0
        },
        {
          predecessor: 'task4',
          successor: 'task5',
          type: 'finish_to_start',
          lag: 0
        }
      ];
    } catch (error) {
      this.logger.error('Error getting dependencies', error);
      return [];
    }
  }
  
  /**
   * Gets milestones for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Array<Object>} Milestones
   */
  _getMilestones(option, context) {
    try {
      // Use provided milestones if available
      if (option.milestones) {
        return option.milestones;
      }
      
      // Generate generic milestones
      return [
        {
          id: 'milestone1',
          name: 'Project Start',
          date: 0,
          linkedTasks: ['task1']
        },
        {
          id: 'milestone2',
          name: 'Design Approval',
          date: 15,
          linkedTasks: ['task2']
        },
        {
          id: 'milestone3',
          name: 'Implementation Complete',
          date: 35,
          linkedTasks: ['task3']
        },
        {
          id: 'milestone4',
          name: 'Testing Complete',
          date: 45,
          linkedTasks: ['task4']
        },
        {
          id: 'milestone5',
          name: 'Project Complete',
          date: 50,
          linkedTasks: ['task5']
        }
      ];
    } catch (error) {
      this.logger.error('Error getting milestones', error);
      return [];
    }
  }
  
  /**
   * Calculates critical path
   * @private
   * @param {Array<Object>} tasks Tasks
   * @param {Array<Object>} dependencies Dependencies
   * @returns {Object} Critical path
   */
  _calculateCriticalPath(tasks, dependencies) {
    try {
      if (tasks.length === 0) {
        return {
          path: [],
          duration: 0
        };
      }
      
      // Create task map for quick lookup
      const taskMap = {};
      
      for (const task of tasks) {
        taskMap[task.id] = task;
      }
      
      // Calculate early start and early finish for each task
      const earlyStart = {};
      const earlyFinish = {};
      
      // Initialize early start and early finish for tasks with no predecessors
      for (const task of tasks) {
        const hasPredecessor = dependencies.some(dep => dep.successor === task.id);
        
        if (!hasPredecessor) {
          earlyStart[task.id] = 0;
          earlyFinish[task.id] = task.duration;
        }
      }
      
      // Calculate early start and early finish for all tasks
      let updated = true;
      
      while (updated) {
        updated = false;
        
        for (const dependency of dependencies) {
          const predecessorId = dependency.predecessor;
          const successorId = dependency.successor;
          
          if (earlyFinish[predecessorId] !== undefined && earlyStart[successorId] === undefined) {
            earlyStart[successorId] = earlyFinish[predecessorId] + (dependency.lag || 0);
            earlyFinish[successorId] = earlyStart[successorId] + taskMap[successorId].duration;
            updated = true;
          }
        }
      }
      
      // Calculate late start and late finish for each task
      const lateStart = {};
      const lateFinish = {};
      
      // Find project end time
      let projectEndTime = 0;
      
      for (const taskId of Object.keys(earlyFinish)) {
        projectEndTime = Math.max(projectEndTime, earlyFinish[taskId]);
      }
      
      // Initialize late start and late finish for tasks with no successors
      for (const task of tasks) {
        const hasSuccessor = dependencies.some(dep => dep.predecessor === task.id);
        
        if (!hasSuccessor) {
          lateFinish[task.id] = projectEndTime;
          lateStart[task.id] = lateFinish[task.id] - task.duration;
        }
      }
      
      // Calculate late start and late finish for all tasks
      updated = true;
      
      while (updated) {
        updated = false;
        
        for (const dependency of dependencies) {
          const predecessorId = dependency.predecessor;
          const successorId = dependency.successor;
          
          if (lateStart[successorId] !== undefined && lateFinish[predecessorId] === undefined) {
            lateFinish[predecessorId] = lateStart[successorId] - (dependency.lag || 0);
            lateStart[predecessorId] = lateFinish[predecessorId] - taskMap[predecessorId].duration;
            updated = true;
          }
        }
      }
      
      // Calculate slack for each task
      const slack = {};
      
      for (const taskId of Object.keys(earlyStart)) {
        slack[taskId] = lateStart[taskId] - earlyStart[taskId];
      }
      
      // Identify critical path (tasks with zero slack)
      const criticalPathTasks = [];
      
      for (const taskId of Object.keys(slack)) {
        if (slack[taskId] === 0) {
          criticalPathTasks.push(taskId);
        }
      }
      
      // Order critical path tasks
      const orderedCriticalPath = [];
      let currentTaskId = criticalPathTasks.find(taskId => {
        return !dependencies.some(dep => dep.successor === taskId && criticalPathTasks.includes(dep.predecessor));
      });
      
      while (currentTaskId) {
        orderedCriticalPath.push(currentTaskId);
        
        const nextDependency = dependencies.find(dep => {
          return dep.predecessor === currentTaskId && criticalPathTasks.includes(dep.successor);
        });
        
        currentTaskId = nextDependency ? nextDependency.successor : null;
      }
      
      return {
        path: orderedCriticalPath,
        duration: projectEndTime,
        taskDetails: tasks.filter(task => criticalPathTasks.includes(task.id))
      };
    } catch (error) {
      this.logger.error('Error calculating critical path', error);
      
      return {
        path: [],
        duration: 0
      };
    }
  }
  
  /**
   * Optimizes schedule
   * @private
   * @param {Array<Object>} tasks Tasks
   * @param {Array<Object>} dependencies Dependencies
   * @param {Array<Object>} milestones Milestones
   * @param {Object} criticalPath Critical path
   * @param {string} priority Schedule optimization priority
   * @returns {Object} Optimized schedule
   */
  _optimizeSchedule(tasks, dependencies, milestones, criticalPath, priority) {
    try {
      // Create a copy of tasks to avoid modifying the original
      const optimizedTasks = JSON.parse(JSON.stringify(tasks));
      
      // Optimize based on priority
      switch (priority) {
        case 'speed':
          // Reduce duration of critical path tasks
          for (const taskId of criticalPath.path) {
            const task = optimizedTasks.find(t => t.id === taskId);
            
            if (task) {
              // Reduce duration by 10%
              task.duration = Math.max(1, Math.floor(task.duration * 0.9));
              
              // Increase resources to compensate
              for (const [role, hours] of Object.entries(task.resources.human)) {
                task.resources.human[role] = Math.ceil(hours * 1.2);
              }
              
              // Increase financial resources
              for (const [category, cost] of Object.entries(task.resources.financial)) {
                task.resources.financial[category] = Math.ceil(cost * 1.2);
              }
            }
          }
          break;
        case 'flexibility':
          // Add buffers to non-critical tasks
          for (const task of optimizedTasks) {
            if (!criticalPath.path.includes(task.id)) {
              // Add 20% buffer
              task.buffer = Math.ceil(task.duration * 0.2);
            }
          }
          break;
        case 'resource_efficiency':
          // Optimize resource allocation
          for (const task of optimizedTasks) {
            // Reduce peak resource usage by extending duration for non-critical tasks
            if (!criticalPath.path.includes(task.id)) {
              // Extend duration by 20%
              const originalDuration = task.duration;
              task.duration = Math.ceil(task.duration * 1.2);
              
              // Reduce resources proportionally
              const resourceFactor = originalDuration / task.duration;
              
              for (const [role, hours] of Object.entries(task.resources.human)) {
                task.resources.human[role] = Math.ceil(hours * resourceFactor);
              }
            }
          }
          break;
        case 'balanced':
        default:
          // Apply moderate optimizations to all aspects
          for (const task of optimizedTasks) {
            if (criticalPath.path.includes(task.id)) {
              // Reduce critical path task durations by 5%
              task.duration = Math.max(1, Math.floor(task.duration * 0.95));
              
              // Increase resources by 10%
              for (const [role, hours] of Object.entries(task.resources.human)) {
                task.resources.human[role] = Math.ceil(hours * 1.1);
              }
            } else {
              // Add 10% buffer to non-critical tasks
              task.buffer = Math.ceil(task.duration * 0.1);
              
              // Optimize resource allocation
              const originalDuration = task.duration;
              task.duration = Math.ceil(task.duration * 1.1);
              
              // Reduce resources proportionally
              const resourceFactor = originalDuration / task.duration;
              
              for (const [role, hours] of Object.entries(task.resources.human)) {
                task.resources.human[role] = Math.ceil(hours * resourceFactor);
              }
            }
          }
      }
      
      // Recalculate schedule
      const schedule = this._calculateSchedule(optimizedTasks, dependencies);
      
      // Adjust milestones based on new schedule
      const optimizedMilestones = JSON.parse(JSON.stringify(milestones));
      
      for (const milestone of optimizedMilestones) {
        if (milestone.linkedTasks && milestone.linkedTasks.length > 0) {
          // Set milestone date to the finish date of the latest linked task
          let latestFinish = 0;
          
          for (const taskId of milestone.linkedTasks) {
            if (schedule.finish[taskId] !== undefined) {
              latestFinish = Math.max(latestFinish, schedule.finish[taskId]);
            }
          }
          
          milestone.date = latestFinish;
        }
      }
      
      return {
        tasks: optimizedTasks,
        dependencies,
        milestones: optimizedMilestones,
        schedule,
        priority
      };
    } catch (error) {
      this.logger.error('Error optimizing schedule', error);
      
      return {
        tasks,
        dependencies,
        milestones,
        schedule: this._calculateSchedule(tasks, dependencies),
        priority
      };
    }
  }
  
  /**
   * Calculates schedule
   * @private
   * @param {Array<Object>} tasks Tasks
   * @param {Array<Object>} dependencies Dependencies
   * @returns {Object} Schedule
   */
  _calculateSchedule(tasks, dependencies) {
    try {
      // Create task map for quick lookup
      const taskMap = {};
      
      for (const task of tasks) {
        taskMap[task.id] = task;
      }
      
      // Calculate early start and early finish for each task
      const start = {};
      const finish = {};
      
      // Initialize early start and early finish for tasks with no predecessors
      for (const task of tasks) {
        const hasPredecessor = dependencies.some(dep => dep.successor === task.id);
        
        if (!hasPredecessor) {
          start[task.id] = 0;
          finish[task.id] = task.duration;
        }
      }
      
      // Calculate early start and early finish for all tasks
      let updated = true;
      
      while (updated) {
        updated = false;
        
        for (const dependency of dependencies) {
          const predecessorId = dependency.predecessor;
          const successorId = dependency.successor;
          
          if (finish[predecessorId] !== undefined && start[successorId] === undefined) {
            start[successorId] = finish[predecessorId] + (dependency.lag || 0);
            finish[successorId] = start[successorId] + taskMap[successorId].duration;
            updated = true;
          }
        }
      }
      
      // Find project end time
      let projectEndTime = 0;
      
      for (const taskId of Object.keys(finish)) {
        projectEndTime = Math.max(projectEndTime, finish[taskId]);
      }
      
      return {
        start,
        finish,
        duration: projectEndTime
      };
    } catch (error) {
      this.logger.error('Error calculating schedule', error);
      
      return {
        start: {},
        finish: {},
        duration: 0
      };
    }
  }
  
  /**
   * Calculates schedule metrics
   * @private
   * @param {Object} schedule Schedule
   * @param {Object} criticalPath Critical path
   * @returns {Object} Schedule metrics
   */
  _calculateScheduleMetrics(schedule, criticalPath) {
    try {
      // Calculate schedule performance index (SPI)
      const plannedDuration = criticalPath.duration;
      const actualDuration = schedule.duration;
      
      const spi = plannedDuration > 0 ? plannedDuration / actualDuration : 1;
      
      // Calculate schedule variance (SV)
      const sv = plannedDuration - actualDuration;
      
      // Calculate schedule compression ratio
      const compressionRatio = plannedDuration > 0 ? (plannedDuration - actualDuration) / plannedDuration : 0;
      
      // Calculate schedule flexibility
      const flexibility = this._calculateScheduleFlexibility(schedule);
      
      return {
        spi,
        sv,
        compressionRatio,
        flexibility,
        duration: actualDuration
      };
    } catch (error) {
      this.logger.error('Error calculating schedule metrics', error);
      
      return {
        spi: 1,
        sv: 0,
        compressionRatio: 0,
        flexibility: 0,
        duration: schedule.duration
      };
    }
  }
  
  /**
   * Calculates schedule flexibility
   * @private
   * @param {Object} schedule Schedule
   * @returns {number} Schedule flexibility
   */
  _calculateScheduleFlexibility(schedule) {
    try {
      // Calculate total slack in the schedule
      let totalSlack = 0;
      let taskCount = 0;
      
      for (const taskId of Object.keys(schedule.start)) {
        // For simplicity, assume late finish is the project end time
        const lateFinish = schedule.duration;
        const earlyFinish = schedule.finish[taskId];
        
        // Calculate slack
        const slack = lateFinish - earlyFinish;
        
        totalSlack += slack;
        taskCount++;
      }
      
      // Calculate average slack
      const averageSlack = taskCount > 0 ? totalSlack / taskCount : 0;
      
      // Normalize flexibility (0-1 scale)
      const normalizedFlexibility = Math.min(1, averageSlack / (schedule.duration * 0.2));
      
      return normalizedFlexibility;
    } catch (error) {
      this.logger.error('Error calculating schedule flexibility', error);
      return 0.5;
    }
  }
  
  /**
   * Identifies stakeholders for an option
   * @private
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Array<Object>} Stakeholders
   */
  _identifyStakeholders(option, context) {
    try {
      // Use provided stakeholders if available
      if (option.stakeholders) {
        return option.stakeholders;
      }
      
      // Use context stakeholders if available
      if (context.stakeholders) {
        return context.stakeholders;
      }
      
      // Generate generic stakeholders
      return [
        {
          id: 'sponsor',
          name: 'Project Sponsor',
          type: 'internal',
          interests: {
            roi: 0.9,
            timeline: 0.7,
            quality: 0.6
          }
        },
        {
          id: 'manager',
          name: 'Project Manager',
          type: 'internal',
          interests: {
            timeline: 0.9,
            budget: 0.8,
            scope: 0.7
          }
        },
        {
          id: 'team',
          name: 'Project Team',
          type: 'internal',
          interests: {
            workload: 0.8,
            resources: 0.7,
            timeline: 0.6
          }
        },
        {
          id: 'customer',
          name: 'Customer',
          type: 'external',
          interests: {
            quality: 0.9,
            timeline: 0.7,
            cost: 0.6
          }
        },
        {
          id: 'vendor',
          name: 'Vendor',
          type: 'external',
          interests: {
            cost: 0.8,
            timeline: 0.6,
            scope: 0.5
          }
        }
      ];
    } catch (error) {
      this.logger.error('Error identifying stakeholders', error);
      return [];
    }
  }
  
  /**
   * Assesses stakeholder influence
   * @private
   * @param {Array<Object>} stakeholders Stakeholders
   * @param {Object} context Decision context
   * @returns {Object} Stakeholder influence
   */
  _assessStakeholderInfluence(stakeholders, context) {
    try {
      const influence = {};
      
      for (const stakeholder of stakeholders) {
        // Use provided influence if available
        if (stakeholder.influence !== undefined) {
          influence[stakeholder.id] = stakeholder.influence;
          continue;
        }
        
        // Calculate influence based on stakeholder type and context
        let influenceScore = 0.5; // Default medium influence
        
        switch (stakeholder.type) {
          case 'internal':
            if (stakeholder.id === 'sponsor') {
              influenceScore = 0.9; // High influence
            } else if (stakeholder.id === 'manager') {
              influenceScore = 0.8; // High influence
            } else {
              influenceScore = 0.6; // Medium-high influence
            }
            break;
          case 'external':
            if (stakeholder.id === 'customer') {
              influenceScore = 0.7; // Medium-high influence
            } else {
              influenceScore = 0.4; // Medium-low influence
            }
            break;
          default:
            influenceScore = 0.5; // Medium influence
        }
        
        // Adjust influence based on project characteristics
        if (context.projectSize === 'large') {
          // In large projects, external stakeholders have less influence
          if (stakeholder.type === 'external') {
            influenceScore *= 0.9;
          }
        } else if (context.projectSize === 'small') {
          // In small projects, all stakeholders have more influence
          influenceScore = Math.min(1, influenceScore * 1.1);
        }
        
        influence[stakeholder.id] = influenceScore;
      }
      
      return influence;
    } catch (error) {
      this.logger.error('Error assessing stakeholder influence', error);
      
      const influence = {};
      
      for (const stakeholder of stakeholders) {
        influence[stakeholder.id] = 0.5; // Default medium influence
      }
      
      return influence;
    }
  }
  
  /**
   * Assesses stakeholder interest
   * @private
   * @param {Array<Object>} stakeholders Stakeholders
   * @param {Object} option Option to analyze
   * @param {Object} context Decision context
   * @returns {Object} Stakeholder interest
   */
  _assessStakeholderInterest(stakeholders, option, context) {
    try {
      const interest = {};
      
      for (const stakeholder of stakeholders) {
        // Use provided interest if available
        if (stakeholder.interest !== undefined) {
          interest[stakeholder.id] = stakeholder.interest;
          continue;
        }
        
        // Calculate interest based on stakeholder interests and option characteristics
        let interestScore = 0.5; // Default medium interest
        
        if (stakeholder.interests) {
          let totalInterestScore = 0;
          let totalImportance = 0;
          
          for (const [interestKey, importance] of Object.entries(stakeholder.interests)) {
            // Check if option addresses this interest
            const interestValue = option[interestKey] || 0.5;
            
            totalInterestScore += interestValue * importance;
            totalImportance += importance;
          }
          
          if (totalImportance > 0) {
            interestScore = totalInterestScore / totalImportance;
          }
        }
        
        interest[stakeholder.id] = interestScore;
      }
      
      return interest;
    } catch (error) {
      this.logger.error('Error assessing stakeholder interest', error);
      
      const interest = {};
      
      for (const stakeholder of stakeholders) {
        interest[stakeholder.id] = 0.5; // Default medium interest
      }
      
      return interest;
    }
  }
  
  /**
   * Calculates stakeholder power
   * @private
   * @param {Object} influence Stakeholder influence
   * @param {Object} interest Stakeholder interest
   * @returns {Object} Stakeholder power
   */
  _calculateStakeholderPower(influence, interest) {
    try {
      const power = {};
      
      for (const stakeholderId of Object.keys(influence)) {
        if (interest[stakeholderId] !== undefined) {
          // Calculate power as a combination of influence and interest
          power[stakeholderId] = (influence[stakeholderId] * 0.7) + (interest[stakeholderId] * 0.3);
        }
      }
      
      return power;
    } catch (error) {
      this.logger.error('Error calculating stakeholder power', error);
      
      const power = {};
      
      for (const stakeholderId of Object.keys(influence)) {
        power[stakeholderId] = 0.5; // Default medium power
      }
      
      return power;
    }
  }
  
  /**
   * Calculates stakeholder weights
   * @private
   * @param {Object} influence Stakeholder influence
   * @param {Object} interest Stakeholder interest
   * @param {Object} power Stakeholder power
   * @param {string} strategy Stakeholder weight strategy
   * @returns {Object} Stakeholder weights
   */
  _calculateStakeholderWeights(influence, interest, power, strategy) {
    try {
      const weights = {};
      
      // Calculate raw weights based on strategy
      const rawWeights = {};
      let totalRawWeight = 0;
      
      for (const stakeholderId of Object.keys(power)) {
        let rawWeight = 0;
        
        switch (strategy) {
          case 'influence':
            rawWeight = influence[stakeholderId];
            break;
          case 'interest':
            rawWeight = interest[stakeholderId];
            break;
          case 'power':
            rawWeight = power[stakeholderId];
            break;
          case 'balanced':
          default:
            rawWeight = (influence[stakeholderId] + interest[stakeholderId] + power[stakeholderId]) / 3;
        }
        
        rawWeights[stakeholderId] = rawWeight;
        totalRawWeight += rawWeight;
      }
      
      // Normalize weights
      if (totalRawWeight > 0) {
        for (const stakeholderId of Object.keys(rawWeights)) {
          weights[stakeholderId] = rawWeights[stakeholderId] / totalRawWeight;
        }
      } else {
        // Equal weights if total is zero
        const equalWeight = 1 / Object.keys(rawWeights).length;
        
        for (const stakeholderId of Object.keys(rawWeights)) {
          weights[stakeholderId] = equalWeight;
        }
      }
      
      return weights;
    } catch (error) {
      this.logger.error('Error calculating stakeholder weights', error);
      
      const weights = {};
      const equalWeight = 1 / Object.keys(power).length;
      
      for (const stakeholderId of Object.keys(power)) {
        weights[stakeholderId] = equalWeight;
      }
      
      return weights;
    }
  }
  
  /**
   * Calculates stakeholder satisfaction
   * @private
   * @param {Array<Object>} stakeholders Stakeholders
   * @param {Object} option Option to analyze
   * @param {Object} weights Stakeholder weights
   * @returns {Object} Stakeholder satisfaction
   */
  _calculateStakeholderSatisfaction(stakeholders, option, weights) {
    try {
      const satisfaction = {};
      
      for (const stakeholder of stakeholders) {
        // Use provided satisfaction if available
        if (stakeholder.satisfaction !== undefined) {
          satisfaction[stakeholder.id] = stakeholder.satisfaction;
          continue;
        }
        
        // Calculate satisfaction based on stakeholder interests and option characteristics
        let satisfactionScore = 0.5; // Default medium satisfaction
        
        if (stakeholder.interests) {
          let totalSatisfactionScore = 0;
          let totalImportance = 0;
          
          for (const [interestKey, importance] of Object.entries(stakeholder.interests)) {
            // Check if option addresses this interest
            const interestValue = option[interestKey] || 0.5;
            
            totalSatisfactionScore += interestValue * importance;
            totalImportance += importance;
          }
          
          if (totalImportance > 0) {
            satisfactionScore = totalSatisfactionScore / totalImportance;
          }
        }
        
        satisfaction[stakeholder.id] = satisfactionScore;
      }
      
      // Calculate weighted satisfaction
      let weightedSatisfaction = 0;
      
      for (const stakeholderId of Object.keys(satisfaction)) {
        if (weights[stakeholderId] !== undefined) {
          weightedSatisfaction += satisfaction[stakeholderId] * weights[stakeholderId];
        }
      }
      
      satisfaction.weighted = weightedSatisfaction;
      
      return satisfaction;
    } catch (error) {
      this.logger.error('Error calculating stakeholder satisfaction', error);
      
      const satisfaction = {};
      
      for (const stakeholder of stakeholders) {
        satisfaction[stakeholder.id] = 0.5; // Default medium satisfaction
      }
      
      satisfaction.weighted = 0.5;
      
      return satisfaction;
    }
  }
  
  /**
   * Calculates strategic alignment
   * @private
   * @param {Array<Object>} options Options to analyze
   * @param {Object} context Decision context
   * @returns {Object} Strategic alignment
   */
  _calculateStrategicAlignment(options, context) {
    try {
      const alignment = {};
      
      // Get strategic objectives from context
      const strategicObjectives = context.strategicObjectives || {
        financial: { weight: 0.3 },
        customer: { weight: 0.3 },
        internal: { weight: 0.2 },
        learning: { weight: 0.2 }
      };
      
      for (const option of options) {
        // Use provided strategic alignment if available
        if (option.strategicAlignment !== undefined) {
          alignment[option.id] = option.strategicAlignment;
          continue;
        }
        
        // Calculate alignment for each strategic objective
        let totalAlignmentScore = 0;
        let totalWeight = 0;
        
        for (const [objectiveKey, objective] of Object.entries(strategicObjectives)) {
          // Get option's alignment with this objective
          const objectiveAlignment = option[`${objectiveKey}Alignment`] || 0.5;
          
          totalAlignmentScore += objectiveAlignment * objective.weight;
          totalWeight += objective.weight;
        }
        
        // Calculate overall alignment
        const overallAlignment = totalWeight > 0 ? totalAlignmentScore / totalWeight : 0.5;
        
        alignment[option.id] = overallAlignment;
      }
      
      return alignment;
    } catch (error) {
      this.logger.error('Error calculating strategic alignment', error);
      
      const alignment = {};
      
      for (const option of options) {
        alignment[option.id] = 0.5; // Default medium alignment
      }
      
      return alignment;
    }
  }
  
  /**
   * Calculates return on investment
   * @private
   * @param {Array<Object>} options Options to analyze
   * @param {Object} context Decision context
   * @returns {Object} Return on investment
   */
  _calculateReturnOnInvestment(options, context) {
    try {
      const roi = {};
      
      for (const option of options) {
        // Use provided ROI if available
        if (option.roi !== undefined) {
          roi[option.id] = option.roi;
          continue;
        }
        
        // Calculate costs
        const resourceRequirements = this._getResourceRequirements(option, context);
        const costs = resourceRequirements.total.cost;
        
        // Calculate benefits
        const benefits = option.benefits || costs * 1.5; // Default 50% ROI
        
        // Calculate ROI
        const optionRoi = costs > 0 ? (benefits - costs) / costs : 0;
        
        roi[option.id] = optionRoi;
      }
      
      return roi;
    } catch (error) {
      this.logger.error('Error calculating return on investment', error);
      
      const roi = {};
      
      for (const option of options) {
        roi[option.id] = 0.5; // Default 50% ROI
      }
      
      return roi;
    }
  }
  
  /**
   * Calculates resource constraints
   * @private
   * @param {Array<Object>} options Options to analyze
   * @param {Object} context Decision context
   * @returns {Object} Resource constraints
   */
  _calculateResourceConstraints(options, context) {
    try {
      const constraints = {};
      
      // Get resource availability
      const resourceAvailability = this._getResourceAvailability(context);
      
      for (const option of options) {
        // Calculate resource requirements
        const resourceRequirements = this._getResourceRequirements(option, context);
        
        // Calculate resource utilization
        const resourceAllocation = this._calculateResourceAllocation(
          resourceRequirements,
          resourceAvailability,
          this.config.resourceOptimizationStrategy
        );
        
        const resourceUtilization = this._calculateResourceUtilization(resourceAllocation, resourceAvailability);
        
        // Calculate constraint score (higher means more constrained)
        constraints[option.id] = resourceUtilization.overall;
      }
      
      return constraints;
    } catch (error) {
      this.logger.error('Error calculating resource constraints', error);
      
      const constraints = {};
      
      for (const option of options) {
        constraints[option.id] = 0.5; // Default medium constraint
      }
      
      return constraints;
    }
  }
  
  /**
   * Calculates project interdependencies
   * @private
   * @param {Array<Object>} options Options to analyze
   * @param {Object} context Decision context
   * @returns {Object} Project interdependencies
   */
  _calculateProjectInterdependencies(options, context) {
    try {
      const interdependencies = {};
      
      // Get project interdependencies from context
      const contextInterdependencies = context.projectInterdependencies || [];
      
      for (const option of options) {
        // Find interdependencies for this option
        const optionInterdependencies = contextInterdependencies.filter(
          dep => dep.source === option.id || dep.target === option.id
        );
        
        // Calculate interdependency score
        let interdependencyScore = 0;
        
        if (optionInterdependencies.length > 0) {
          let totalStrength = 0;
          
          for (const interdependency of optionInterdependencies) {
            totalStrength += interdependency.strength || 0.5;
          }
          
          interdependencyScore = totalStrength / optionInterdependencies.length;
        }
        
        interdependencies[option.id] = {
          score: interdependencyScore,
          dependencies: optionInterdependencies
        };
      }
      
      return interdependencies;
    } catch (error) {
      this.logger.error('Error calculating project interdependencies', error);
      
      const interdependencies = {};
      
      for (const option of options) {
        interdependencies[option.id] = {
          score: 0,
          dependencies: []
        };
      }
      
      return interdependencies;
    }
  }
  
  /**
   * Calculates project scores
   * @private
   * @param {Object} strategicAlignment Strategic alignment
   * @param {Object} returnOnInvestment Return on investment
   * @param {Object} resourceConstraints Resource constraints
   * @param {Object} projectInterdependencies Project interdependencies
   * @param {Object} context Decision context
   * @returns {Object} Project scores
   */
  _calculateProjectScores(strategicAlignment, returnOnInvestment, resourceConstraints, projectInterdependencies, context) {
    try {
      const scores = {};
      
      // Get scoring weights from context
      const scoringWeights = context.scoringWeights || {
        strategicAlignment: 0.4,
        returnOnInvestment: 0.3,
        resourceConstraints: 0.2,
        projectInterdependencies: 0.1
      };
      
      for (const projectId of Object.keys(strategicAlignment)) {
        // Normalize ROI (assuming maximum ROI of 2.0)
        const normalizedRoi = Math.min(1, returnOnInvestment[projectId] / 2);
        
        // Invert resource constraints (lower constraint is better)
        const invertedConstraints = 1 - resourceConstraints[projectId];
        
        // Calculate weighted score
        const weightedScore = 
          (strategicAlignment[projectId] * scoringWeights.strategicAlignment) +
          (normalizedRoi * scoringWeights.returnOnInvestment) +
          (invertedConstraints * scoringWeights.resourceConstraints) +
          (projectInterdependencies[projectId].score * scoringWeights.projectInterdependencies);
        
        scores[projectId] = weightedScore;
      }
      
      return scores;
    } catch (error) {
      this.logger.error('Error calculating project scores', error);
      
      const scores = {};
      
      for (const projectId of Object.keys(strategicAlignment)) {
        scores[projectId] = 0.5; // Default medium score
      }
      
      return scores;
    }
  }
  
  /**
   * Optimizes project portfolio
   * @private
   * @param {Array<Object>} options Options to analyze
   * @param {Object} projectScores Project scores
   * @param {Object} resourceConstraints Resource constraints
   * @param {Object} projectInterdependencies Project interdependencies
   * @param {Object} context Decision context
   * @returns {Array<string>} Optimized portfolio
   */
  _optimizeProjectPortfolio(options, projectScores, resourceConstraints, projectInterdependencies, context) {
    try {
      // Get resource availability
      const resourceAvailability = this._getResourceAvailability(context);
      
      // Get budget constraint
      const budgetConstraint = resourceAvailability.financial.budget || 0;
      
      // Sort projects by score
      const sortedProjects = options
        .map(option => ({
          id: option.id,
          score: projectScores[option.id],
          requirements: this._getResourceRequirements(option, context)
        }))
        .sort((a, b) => b.score - a.score);
      
      // Optimize portfolio
      const portfolio = [];
      let remainingBudget = budgetConstraint;
      
      for (const project of sortedProjects) {
        const projectCost = project.requirements.total.cost;
        
        // Check if project fits within remaining budget
        if (projectCost <= remainingBudget) {
          portfolio.push(project.id);
          remainingBudget -= projectCost;
        }
      }
      
      return portfolio;
    } catch (error) {
      this.logger.error('Error optimizing project portfolio', error);
      
      // Return top 3 projects by score
      return Object.entries(projectScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    }
  }
  
  /**
   * Shuts down the Project Management Decision Framework
   * @returns {Promise<void>} A promise that resolves when shutdown is complete
   */
  async shutdown() {
    if (!this.initialized) {
      this.logger.info('Not initialized, nothing to shut down');
      return;
    }
    
    this.logger.info('Shutting down Project Management Decision Framework');
    
    try {
      // Clean up resources
      
      this.initialized = false;
      this.logger.info('Project Management Decision Framework shutdown complete');
      
      // Emit shutdown event
      this.events.emit('shutdown', { component: 'projectManagementDecisionFramework' });
    } catch (error) {
      this.logger.error('Shutdown failed', error);
      throw error;
    }
  }
  
  /**
   * Gets the current status of the Project Management Decision Framework
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      initialized: this.initialized,
      config: this.config
    };
  }
  
  /**
   * Evaluates options using the Project Management Decision Framework
   * @param {Array<Object>} options Array of options to evaluate
   * @param {Object} criteria Evaluation criteria
   * @param {Object} context Decision context
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluateOptions(options, criteria, context) {
    if (!this.initialized) {
      throw new Error('Project Management Decision Framework not initialized');
    }
    
    this.logger.info('Evaluating options with Project Management Decision Framework', {
      optionCount: options.length,
      criteriaCount: Object.keys(criteria).length
    });
    
    try {
      // Allocate resources
      const resourceAllocation = this.resourceAllocator.allocateResources(options, context);
      
      // Manage risks
      const riskManagement = this.riskManager.manageRisks(options, context);
      
      // Optimize schedule
      const scheduleOptimization = this.scheduleOptimizer.optimizeSchedule(options, context);
      
      // Analyze stakeholders
      const stakeholderAnalysis = this.stakeholderAnalyzer.analyzeStakeholders(options, context);
      
      // Select projects
      const projectSelection = this.projectSelector.selectProjects(options, context);
      
      // Calculate overall scores
      const scores = {};
      
      for (const option of options) {
        // Get resource efficiency
        const resourceEfficiency = resourceAllocation[option.id]
          ? resourceAllocation[option.id].efficiency.overall
          : 0.5;
        
        // Get residual risk
        const residualRisk = riskManagement[option.id]
          ? riskManagement[option.id].residualRisk.overall
          : 0.5;
        
        // Get schedule performance
        const schedulePerformance = scheduleOptimization[option.id]
          ? scheduleOptimization[option.id].metrics.spi
          : 1.0;
        
        // Get stakeholder satisfaction
        const stakeholderSatisfaction = stakeholderAnalysis[option.id]
          ? stakeholderAnalysis[option.id].satisfaction.weighted
          : 0.5;
        
        // Get project score
        const projectScore = projectSelection.projectScores[option.id]
          ? projectSelection.projectScores[option.id].score
          : 0.5;
        
        // Calculate weighted score based on criteria
        let weightedScore = 0;
        let totalWeight = 0;
        
        if (criteria.resources) {
          weightedScore += criteria.resources.weight * resourceEfficiency;
          totalWeight += criteria.resources.weight;
        }
        
        if (criteria.risks) {
          weightedScore += criteria.risks.weight * (1 - residualRisk); // Invert risk (lower is better)
          totalWeight += criteria.risks.weight;
        }
        
        if (criteria.schedule) {
          weightedScore += criteria.schedule.weight * Math.min(1, schedulePerformance);
          totalWeight += criteria.schedule.weight;
        }
        
        if (criteria.stakeholders) {
          weightedScore += criteria.stakeholders.weight * stakeholderSatisfaction;
          totalWeight += criteria.stakeholders.weight;
        }
        
        if (criteria.strategic) {
          weightedScore += criteria.strategic.weight * projectScore;
          totalWeight += criteria.strategic.weight;
        }
        
        // Normalize weighted score
        if (totalWeight > 0) {
          weightedScore /= totalWeight;
        } else {
          weightedScore = 0.5;
        }
        
        scores[option.id] = {
          overall: weightedScore,
          components: {
            resources: resourceEfficiency,
            risks: 1 - residualRisk,
            schedule: Math.min(1, schedulePerformance),
            stakeholders: stakeholderSatisfaction,
            strategic: projectScore
          }
        };
      }
      
      // Return evaluation results
      return {
        scores,
        details: {
          resourceAllocation,
          riskManagement,
          scheduleOptimization,
          stakeholderAnalysis,
          projectSelection
        },
        framework: {
          id: this.id,
          name: this.name,
          version: this.version
        }
      };
    } catch (error) {
      this.logger.error('Option evaluation failed', error);
      throw error;
    }
  }
}

module.exports = { ProjectManagementDecisionFramework };
