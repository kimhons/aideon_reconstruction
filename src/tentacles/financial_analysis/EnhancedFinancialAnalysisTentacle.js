/**
 * @file EnhancedFinancialAnalysisTentacle.js
 * 
 * Implementation of the Enhanced Financial Analysis Tentacle for the Aideon AI Desktop Agent.
 * This tentacle provides comprehensive financial analysis capabilities including real-time
 * market data collection, AI-powered budget management, advanced forecasting, investment
 * analysis, algorithmic trading, portfolio optimization, risk management, and fraud detection.
 * 
 * @author Aideon Development Team
 * @version 1.0.0
 */

const TentacleBase = require('../TentacleBase');
const path = require('path');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');

// Core Services
const ConfigurationService = require('./core/ConfigurationService');
const EventBus = require('./core/EventBus');
const TelemetryService = require('./core/TelemetryService');
const SecurityManager = require('./core/SecurityManager');

// Financial Services
const DataIngestionService = require('./data/DataIngestionService');
const BudgetManagementService = require('./core/BudgetManagementService');
const ForecastingService = require('./core/ForecastingService');
const ExpenseTrackingService = require('./core/ExpenseTrackingService');
const InvestmentAnalysisService = require('./core/InvestmentAnalysisService');
const ComplianceService = require('./compliance/ComplianceService');
const TradingService = require('./trading/TradingService');
const PortfolioOptimizationService = require('./portfolio/PortfolioOptimizationService');
const RiskManagementService = require('./risk/RiskManagementService');
const FraudDetectionService = require('./fraud/FraudDetectionService');
const AIMLService = require('./ai/AIMLService');

/**
 * Enhanced Financial Analysis Tentacle class
 * Provides comprehensive financial analysis capabilities for the Aideon AI Desktop Agent
 */
class EnhancedFinancialAnalysisTentacle extends TentacleBase {
  /**
   * Constructor for the EnhancedFinancialAnalysisTentacle class
   * @param {Object} config - Configuration object for the tentacle
   * @param {Object} dependencies - System dependencies required by the tentacle
   */
  constructor(config, dependencies) {
    // Default configuration for Enhanced Financial Analysis Tentacle
    const defaultConfig = {
      id: 'enhanced_financial_analysis',
      name: 'Enhanced Financial Analysis',
      description: 'Advanced financial analysis, forecasting, trading, and portfolio management tentacle',
      version: '1.0.0',
      capabilities: {
        marketData: {
          realTime: true,
          historical: true,
          alternative: true,
          sources: 50 // 50+ data sources
        },
        budgetManagement: {
          aiPowered: true,
          predictiveModeling: true,
          multiCurrency: true
        },
        forecasting: {
          ensembleMethods: true,
          timeSeriesAnalysis: true,
          machineLearning: true,
          accuracy: 0.8 // 80%+ accuracy
        },
        expenseTracking: {
          automaticCategorization: true,
          receiptProcessing: true,
          bankIntegration: true
        },
        investmentAnalysis: {
          portfolioAnalysis: true,
          riskAssessment: true,
          benchmarkComparison: true
        },
        compliance: {
          regulationTracking: true,
          complianceChecking: true,
          reportingGeneration: true
        },
        trading: {
          algorithmic: true,
          backtesting: true,
          execution: true,
          highFrequency: true
        },
        portfolioOptimization: {
          modernPortfolioTheory: true,
          factorModels: true,
          quantumComputing: true
        },
        riskManagement: {
          scenarioAnalysis: true,
          varCalculation: true,
          stressTesting: true
        },
        fraudDetection: {
          anomalyDetection: true,
          behavioralAnalysis: true,
          patternRecognition: true
        }
      },
      services: {
        configuration: {
          encryptionEnabled: true,
          offlineSupport: true
        },
        telemetry: {
          enabled: true,
          detailLevel: 'detailed',
          privacyCompliant: true
        },
        security: {
          encryptionLevel: 'AES-256',
          authenticationRequired: true,
          rbacEnabled: true
        },
        dataIngestion: {
          realTimeEnabled: true,
          cachingEnabled: true,
          offlineSupport: true,
          maxCacheSize: 1024 * 1024 * 1024 // 1GB
        },
        aiml: {
          localModelsEnabled: true,
          cloudModelsEnabled: true,
          modelMonitoringEnabled: true,
          explainabilityEnabled: true
        }
      }
    };
    
    // Merge provided config with defaults
    const mergedConfig = { ...defaultConfig, ...config };
    
    super(mergedConfig, dependencies);
    
    this.log.info('Initializing Enhanced Financial Analysis Tentacle...');
    
    // Initialize core services
    this._initializeCoreServices();
    
    // Initialize financial services
    this._initializeFinancialServices();
    
    // Register event handlers
    this._registerEventHandlers();
    
    this.log.info('Enhanced Financial Analysis Tentacle initialized');
  }
  
  /**
   * Initialize the tentacle
   * @returns {Promise<boolean>} - Promise resolving to true if initialization is successful
   */
  async initialize() {
    try {
      this.log.info('Starting Enhanced Financial Analysis Tentacle initialization...');
      const startTime = performance.now();
      
      // Initialize configuration service first
      await this.services.configuration.initialize();
      this.log.info('Configuration service initialized');
      
      // Initialize core services
      await Promise.all([
        this.services.eventBus.initialize(),
        this.services.telemetry.initialize(),
        this.services.security.initialize()
      ]);
      this.log.info('Core services initialized');
      
      // Initialize AI/ML service
      await this.services.aiml.initialize();
      this.log.info('AI/ML service initialized');
      
      // Initialize data ingestion service
      await this.services.dataIngestion.initialize();
      this.log.info('Data ingestion service initialized');
      
      // Initialize remaining services in parallel where possible
      await Promise.all([
        this.services.budgetManagement.initialize(),
        this.services.forecasting.initialize(),
        this.services.expenseTracking.initialize(),
        this.services.investmentAnalysis.initialize(),
        this.services.compliance.initialize(),
        this.services.trading.initialize(),
        this.services.portfolioOptimization.initialize(),
        this.services.riskManagement.initialize(),
        this.services.fraudDetection.initialize()
      ]);
      this.log.info('Financial services initialized');
      
      // Load prompt templates
      await this._loadPromptTemplates();
      this.log.info('Prompt templates loaded');
      
      const endTime = performance.now();
      this.log.info(`Enhanced Financial Analysis Tentacle initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Start telemetry
      this.services.telemetry.trackEvent('tentacle_initialized', {
        tentacleId: this.config.id,
        initializationTime: endTime - startTime
      });
      
      this.updateStatus('idle');
      return true;
    } catch (error) {
      this.log.error(`Error initializing Enhanced Financial Analysis Tentacle: ${error.message}`, error);
      this.updateStatus('error');
      throw error;
    }
  }
  
  /**
   * Process a task assigned to this tentacle
   * @param {Object} task - Task object containing details of the work to be done
   * @returns {Promise<Object>} - Promise resolving to the task result
   */
  async processTask(task) {
    try {
      this.log.info(`Processing task: ${task.id} - ${task.type}`);
      this.updateStatus('processing');
      
      // Track task start
      const startTime = performance.now();
      this.services.telemetry.trackEvent('task_started', {
        taskId: task.id,
        taskType: task.type,
        tentacleId: this.config.id
      });
      
      // Validate task
      this._validateTask(task);
      
      // Process task based on type
      let result;
      switch (task.type) {
        case 'market_data':
          result = await this.services.dataIngestion.processTask(task);
          break;
        case 'budget_management':
          result = await this.services.budgetManagement.processTask(task);
          break;
        case 'financial_forecasting':
          result = await this.services.forecasting.processTask(task);
          break;
        case 'expense_tracking':
          result = await this.services.expenseTracking.processTask(task);
          break;
        case 'investment_analysis':
          result = await this.services.investmentAnalysis.processTask(task);
          break;
        case 'compliance_check':
          result = await this.services.compliance.processTask(task);
          break;
        case 'trading':
          result = await this.services.trading.processTask(task);
          break;
        case 'portfolio_optimization':
          result = await this.services.portfolioOptimization.processTask(task);
          break;
        case 'risk_assessment':
          result = await this.services.riskManagement.processTask(task);
          break;
        case 'fraud_detection':
          result = await this.services.fraudDetection.processTask(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
      
      // Track task completion
      const endTime = performance.now();
      this.services.telemetry.trackEvent('task_completed', {
        taskId: task.id,
        taskType: task.type,
        tentacleId: this.config.id,
        executionTime: endTime - startTime,
        success: true
      });
      
      this.updateStatus('idle');
      return {
        success: true,
        taskId: task.id,
        result,
        executionTime: endTime - startTime
      };
    } catch (error) {
      this.log.error(`Error processing task ${task.id}: ${error.message}`, error);
      
      // Track task failure
      this.services.telemetry.trackEvent('task_failed', {
        taskId: task.id,
        taskType: task.type,
        tentacleId: this.config.id,
        error: error.message
      });
      
      this.updateStatus('error');
      return {
        success: false,
        taskId: task.id,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  }
  
  /**
   * Check if this tentacle can handle a specific task
   * @param {Object} task - Task to evaluate
   * @returns {boolean} - Whether this tentacle can handle the task
   */
  canHandleTask(task) {
    const supportedTaskTypes = [
      'market_data',
      'budget_management',
      'financial_forecasting',
      'expense_tracking',
      'investment_analysis',
      'compliance_check',
      'trading',
      'portfolio_optimization',
      'risk_assessment',
      'fraud_detection'
    ];
    
    return supportedTaskTypes.includes(task.type);
  }
  
  /**
   * Get the capabilities of this tentacle
   * @returns {Object} - Capabilities object
   */
  getCapabilities() {
    return this.config.capabilities;
  }
  
  /**
   * Get the status of all services
   * @returns {Promise<Object>} - Promise resolving to service status object
   */
  async getServiceStatus() {
    const statusPromises = Object.entries(this.services).map(async ([name, service]) => {
      try {
        const status = await service.getStatus();
        return { name, status };
      } catch (error) {
        this.log.error(`Error getting status for service ${name}: ${error.message}`);
        return { name, status: 'error', error: error.message };
      }
    });
    
    const statuses = await Promise.all(statusPromises);
    return statuses.reduce((acc, { name, status }) => {
      acc[name] = status;
      return acc;
    }, {});
  }
  
  /**
   * Shutdown the tentacle gracefully
   * @returns {Promise<boolean>} - Promise resolving to true if shutdown is successful
   */
  async shutdown() {
    try {
      this.log.info('Shutting down Enhanced Financial Analysis Tentacle...');
      
      // Shutdown services in reverse order of initialization
      await Promise.all([
        this.services.fraudDetection.shutdown(),
        this.services.riskManagement.shutdown(),
        this.services.portfolioOptimization.shutdown(),
        this.services.trading.shutdown(),
        this.services.compliance.shutdown(),
        this.services.investmentAnalysis.shutdown(),
        this.services.expenseTracking.shutdown(),
        this.services.forecasting.shutdown(),
        this.services.budgetManagement.shutdown()
      ]);
      
      await this.services.dataIngestion.shutdown();
      await this.services.aiml.shutdown();
      
      await Promise.all([
        this.services.security.shutdown(),
        this.services.telemetry.shutdown(),
        this.services.eventBus.shutdown()
      ]);
      
      await this.services.configuration.shutdown();
      
      this.log.info('Enhanced Financial Analysis Tentacle shutdown complete');
      return true;
    } catch (error) {
      this.log.error(`Error during Enhanced Financial Analysis Tentacle shutdown: ${error.message}`, error);
      return false;
    }
  }
  
  /**
   * Initialize core services
   * @private
   */
  _initializeCoreServices() {
    this.services = {};
    
    // Initialize configuration service
    this.services.configuration = new ConfigurationService(
      this.config.services.configuration,
      {
        logger: this.log,
        resourceManager: this.dependencies.resourceManager,
        secureStorage: this.dependencies.secureStorage
      }
    );
    
    // Initialize event bus
    this.services.eventBus = new EventBus(
      this.config.services.eventBus || {},
      {
        logger: this.log,
        eventEmitter: this.eventEmitter
      }
    );
    
    // Initialize telemetry service
    this.services.telemetry = new TelemetryService(
      this.config.services.telemetry,
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration
      }
    );
    
    // Initialize security manager
    this.services.security = new SecurityManager(
      this.config.services.security,
      {
        logger: this.log,
        configService: this.services.configuration,
        secureStorage: this.dependencies.secureStorage,
        authManager: this.dependencies.authManager
      }
    );
  }
  
  /**
   * Initialize financial services
   * @private
   */
  _initializeFinancialServices() {
    // Initialize AI/ML service
    this.services.aiml = new AIMLService(
      this.config.services.aiml,
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        resourceManager: this.dependencies.resourceManager,
        modelOrchestrator: this.dependencies.modelOrchestrator
      }
    );
    
    // Initialize data ingestion service
    this.services.dataIngestion = new DataIngestionService(
      this.config.services.dataIngestion,
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        networkManager: this.dependencies.networkManager
      }
    );
    
    // Initialize budget management service
    this.services.budgetManagement = new BudgetManagementService(
      this.config.services.budgetManagement || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
    
    // Initialize forecasting service
    this.services.forecasting = new ForecastingService(
      this.config.services.forecasting || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
    
    // Initialize expense tracking service
    this.services.expenseTracking = new ExpenseTrackingService(
      this.config.services.expenseTracking || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
    
    // Initialize investment analysis service
    this.services.investmentAnalysis = new InvestmentAnalysisService(
      this.config.services.investmentAnalysis || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
    
    // Initialize compliance service
    this.services.compliance = new ComplianceService(
      this.config.services.compliance || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
    
    // Initialize trading service
    this.services.trading = new TradingService(
      this.config.services.trading || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion,
        forecastingService: this.services.forecasting
      }
    );
    
    // Initialize portfolio optimization service
    this.services.portfolioOptimization = new PortfolioOptimizationService(
      this.config.services.portfolioOptimization || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion,
        investmentAnalysisService: this.services.investmentAnalysis
      }
    );
    
    // Initialize risk management service
    this.services.riskManagement = new RiskManagementService(
      this.config.services.riskManagement || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion,
        portfolioOptimizationService: this.services.portfolioOptimization
      }
    );
    
    // Initialize fraud detection service
    this.services.fraudDetection = new FraudDetectionService(
      this.config.services.fraudDetection || {},
      {
        logger: this.log,
        eventBus: this.services.eventBus,
        configService: this.services.configuration,
        securityManager: this.services.security,
        telemetry: this.services.telemetry,
        aimlService: this.services.aiml,
        dataIngestionService: this.services.dataIngestion
      }
    );
  }
  
  /**
   * Register event handlers
   * @private
   */
  _registerEventHandlers() {
    // Register for events from services
    Object.values(this.services).forEach(service => {
      if (service.on && typeof service.on === 'function') {
        service.on('event', this._handleServiceEvent.bind(this));
      }
    });
    
    // Register for events from Aideon core
    this.eventEmitter.on('core:event', this._handleCoreEvent.bind(this));
    
    // Register for specific events
    this.services.eventBus.subscribe('market_data_update', this._handleMarketDataUpdate.bind(this));
    this.services.eventBus.subscribe('trading_alert', this._handleTradingAlert.bind(this));
    this.services.eventBus.subscribe('risk_threshold_breach', this._handleRiskThresholdBreach.bind(this));
    this.services.eventBus.subscribe('fraud_detection_alert', this._handleFraudDetectionAlert.bind(this));
    this.services.eventBus.subscribe('compliance_violation', this._handleComplianceViolation.bind(this));
  }
  
  /**
   * Load prompt templates
   * @private
   * @returns {Promise<void>}
   */
  async _loadPromptTemplates() {
    try {
      const promptsDir = path.join(__dirname, 'prompts');
      
      // Check if prompts directory exists
      try {
        await fs.access(promptsDir);
      } catch (error) {
        // Create prompts directory if it doesn't exist
        await fs.mkdir(promptsDir, { recursive: true });
      }
      
      // Define prompt templates to load
      const promptTemplates = [
        'financial_analysis_prompt.md',
        'trading_strategy_prompt.md',
        'portfolio_optimization_prompt.md',
        'risk_assessment_prompt.md',
        'fraud_detection_prompt.md'
      ];
      
      // Load each prompt template
      this.promptTemplates = {};
      
      for (const templateName of promptTemplates) {
        const templatePath = path.join(promptsDir, templateName);
        
        try {
          // Check if template exists
          await fs.access(templatePath);
          
          // Load template
          const templateContent = await fs.readFile(templatePath, 'utf8');
          this.promptTemplates[templateName] = templateContent;
          this.log.debug(`Loaded prompt template: ${templateName}`);
        } catch (error) {
          // Create default template if it doesn't exist
          const defaultTemplate = this._createDefaultPromptTemplate(templateName);
          await fs.writeFile(templatePath, defaultTemplate, 'utf8');
          this.promptTemplates[templateName] = defaultTemplate;
          this.log.debug(`Created default prompt template: ${templateName}`);
        }
      }
    } catch (error) {
      this.log.error(`Error loading prompt templates: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Create a default prompt template
   * @private
   * @param {string} templateName - Name of the template
   * @returns {string} - Default template content
   */
  _createDefaultPromptTemplate(templateName) {
    switch (templateName) {
      case 'financial_analysis_prompt.md':
        return `# Enhanced Financial Analysis Prompt

## Core Identity
- You are the Enhanced Financial Analysis Tentacle of Aideon AI Desktop Agent.
- Your primary purpose is to provide comprehensive financial analysis, forecasting, and insights.
- You embody these key traits: analytical, precise, data-driven, forward-looking, and risk-aware.

## Capabilities
### Primary Functions
- Analyzing financial data from multiple sources
- Creating financial forecasts using ensemble methods
- Performing investment analysis with risk assessment
- Monitoring regulatory compliance
- Detecting financial fraud and anomalies

### Approach
- Always base your analysis on data, not assumptions
- Consider multiple scenarios and their probabilities
- Clearly communicate confidence levels and uncertainties
- Provide actionable insights and recommendations
- Maintain regulatory compliance and ethical standards

## Output Format
- Begin with a concise executive summary
- Provide detailed analysis with supporting data
- Include visualizations where appropriate
- End with clear, actionable recommendations
- Include relevant disclaimers and risk warnings`;

      case 'trading_strategy_prompt.md':
        return `# Trading Strategy Development Prompt

## Core Identity
- You are the Trading Strategy component of the Enhanced Financial Analysis Tentacle.
- Your primary purpose is to develop, backtest, and execute algorithmic trading strategies.
- You embody these key traits: systematic, disciplined, adaptive, and risk-conscious.

## Capabilities
### Primary Functions
- Developing algorithmic trading strategies
- Backtesting strategies with historical data
- Optimizing strategy parameters
- Executing trades through broker APIs
- Monitoring strategy performance in real-time

### Approach
- Always prioritize risk management over returns
- Use quantitative methods and statistical validation
- Consider transaction costs and market impact
- Maintain diversification and avoid concentration
- Adapt to changing market conditions

## Output Format
- Begin with strategy objectives and constraints
- Provide detailed strategy logic and parameters
- Include backtest results with performance metrics
- Analyze strengths, weaknesses, and failure modes
- End with implementation plan and monitoring approach`;

      case 'portfolio_optimization_prompt.md':
        return `# Portfolio Optimization Prompt

## Core Identity
- You are the Portfolio Optimization component of the Enhanced Financial Analysis Tentacle.
- Your primary purpose is to construct optimal portfolios based on modern portfolio theory and advanced techniques.
- You embody these key traits: mathematical, efficient, balanced, and goal-oriented.

## Capabilities
### Primary Functions
- Constructing efficient portfolios using modern portfolio theory
- Implementing factor models for portfolio construction
- Optimizing portfolios using quantum computing techniques
- Performing portfolio rebalancing with tax considerations
- Implementing risk parity and other allocation strategies

### Approach
- Balance risk and return based on investor objectives
- Consider constraints such as liquidity and position limits
- Account for correlation between assets and factors
- Optimize for after-tax returns where applicable
- Use advanced optimization techniques for complex problems

## Output Format
- Begin with investment objectives and constraints
- Provide detailed allocation recommendations with rationale
- Include expected risk, return, and other key metrics
- Analyze portfolio characteristics and factor exposures
- End with implementation and rebalancing recommendations`;

      case 'risk_assessment_prompt.md':
        return `# Risk Assessment Prompt

## Core Identity
- You are the Risk Assessment component of the Enhanced Financial Analysis Tentacle.
- Your primary purpose is to identify, measure, and manage financial risks.
- You embody these key traits: vigilant, thorough, forward-looking, and prudent.

## Capabilities
### Primary Functions
- Performing scenario analysis and stress testing
- Calculating Value at Risk (VaR) using multiple methodologies
- Analyzing tail risk and black swan events
- Assessing liquidity risk and counterparty risk
- Providing holistic risk views across portfolios

### Approach
- Consider both historical patterns and forward-looking scenarios
- Assess multiple types of risk (market, credit, liquidity, etc.)
- Quantify risks where possible, but acknowledge unmeasurable risks
- Focus on tail risks that could cause catastrophic losses
- Provide actionable risk mitigation recommendations

## Output Format
- Begin with an executive summary of key risks
- Provide detailed risk metrics with methodologies
- Include stress test results and scenario analyses
- Analyze risk concentrations and correlations
- End with specific risk mitigation recommendations`;

      case 'fraud_detection_prompt.md':
        return `# Fraud Detection Prompt

## Core Identity
- You are the Fraud Detection component of the Enhanced Financial Analysis Tentacle.
- Your primary purpose is to detect and prevent financial fraud and suspicious activities.
- You embody these key traits: vigilant, detail-oriented, pattern-recognizing, and proactive.

## Capabilities
### Primary Functions
- Detecting anomalies in financial transactions
- Identifying known fraud patterns
- Analyzing user behavior for suspicious changes
- Monitoring transactions in real-time
- Investigating potential fraudulent activities

### Approach
- Balance false positives with fraud prevention
- Use both rule-based and machine learning approaches
- Consider behavioral patterns and contextual information
- Maintain privacy and confidentiality
- Provide clear evidence for flagged activities

## Output Format
- Begin with alert severity and summary
- Provide detailed description of suspicious activity
- Include supporting evidence and detection method
- Analyze potential impact and recommended actions
- End with investigation steps and reporting requirements`;

      default:
        return `# Default Prompt Template for ${templateName}

## Core Identity
- You are the Enhanced Financial Analysis Tentacle of Aideon AI Desktop Agent.
- Your primary purpose is to provide comprehensive financial analysis and insights.
- You embody these key traits: analytical, precise, data-driven, and ethical.

## Capabilities
### Primary Functions
- Analyzing financial data from multiple sources
- Creating financial forecasts and projections
- Performing investment analysis and portfolio optimization
- Monitoring regulatory compliance
- Detecting financial fraud and anomalies

### Approach
- Always base your analysis on data, not assumptions
- Consider multiple scenarios and their probabilities
- Clearly communicate confidence levels and uncertainties
- Provide actionable insights and recommendations
- Maintain regulatory compliance and ethical standards

## Output Format
- Begin with a concise executive summary
- Provide detailed analysis with supporting data
- Include visualizations where appropriate
- End with clear, actionable recommendations
- Include relevant disclaimers and risk warnings`;
    }
  }
  
  /**
   * Handle events from services
   * @private
   * @param {Object} event - Event object
   */
  _handleServiceEvent(event) {
    this.log.debug(`Received service event: ${event.type}`);
    
    // Propagate relevant events to other services
    this.services.eventBus.publish(event.type, event.data);
    
    // Propagate relevant events to Aideon core
    if (event.propagateToCore) {
      this.eventEmitter.emit('tentacle:event', {
        source: this.config.id,
        type: event.type,
        data: event.data
      });
    }
  }
  
  /**
   * Handle events from Aideon core
   * @private
   * @param {Object} event - Event object
   */
  _handleCoreEvent(event) {
    this.log.debug(`Received core event: ${event.type}`);
    
    // Propagate relevant events to services
    if (event.targetTentacle === this.config.id || event.targetTentacle === 'all') {
      this.services.eventBus.publish(`core:${event.type}`, event.data);
    }
  }
  
  /**
   * Handle market data updates
   * @private
   * @param {Object} data - Market data update
   */
  _handleMarketDataUpdate(data) {
    this.log.debug(`Handling market data update for ${data.symbols ? data.symbols.join(', ') : 'unknown symbols'}`);
    
    // Implement market data update handling logic
    // This could include updating internal state, triggering alerts, etc.
  }
  
  /**
   * Handle trading alerts
   * @private
   * @param {Object} alert - Trading alert
   */
  _handleTradingAlert(alert) {
    this.log.info(`Trading alert: ${alert.message}`);
    
    // Implement trading alert handling logic
    // This could include notifying the user, taking automated actions, etc.
    
    // Propagate high-priority alerts to Aideon core
    if (alert.priority === 'high') {
      this.eventEmitter.emit('tentacle:alert', {
        source: this.config.id,
        type: 'trading_alert',
        data: alert
      });
    }
  }
  
  /**
   * Handle risk threshold breaches
   * @private
   * @param {Object} breach - Risk threshold breach
   */
  _handleRiskThresholdBreach(breach) {
    this.log.warn(`Risk threshold breach: ${breach.message}`);
    
    // Implement risk threshold breach handling logic
    // This could include notifying the user, taking risk mitigation actions, etc.
    
    // Propagate to Aideon core
    this.eventEmitter.emit('tentacle:alert', {
      source: this.config.id,
      type: 'risk_threshold_breach',
      data: breach
    });
  }
  
  /**
   * Handle fraud detection alerts
   * @private
   * @param {Object} alert - Fraud detection alert
   */
  _handleFraudDetectionAlert(alert) {
    this.log.warn(`Fraud detection alert: ${alert.message}`);
    
    // Implement fraud detection alert handling logic
    // This could include notifying the user, freezing accounts, etc.
    
    // Propagate to Aideon core
    this.eventEmitter.emit('tentacle:alert', {
      source: this.config.id,
      type: 'fraud_detection_alert',
      data: alert
    });
  }
  
  /**
   * Handle compliance violations
   * @private
   * @param {Object} violation - Compliance violation
   */
  _handleComplianceViolation(violation) {
    this.log.warn(`Compliance violation: ${violation.message}`);
    
    // Implement compliance violation handling logic
    // This could include notifying the user, generating reports, etc.
    
    // Propagate to Aideon core
    this.eventEmitter.emit('tentacle:alert', {
      source: this.config.id,
      type: 'compliance_violation',
      data: violation
    });
  }
  
  /**
   * Validate task
   * @private
   * @param {Object} task - Task to validate
   * @throws {Error} - If task is invalid
   */
  _validateTask(task) {
    // Check required fields
    if (!task.id) {
      throw new Error('Task ID is required');
    }
    
    if (!task.type) {
      throw new Error('Task type is required');
    }
    
    // Check if task type is supported
    if (!this.canHandleTask(task)) {
      throw new Error(`Unsupported task type: ${task.type}`);
    }
    
    // Validate task parameters based on type
    switch (task.type) {
      case 'market_data':
        if (!task.params || !task.params.source) {
          throw new Error('Market data task requires source parameter');
        }
        break;
      case 'trading':
        if (!task.params || !task.params.action) {
          throw new Error('Trading task requires action parameter');
        }
        break;
      case 'portfolio_optimization':
        if (!task.params || !task.params.assets) {
          throw new Error('Portfolio optimization task requires assets parameter');
        }
        break;
      // Add validation for other task types as needed
    }
  }
}

module.exports = EnhancedFinancialAnalysisTentacle;
