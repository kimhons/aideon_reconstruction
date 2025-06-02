/**
 * @fileoverview Tax Preparation Engine component for the Legal Tentacle
 * 
 * This component calculates tax liabilities across jurisdictions, prepares and validates
 * tax forms, optimizes deductions and credits, verifies tax law compliance, and assesses
 * audit risk, providing expert CPA-level functionality.
 * 
 * @module tentacles/legal/TaxPreparationEngine
 * @requires core/utils/Logger
 * @requires core/ml/ModelLoaderService
 */

const Logger = require('../../core/utils/Logger');
const ModelLoaderService = require('../../core/ml/ModelLoaderService');

/**
 * @class TaxPreparationEngine
 * @description Provides expert CPA-level tax preparation and optimization capabilities
 */
class TaxPreparationEngine {
  /**
   * Creates an instance of TaxPreparationEngine
   * @param {Object} options - Configuration options
   * @param {Object} options.modelServices - Model services for AI-powered features
   * @param {Object} options.storageServices - Storage services for data persistence
   * @param {Object} options.networkServices - Network services for online data retrieval
   * @param {Object} options.legalKnowledgeBase - Reference to the Legal Knowledge Base
   */
  constructor(options = {}) {
    this.logger = Logger.getLogger('TaxPreparationEngine');
    this.modelServices = options.modelServices || {};
    this.storageServices = options.storageServices || {};
    this.networkServices = options.networkServices || {};
    this.legalKnowledgeBase = options.legalKnowledgeBase;
    
    this.modelLoaderService = this.modelServices.modelLoaderService || new ModelLoaderService();
    this.taxFormTemplates = new Map();
    this.taxRateCache = new Map();
    this.deductionRuleCache = new Map();
    this.preparedReturns = new Map();
    
    this.initialized = false;
    this.offlineMode = false;
    
    this.logger.info('TaxPreparationEngine instance created');
  }
  
  /**
   * Initializes the Tax Preparation Engine
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      this.logger.info('Initializing TaxPreparationEngine');
      
      // Check network connectivity to determine mode
      this.offlineMode = !(this.networkServices.isOnline && await this.networkServices.isOnline());
      this.logger.info(`Operating in ${this.offlineMode ? 'offline' : 'online'} mode`);
      
      // Load embedded tax models
      await this.loadEmbeddedModels();
      
      // Load cached tax data from storage
      await this.loadCachedTaxData();
      
      // If online, synchronize with latest tax data
      if (!this.offlineMode) {
        await this.synchronizeTaxData();
      }
      
      this.initialized = true;
      this.logger.info('TaxPreparationEngine initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize TaxPreparationEngine: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Loads embedded tax models
   * @private
   * @async
   */
  async loadEmbeddedModels() {
    try {
      this.logger.info('Loading embedded tax models');
      
      // Load tax calculation model
      await this.modelLoaderService.preloadModel('tax-calculation', {
        type: 'ml',
        task: 'regression',
        priority: 'high'
      });
      
      // Load deduction optimization model
      await this.modelLoaderService.preloadModel('tax-deduction-optimization', {
        type: 'ml',
        task: 'optimization',
        priority: 'high'
      });
      
      // Load tax compliance verification model
      await this.modelLoaderService.preloadModel('tax-compliance-verification', {
        type: 'nlp',
        task: 'classification',
        priority: 'medium'
      });
      
      // Load audit risk assessment model
      await this.modelLoaderService.preloadModel('tax-audit-risk', {
        type: 'ml',
        task: 'classification',
        priority: 'medium'
      });
      
      this.logger.info('Embedded tax models loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Loads cached tax data from storage
   * @private
   * @async
   */
  async loadCachedTaxData() {
    try {
      this.logger.info('Loading cached tax data');
      
      if (!this.storageServices.dataStore) {
        this.logger.warn('No data store available, skipping cached tax data loading');
        return;
      }
      
      // Load tax form templates
      const templates = await this.storageServices.dataStore.get('legal:tax-form-templates');
      if (templates) {
        this.taxFormTemplates = new Map(Object.entries(templates));
        this.logger.info(`Loaded ${this.taxFormTemplates.size} tax form templates from cache`);
      }
      
      // Load tax rate cache
      const rates = await this.storageServices.dataStore.get('legal:tax-rates');
      if (rates) {
        this.taxRateCache = new Map(Object.entries(rates));
        this.logger.info(`Loaded tax rates for ${this.taxRateCache.size} jurisdictions from cache`);
      }
      
      // Load deduction rule cache
      const rules = await this.storageServices.dataStore.get('legal:deduction-rules');
      if (rules) {
        this.deductionRuleCache = new Map(Object.entries(rules));
        this.logger.info(`Loaded deduction rules for ${this.deductionRuleCache.size} jurisdictions from cache`);
      }
      
      // Load prepared returns
      const returns = await this.storageServices.dataStore.get('legal:prepared-tax-returns');
      if (returns) {
        this.preparedReturns = new Map(Object.entries(returns));
        this.logger.info(`Loaded ${this.preparedReturns.size} prepared tax returns from cache`);
      }
      
      this.logger.info('Cached tax data loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load cached tax data: ${error.message}`);
      this.logger.info('Continuing with initialization using embedded tax data only');
    }
  }
  
  /**
   * Synchronizes tax data with online sources
   * @private
   * @async
   */
  async synchronizeTaxData() {
    try {
      this.logger.info('Synchronizing tax data with online sources');
      
      if (!this.networkServices.apiClient) {
        this.logger.warn('No API client available, skipping tax data synchronization');
        return;
      }
      
      // Synchronize tax form templates
      const templatesResponse = await this.networkServices.apiClient.get('legal/tax/form-templates');
      if (templatesResponse && templatesResponse.data && templatesResponse.data.templates) {
        this.taxFormTemplates = new Map(Object.entries(templatesResponse.data.templates));
        this.logger.info(`Synchronized ${this.taxFormTemplates.size} tax form templates`);
        
        // Persist to storage
        if (this.storageServices.dataStore) {
          await this.storageServices.dataStore.set('legal:tax-form-templates', Object.fromEntries(this.taxFormTemplates));
        }
      }
      
      // Synchronize tax rates
      const ratesResponse = await this.networkServices.apiClient.get('legal/tax/rates');
      if (ratesResponse && ratesResponse.data && ratesResponse.data.rates) {
        this.taxRateCache = new Map(Object.entries(ratesResponse.data.rates));
        this.logger.info(`Synchronized tax rates for ${this.taxRateCache.size} jurisdictions`);
        
        // Persist to storage
        if (this.storageServices.dataStore) {
          await this.storageServices.dataStore.set('legal:tax-rates', Object.fromEntries(this.taxRateCache));
        }
      }
      
      // Synchronize deduction rules
      const rulesResponse = await this.networkServices.apiClient.get('legal/tax/deduction-rules');
      if (rulesResponse && rulesResponse.data && rulesResponse.data.rules) {
        this.deductionRuleCache = new Map(Object.entries(rulesResponse.data.rules));
        this.logger.info(`Synchronized deduction rules for ${this.deductionRuleCache.size} jurisdictions`);
        
        // Persist to storage
        if (this.storageServices.dataStore) {
          await this.storageServices.dataStore.set('legal:deduction-rules', Object.fromEntries(this.deductionRuleCache));
        }
      }
      
      this.logger.info('Tax data synchronized successfully');
    } catch (error) {
      this.logger.error(`Failed to synchronize tax data: ${error.message}`);
      this.logger.info('Continuing with cached tax data');
    }
  }
  
  /**
   * Calculates tax liability for financial data
   * @async
   * @param {Object} financialData - Financial data
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Tax liability calculation
   */
  async calculateTaxLiability(financialData, jurisdiction, taxYear, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Calculating tax liability for ${jurisdiction}, year ${taxYear}`);
    
    try {
      // Get tax rates and rules for this jurisdiction and year
      const taxRates = await this.getTaxRates(jurisdiction, taxYear);
      const deductionRules = await this.getDeductionRules(jurisdiction, taxYear);
      
      // Prepare calculation context
      const context = {
        jurisdiction,
        taxYear,
        taxpayerType: financialData.taxpayerType || 'individual',
        filingStatus: financialData.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Use embedded model for tax calculation
      const calculation = await this.modelLoaderService.runInference('tax-calculation', {
        financialData,
        taxRates,
        deductionRules,
        context
      });
      
      // Enhance calculation with additional metadata
      const enhancedCalculation = {
        ...calculation,
        jurisdiction,
        taxYear,
        taxpayerId: financialData.taxpayerId,
        taxpayerType: context.taxpayerType,
        filingStatus: context.filingStatus,
        timestamp: context.timestamp,
        source: 'embedded'
      };
      
      // Cache calculation if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:tax-calculation:${financialData.taxpayerId}:${jurisdiction}:${taxYear}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedCalculation, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return enhancedCalculation;
    } catch (error) {
      this.logger.error(`Failed to calculate tax liability: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Gets tax rates for a jurisdiction and tax year
   * @private
   * @async
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Tax rates
   */
  async getTaxRates(jurisdiction, taxYear) {
    const rateKey = `${jurisdiction}:${taxYear}`;
    
    // Check cache
    if (this.taxRateCache.has(rateKey)) {
      return this.taxRateCache.get(rateKey);
    }
    
    // If offline and not in cache, use embedded rates
    if (this.offlineMode) {
      // Use embedded tax rate data
      const embeddedRates = await this.getEmbeddedTaxRates(jurisdiction, taxYear);
      
      // Cache for future use
      this.taxRateCache.set(rateKey, embeddedRates);
      
      return embeddedRates;
    }
    
    // Try to fetch from online source
    if (this.networkServices.apiClient) {
      try {
        const response = await this.networkServices.apiClient.get(`legal/tax/rates/${jurisdiction}/${taxYear}`);
        
        if (response && response.data) {
          // Cache for future use
          this.taxRateCache.set(rateKey, response.data);
          
          // Persist to storage
          if (this.storageServices.dataStore) {
            const allRates = Object.fromEntries(this.taxRateCache);
            await this.storageServices.dataStore.set('legal:tax-rates', allRates);
          }
          
          return response.data;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch tax rates online: ${error.message}`);
      }
    }
    
    // Fall back to embedded rates
    const embeddedRates = await this.getEmbeddedTaxRates(jurisdiction, taxYear);
    
    // Cache for future use
    this.taxRateCache.set(rateKey, embeddedRates);
    
    return embeddedRates;
  }
  
  /**
   * Gets embedded tax rates for a jurisdiction and tax year
   * @private
   * @async
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Embedded tax rates
   */
  async getEmbeddedTaxRates(jurisdiction, taxYear) {
    // This would normally load from embedded data files
    // For now, we'll use a simplified approach with hardcoded rates for common jurisdictions
    
    const embeddedRates = {
      'US:federal': {
        2023: {
          individual: {
            brackets: [
              { min: 0, max: 11000, rate: 0.10 },
              { min: 11001, max: 44725, rate: 0.12 },
              { min: 44726, max: 95375, rate: 0.22 },
              { min: 95376, max: 182100, rate: 0.24 },
              { min: 182101, max: 231250, rate: 0.32 },
              { min: 231251, max: 578125, rate: 0.35 },
              { min: 578126, max: Infinity, rate: 0.37 }
            ],
            standardDeduction: {
              single: 13850,
              marriedJoint: 27700,
              marriedSeparate: 13850,
              headOfHousehold: 20800
            },
            personalExemption: 0
          },
          corporation: {
            rate: 0.21,
            alternativeMinimumTax: 0.15
          }
        },
        2024: {
          individual: {
            brackets: [
              { min: 0, max: 11600, rate: 0.10 },
              { min: 11601, max: 47150, rate: 0.12 },
              { min: 47151, max: 100525, rate: 0.22 },
              { min: 100526, max: 191950, rate: 0.24 },
              { min: 191951, max: 243725, rate: 0.32 },
              { min: 243726, max: 609350, rate: 0.35 },
              { min: 609351, max: Infinity, rate: 0.37 }
            ],
            standardDeduction: {
              single: 14600,
              marriedJoint: 29200,
              marriedSeparate: 14600,
              headOfHousehold: 21900
            },
            personalExemption: 0
          },
          corporation: {
            rate: 0.21,
            alternativeMinimumTax: 0.15
          }
        }
      },
      'US:CA': {
        2023: {
          individual: {
            brackets: [
              { min: 0, max: 10099, rate: 0.01 },
              { min: 10100, max: 23942, rate: 0.02 },
              { min: 23943, max: 37788, rate: 0.04 },
              { min: 37789, max: 52455, rate: 0.06 },
              { min: 52456, max: 66295, rate: 0.08 },
              { min: 66296, max: 338639, rate: 0.093 },
              { min: 338640, max: 406364, rate: 0.103 },
              { min: 406365, max: 677275, rate: 0.113 },
              { min: 677276, max: Infinity, rate: 0.123 }
            ],
            standardDeduction: {
              single: 5202,
              marriedJoint: 10404,
              marriedSeparate: 5202,
              headOfHousehold: 10404
            }
          },
          corporation: {
            rate: 0.0884
          }
        },
        2024: {
          individual: {
            brackets: [
              { min: 0, max: 10412, rate: 0.01 },
              { min: 10413, max: 24684, rate: 0.02 },
              { min: 24685, max: 38959, rate: 0.04 },
              { min: 38960, max: 54081, rate: 0.06 },
              { min: 54082, max: 68350, rate: 0.08 },
              { min: 68351, max: 349137, rate: 0.093 },
              { min: 349138, max: 418961, rate: 0.103 },
              { min: 418962, max: 698271, rate: 0.113 },
              { min: 698272, max: Infinity, rate: 0.123 }
            ],
            standardDeduction: {
              single: 5363,
              marriedJoint: 10726,
              marriedSeparate: 5363,
              headOfHousehold: 10726
            }
          },
          corporation: {
            rate: 0.0884
          }
        }
      }
    };
    
    // Get rates for the requested jurisdiction and year
    const jurisdictionRates = embeddedRates[jurisdiction];
    
    if (!jurisdictionRates) {
      throw new Error(`No embedded tax rates available for jurisdiction: ${jurisdiction}`);
    }
    
    const yearRates = jurisdictionRates[taxYear];
    
    if (!yearRates) {
      // Try to find the closest year
      const years = Object.keys(jurisdictionRates).map(Number).sort((a, b) => b - a);
      const closestYear = years.find(year => year <= taxYear);
      
      if (closestYear) {
        this.logger.warn(`No tax rates for ${taxYear}, using closest available year: ${closestYear}`);
        return {
          jurisdiction,
          taxYear: closestYear,
          rates: jurisdictionRates[closestYear],
          source: 'embedded',
          approximated: true
        };
      }
      
      throw new Error(`No embedded tax rates available for year: ${taxYear}`);
    }
    
    return {
      jurisdiction,
      taxYear,
      rates: yearRates,
      source: 'embedded',
      approximated: false
    };
  }
  
  /**
   * Gets deduction rules for a jurisdiction and tax year
   * @private
   * @async
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Deduction rules
   */
  async getDeductionRules(jurisdiction, taxYear) {
    const ruleKey = `${jurisdiction}:${taxYear}`;
    
    // Check cache
    if (this.deductionRuleCache.has(ruleKey)) {
      return this.deductionRuleCache.get(ruleKey);
    }
    
    // If offline and not in cache, use embedded rules
    if (this.offlineMode) {
      // Use embedded deduction rule data
      const embeddedRules = await this.getEmbeddedDeductionRules(jurisdiction, taxYear);
      
      // Cache for future use
      this.deductionRuleCache.set(ruleKey, embeddedRules);
      
      return embeddedRules;
    }
    
    // Try to fetch from online source
    if (this.networkServices.apiClient) {
      try {
        const response = await this.networkServices.apiClient.get(`legal/tax/deduction-rules/${jurisdiction}/${taxYear}`);
        
        if (response && response.data) {
          // Cache for future use
          this.deductionRuleCache.set(ruleKey, response.data);
          
          // Persist to storage
          if (this.storageServices.dataStore) {
            const allRules = Object.fromEntries(this.deductionRuleCache);
            await this.storageServices.dataStore.set('legal:deduction-rules', allRules);
          }
          
          return response.data;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch deduction rules online: ${error.message}`);
      }
    }
    
    // Fall back to embedded rules
    const embeddedRules = await this.getEmbeddedDeductionRules(jurisdiction, taxYear);
    
    // Cache for future use
    this.deductionRuleCache.set(ruleKey, embeddedRules);
    
    return embeddedRules;
  }
  
  /**
   * Gets embedded deduction rules for a jurisdiction and tax year
   * @private
   * @async
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Embedded deduction rules
   */
  async getEmbeddedDeductionRules(jurisdiction, taxYear) {
    // This would normally load from embedded data files
    // For now, we'll use a simplified approach with hardcoded rules for common jurisdictions
    
    const embeddedRules = {
      'US:federal': {
        2023: {
          individual: {
            itemizedDeductions: {
              medicalExpenses: {
                threshold: 0.075, // 7.5% of AGI
                description: 'Medical expenses exceeding 7.5% of AGI'
              },
              stateTaxes: {
                limit: 10000,
                description: 'State and local taxes, limited to $10,000'
              },
              mortgageInterest: {
                limit: 750000,
                description: 'Mortgage interest on loans up to $750,000'
              },
              charitableContributions: {
                limit: 0.60, // 60% of AGI
                description: 'Charitable contributions up to 60% of AGI'
              },
              casualtyLosses: {
                threshold: 0.10, // 10% of AGI
                description: 'Casualty and theft losses exceeding 10% of AGI'
              }
            },
            aboveTheLineDeductions: {
              studentLoanInterest: {
                limit: 2500,
                description: 'Student loan interest up to $2,500'
              },
              healthSavingsAccount: {
                limitIndividual: 3850,
                limitFamily: 7750,
                description: 'Health Savings Account contributions'
              },
              retirementContributions: {
                limitUnder50: 22500,
                limitOver50: 30000,
                description: '401(k) retirement contributions'
              },
              selfEmploymentTax: {
                percentage: 0.5, // 50% of self-employment tax
                description: '50% of self-employment tax'
              }
            },
            taxCredits: {
              childTaxCredit: {
                amountPerChild: 2000,
                refundableAmount: 1600,
                phaseoutStart: 200000,
                phaseoutEnd: 240000,
                description: 'Child Tax Credit'
              },
              earnedIncomeTaxCredit: {
                maxAmountNoChildren: 600,
                maxAmountOneChild: 3995,
                maxAmountTwoChildren: 6604,
                maxAmountThreePlusChildren: 7430,
                description: 'Earned Income Tax Credit'
              },
              childAndDependentCare: {
                maxExpenses: 3000,
                maxPercentage: 0.35,
                description: 'Child and Dependent Care Credit'
              },
              americanOpportunity: {
                maxAmount: 2500,
                refundableAmount: 1000,
                description: 'American Opportunity Tax Credit'
              },
              lifetimeLearning: {
                maxAmount: 2000,
                percentage: 0.20,
                description: 'Lifetime Learning Credit'
              }
            }
          },
          corporation: {
            deductions: {
              businessExpenses: {
                description: 'Ordinary and necessary business expenses'
              },
              depreciation: {
                section179Limit: 1160000,
                section179PhaseoutThreshold: 2890000,
                bonusDepreciation: 0.80, // 80% bonus depreciation
                description: 'Depreciation deductions including Section 179 and bonus depreciation'
              },
              employeeBenefits: {
                description: 'Employee benefit programs'
              },
              interestExpense: {
                limit: 0.30, // 30% of adjusted taxable income
                description: 'Business interest expense limited to 30% of adjusted taxable income'
              },
              netOperatingLoss: {
                carryforwardLimit: 0.80, // 80% of taxable income
                description: 'Net operating loss carryforwards limited to 80% of taxable income'
              }
            },
            taxCredits: {
              researchAndDevelopment: {
                percentage: 0.20, // 20% of qualified expenses
                description: 'Research and Development Tax Credit'
              },
              workOpportunity: {
                description: 'Work Opportunity Tax Credit'
              },
              smallBusinessHealthcare: {
                percentage: 0.50, // 50% of premiums
                description: 'Small Business Health Care Tax Credit'
              }
            }
          }
        },
        2024: {
          individual: {
            itemizedDeductions: {
              medicalExpenses: {
                threshold: 0.075, // 7.5% of AGI
                description: 'Medical expenses exceeding 7.5% of AGI'
              },
              stateTaxes: {
                limit: 10000,
                description: 'State and local taxes, limited to $10,000'
              },
              mortgageInterest: {
                limit: 750000,
                description: 'Mortgage interest on loans up to $750,000'
              },
              charitableContributions: {
                limit: 0.60, // 60% of AGI
                description: 'Charitable contributions up to 60% of AGI'
              },
              casualtyLosses: {
                threshold: 0.10, // 10% of AGI
                description: 'Casualty and theft losses exceeding 10% of AGI'
              }
            },
            aboveTheLineDeductions: {
              studentLoanInterest: {
                limit: 2500,
                description: 'Student loan interest up to $2,500'
              },
              healthSavingsAccount: {
                limitIndividual: 4150,
                limitFamily: 8300,
                description: 'Health Savings Account contributions'
              },
              retirementContributions: {
                limitUnder50: 23000,
                limitOver50: 30500,
                description: '401(k) retirement contributions'
              },
              selfEmploymentTax: {
                percentage: 0.5, // 50% of self-employment tax
                description: '50% of self-employment tax'
              }
            },
            taxCredits: {
              childTaxCredit: {
                amountPerChild: 2000,
                refundableAmount: 1700,
                phaseoutStart: 200000,
                phaseoutEnd: 240000,
                description: 'Child Tax Credit'
              },
              earnedIncomeTaxCredit: {
                maxAmountNoChildren: 632,
                maxAmountOneChild: 4213,
                maxAmountTwoChildren: 6960,
                maxAmountThreePlusChildren: 7830,
                description: 'Earned Income Tax Credit'
              },
              childAndDependentCare: {
                maxExpenses: 3000,
                maxPercentage: 0.35,
                description: 'Child and Dependent Care Credit'
              },
              americanOpportunity: {
                maxAmount: 2500,
                refundableAmount: 1000,
                description: 'American Opportunity Tax Credit'
              },
              lifetimeLearning: {
                maxAmount: 2000,
                percentage: 0.20,
                description: 'Lifetime Learning Credit'
              }
            }
          },
          corporation: {
            deductions: {
              businessExpenses: {
                description: 'Ordinary and necessary business expenses'
              },
              depreciation: {
                section179Limit: 1220000,
                section179PhaseoutThreshold: 3050000,
                bonusDepreciation: 0.60, // 60% bonus depreciation
                description: 'Depreciation deductions including Section 179 and bonus depreciation'
              },
              employeeBenefits: {
                description: 'Employee benefit programs'
              },
              interestExpense: {
                limit: 0.30, // 30% of adjusted taxable income
                description: 'Business interest expense limited to 30% of adjusted taxable income'
              },
              netOperatingLoss: {
                carryforwardLimit: 0.80, // 80% of taxable income
                description: 'Net operating loss carryforwards limited to 80% of taxable income'
              }
            },
            taxCredits: {
              researchAndDevelopment: {
                percentage: 0.20, // 20% of qualified expenses
                description: 'Research and Development Tax Credit'
              },
              workOpportunity: {
                description: 'Work Opportunity Tax Credit'
              },
              smallBusinessHealthcare: {
                percentage: 0.50, // 50% of premiums
                description: 'Small Business Health Care Tax Credit'
              }
            }
          }
        }
      }
    };
    
    // Get rules for the requested jurisdiction and year
    const jurisdictionRules = embeddedRules[jurisdiction];
    
    if (!jurisdictionRules) {
      throw new Error(`No embedded deduction rules available for jurisdiction: ${jurisdiction}`);
    }
    
    const yearRules = jurisdictionRules[taxYear];
    
    if (!yearRules) {
      // Try to find the closest year
      const years = Object.keys(jurisdictionRules).map(Number).sort((a, b) => b - a);
      const closestYear = years.find(year => year <= taxYear);
      
      if (closestYear) {
        this.logger.warn(`No deduction rules for ${taxYear}, using closest available year: ${closestYear}`);
        return {
          jurisdiction,
          taxYear: closestYear,
          rules: jurisdictionRules[closestYear],
          source: 'embedded',
          approximated: true
        };
      }
      
      throw new Error(`No embedded deduction rules available for year: ${taxYear}`);
    }
    
    return {
      jurisdiction,
      taxYear,
      rules: yearRules,
      source: 'embedded',
      approximated: false
    };
  }
  
  /**
   * Prepares a tax form
   * @async
   * @param {string} formId - Form identifier
   * @param {Object} data - Form data
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Prepared tax form
   */
  async prepareTaxForm(formId, data, jurisdiction, taxYear, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Preparing tax form ${formId} for ${jurisdiction}, year ${taxYear}`);
    
    try {
      // Get form template
      const template = await this.getFormTemplate(formId, jurisdiction, taxYear);
      
      // Prepare form context
      const context = {
        jurisdiction,
        taxYear,
        taxpayerType: data.taxpayerType || 'individual',
        filingStatus: data.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Validate form data against template
      const validationResult = await this.validateFormData(data, template, context);
      
      if (!validationResult.valid && !options.ignoreValidation) {
        throw new Error(`Form data validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Prepare form
      const preparedForm = {
        formId,
        jurisdiction,
        taxYear,
        taxpayerId: data.taxpayerId,
        timestamp: context.timestamp,
        data: this.processFormData(data, template),
        validation: validationResult,
        metadata: {
          preparedBy: 'TaxPreparationEngine',
          version: '1.0',
          options
        }
      };
      
      // Store prepared form
      const formKey = `${data.taxpayerId}:${jurisdiction}:${taxYear}:${formId}`;
      this.preparedReturns.set(formKey, preparedForm);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:prepared-tax-returns', Object.fromEntries(this.preparedReturns));
      }
      
      return preparedForm;
    } catch (error) {
      this.logger.error(`Failed to prepare tax form: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Gets a tax form template
   * @private
   * @async
   * @param {string} formId - Form identifier
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Form template
   */
  async getFormTemplate(formId, jurisdiction, taxYear) {
    const templateKey = `${jurisdiction}:${taxYear}:${formId}`;
    
    // Check cache
    if (this.taxFormTemplates.has(templateKey)) {
      return this.taxFormTemplates.get(templateKey);
    }
    
    // If offline and not in cache, use embedded template
    if (this.offlineMode) {
      // Use embedded form template
      const embeddedTemplate = await this.getEmbeddedFormTemplate(formId, jurisdiction, taxYear);
      
      // Cache for future use
      this.taxFormTemplates.set(templateKey, embeddedTemplate);
      
      return embeddedTemplate;
    }
    
    // Try to fetch from online source
    if (this.networkServices.apiClient) {
      try {
        const response = await this.networkServices.apiClient.get(`legal/tax/form-templates/${jurisdiction}/${taxYear}/${formId}`);
        
        if (response && response.data) {
          // Cache for future use
          this.taxFormTemplates.set(templateKey, response.data);
          
          // Persist to storage
          if (this.storageServices.dataStore) {
            const allTemplates = Object.fromEntries(this.taxFormTemplates);
            await this.storageServices.dataStore.set('legal:tax-form-templates', allTemplates);
          }
          
          return response.data;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch form template online: ${error.message}`);
      }
    }
    
    // Fall back to embedded template
    const embeddedTemplate = await this.getEmbeddedFormTemplate(formId, jurisdiction, taxYear);
    
    // Cache for future use
    this.taxFormTemplates.set(templateKey, embeddedTemplate);
    
    return embeddedTemplate;
  }
  
  /**
   * Gets an embedded tax form template
   * @private
   * @async
   * @param {string} formId - Form identifier
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @returns {Promise<Object>} Embedded form template
   */
  async getEmbeddedFormTemplate(formId, jurisdiction, taxYear) {
    // This would normally load from embedded data files
    // For now, we'll use a simplified approach with hardcoded templates for common forms
    
    const embeddedTemplates = {
      'US:federal': {
        2023: {
          '1040': {
            id: '1040',
            name: 'U.S. Individual Income Tax Return',
            sections: [
              {
                id: 'personalInfo',
                title: 'Personal Information',
                fields: [
                  { id: 'firstName', type: 'string', required: true, label: 'First Name' },
                  { id: 'lastName', type: 'string', required: true, label: 'Last Name' },
                  { id: 'ssn', type: 'string', required: true, label: 'Social Security Number', format: 'XXX-XX-XXXX' },
                  { id: 'filingStatus', type: 'enum', required: true, label: 'Filing Status', options: ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold', 'qualifyingWidow'] },
                  { id: 'address', type: 'object', required: true, label: 'Address', fields: [
                    { id: 'street', type: 'string', required: true, label: 'Street Address' },
                    { id: 'city', type: 'string', required: true, label: 'City' },
                    { id: 'state', type: 'string', required: true, label: 'State' },
                    { id: 'zip', type: 'string', required: true, label: 'ZIP Code' }
                  ]}
                ]
              },
              {
                id: 'income',
                title: 'Income',
                fields: [
                  { id: 'wages', type: 'number', required: true, label: 'Wages, salaries, tips, etc.' },
                  { id: 'interest', type: 'number', required: false, label: 'Taxable interest' },
                  { id: 'dividends', type: 'number', required: false, label: 'Ordinary dividends' },
                  { id: 'qualifiedDividends', type: 'number', required: false, label: 'Qualified dividends' },
                  { id: 'iraDistributions', type: 'number', required: false, label: 'IRA distributions' },
                  { id: 'pensions', type: 'number', required: false, label: 'Pensions and annuities' },
                  { id: 'socialSecurity', type: 'number', required: false, label: 'Social security benefits' },
                  { id: 'capitalGains', type: 'number', required: false, label: 'Capital gain or (loss)' },
                  { id: 'otherIncome', type: 'number', required: false, label: 'Other income' },
                  { id: 'totalIncome', type: 'calculated', formula: 'sum(wages, interest, dividends, iraDistributions, pensions, socialSecurity, capitalGains, otherIncome)', label: 'Total income' }
                ]
              },
              {
                id: 'adjustments',
                title: 'Adjustments to Income',
                fields: [
                  { id: 'educatorExpenses', type: 'number', required: false, label: 'Educator expenses' },
                  { id: 'businessExpenses', type: 'number', required: false, label: 'Certain business expenses' },
                  { id: 'healthSavings', type: 'number', required: false, label: 'Health savings account deduction' },
                  { id: 'movingExpenses', type: 'number', required: false, label: 'Moving expenses for members of the Armed Forces' },
                  { id: 'selfEmploymentTax', type: 'number', required: false, label: 'Deductible part of self-employment tax' },
                  { id: 'retirement', type: 'number', required: false, label: 'Self-employed SEP, SIMPLE, and qualified plans' },
                  { id: 'selfEmployedHealth', type: 'number', required: false, label: 'Self-employed health insurance deduction' },
                  { id: 'alimony', type: 'number', required: false, label: 'Alimony paid' },
                  { id: 'ira', type: 'number', required: false, label: 'IRA deduction' },
                  { id: 'studentLoanInterest', type: 'number', required: false, label: 'Student loan interest deduction' },
                  { id: 'tuition', type: 'number', required: false, label: 'Tuition and fees' },
                  { id: 'totalAdjustments', type: 'calculated', formula: 'sum(educatorExpenses, businessExpenses, healthSavings, movingExpenses, selfEmploymentTax, retirement, selfEmployedHealth, alimony, ira, studentLoanInterest, tuition)', label: 'Total adjustments' },
                  { id: 'adjustedGrossIncome', type: 'calculated', formula: 'totalIncome - totalAdjustments', label: 'Adjusted gross income' }
                ]
              },
              {
                id: 'deductions',
                title: 'Deductions',
                fields: [
                  { id: 'deductionType', type: 'enum', required: true, label: 'Deduction Type', options: ['standard', 'itemized'] },
                  { id: 'standardDeduction', type: 'calculated', formula: 'getStandardDeduction(filingStatus)', label: 'Standard deduction' },
                  { id: 'itemizedDeductions', type: 'object', required: false, label: 'Itemized Deductions', fields: [
                    { id: 'medicalExpenses', type: 'number', required: false, label: 'Medical and dental expenses' },
                    { id: 'stateTaxes', type: 'number', required: false, label: 'State and local taxes' },
                    { id: 'realEstateTaxes', type: 'number', required: false, label: 'Real estate taxes' },
                    { id: 'personalPropertyTaxes', type: 'number', required: false, label: 'Personal property taxes' },
                    { id: 'mortgageInterest', type: 'number', required: false, label: 'Home mortgage interest' },
                    { id: 'charitableContributions', type: 'number', required: false, label: 'Charitable contributions' },
                    { id: 'casualtyTheft', type: 'number', required: false, label: 'Casualty and theft losses' },
                    { id: 'otherItemized', type: 'number', required: false, label: 'Other itemized deductions' },
                    { id: 'totalItemized', type: 'calculated', formula: 'sum(medicalExpenses, stateTaxes, realEstateTaxes, personalPropertyTaxes, mortgageInterest, charitableContributions, casualtyTheft, otherItemized)', label: 'Total itemized deductions' }
                  ]},
                  { id: 'totalDeductions', type: 'calculated', formula: 'deductionType === "standard" ? standardDeduction : itemizedDeductions.totalItemized', label: 'Total deductions' },
                  { id: 'taxableIncome', type: 'calculated', formula: 'max(0, adjustedGrossIncome - totalDeductions)', label: 'Taxable income' }
                ]
              },
              {
                id: 'tax',
                title: 'Tax Computation',
                fields: [
                  { id: 'incomeTax', type: 'calculated', formula: 'calculateIncomeTax(taxableIncome, filingStatus)', label: 'Income tax' },
                  { id: 'alternativeMinimumTax', type: 'number', required: false, label: 'Alternative minimum tax' },
                  { id: 'excessAdvancePremium', type: 'number', required: false, label: 'Excess advance premium tax credit repayment' },
                  { id: 'totalTax', type: 'calculated', formula: 'sum(incomeTax, alternativeMinimumTax, excessAdvancePremium)', label: 'Total tax' }
                ]
              },
              {
                id: 'credits',
                title: 'Credits',
                fields: [
                  { id: 'foreignTaxCredit', type: 'number', required: false, label: 'Foreign tax credit' },
                  { id: 'childTaxCredit', type: 'number', required: false, label: 'Child tax credit/credit for other dependents' },
                  { id: 'educationCredits', type: 'number', required: false, label: 'Education credits' },
                  { id: 'retirementSavingsCredit', type: 'number', required: false, label: 'Retirement savings contributions credit' },
                  { id: 'childCareCredit', type: 'number', required: false, label: 'Child and dependent care credit' },
                  { id: 'residentialEnergyCredit', type: 'number', required: false, label: 'Residential energy credit' },
                  { id: 'otherCredits', type: 'number', required: false, label: 'Other credits' },
                  { id: 'totalCredits', type: 'calculated', formula: 'sum(foreignTaxCredit, childTaxCredit, educationCredits, retirementSavingsCredit, childCareCredit, residentialEnergyCredit, otherCredits)', label: 'Total credits' }
                ]
              },
              {
                id: 'otherTaxes',
                title: 'Other Taxes',
                fields: [
                  { id: 'selfEmploymentTax', type: 'number', required: false, label: 'Self-employment tax' },
                  { id: 'socialSecurityMedicareTax', type: 'number', required: false, label: 'Social security and Medicare tax on unreported tip income' },
                  { id: 'retirementPenalties', type: 'number', required: false, label: 'Additional tax on IRAs, other qualified retirement plans, etc.' },
                  { id: 'householdEmploymentTaxes', type: 'number', required: false, label: 'Household employment taxes' },
                  { id: 'repaymentCredit', type: 'number', required: false, label: 'Repayment of first-time homebuyer credit' },
                  { id: 'healthCoverageRequirements', type: 'number', required: false, label: 'Health coverage requirements' },
                  { id: 'additionalMedicareTax', type: 'number', required: false, label: 'Additional Medicare Tax' },
                  { id: 'netInvestmentIncomeTax', type: 'number', required: false, label: 'Net investment income tax' },
                  { id: 'otherTaxes', type: 'number', required: false, label: 'Other taxes' },
                  { id: 'totalOtherTaxes', type: 'calculated', formula: 'sum(selfEmploymentTax, socialSecurityMedicareTax, retirementPenalties, householdEmploymentTaxes, repaymentCredit, healthCoverageRequirements, additionalMedicareTax, netInvestmentIncomeTax, otherTaxes)', label: 'Total other taxes' }
                ]
              },
              {
                id: 'payments',
                title: 'Payments',
                fields: [
                  { id: 'federalIncomeTaxWithheld', type: 'number', required: false, label: 'Federal income tax withheld' },
                  { id: 'estimatedTaxPayments', type: 'number', required: false, label: 'Estimated tax payments and amount applied from previous year\'s return' },
                  { id: 'earnedIncomeCredit', type: 'number', required: false, label: 'Earned income credit (EIC)' },
                  { id: 'additionalChildTaxCredit', type: 'number', required: false, label: 'Additional child tax credit' },
                  { id: 'americanOpportunityCredit', type: 'number', required: false, label: 'American opportunity credit' },
                  { id: 'netPremiumTaxCredit', type: 'number', required: false, label: 'Net premium tax credit' },
                  { id: 'otherPayments', type: 'number', required: false, label: 'Other payments and refundable credits' },
                  { id: 'totalPayments', type: 'calculated', formula: 'sum(federalIncomeTaxWithheld, estimatedTaxPayments, earnedIncomeCredit, additionalChildTaxCredit, americanOpportunityCredit, netPremiumTaxCredit, otherPayments)', label: 'Total payments' }
                ]
              },
              {
                id: 'refundOrAmountOwed',
                title: 'Refund or Amount You Owe',
                fields: [
                  { id: 'totalTaxLiability', type: 'calculated', formula: 'totalTax + totalOtherTaxes - totalCredits', label: 'Total tax liability' },
                  { id: 'overpayment', type: 'calculated', formula: 'max(0, totalPayments - totalTaxLiability)', label: 'Overpayment' },
                  { id: 'amountToBeRefunded', type: 'number', required: false, label: 'Amount to be refunded to you' },
                  { id: 'amountAppliedToNextYear', type: 'number', required: false, label: 'Amount applied to next year\'s estimated tax' },
                  { id: 'amountYouOwe', type: 'calculated', formula: 'max(0, totalTaxLiability - totalPayments)', label: 'Amount you owe' },
                  { id: 'estimatedTaxPenalty', type: 'number', required: false, label: 'Estimated tax penalty' }
                ]
              }
            ],
            validations: [
              { rule: 'amountToBeRefunded + amountAppliedToNextYear <= overpayment', message: 'Refund and applied amount cannot exceed overpayment' },
              { rule: 'deductionType === "itemized" ? itemizedDeductions.totalItemized > 0 : true', message: 'Itemized deductions must be greater than zero when itemized deduction is selected' }
            ],
            source: 'embedded'
          },
          'W-2': {
            id: 'W-2',
            name: 'Wage and Tax Statement',
            sections: [
              {
                id: 'employerInfo',
                title: 'Employer Information',
                fields: [
                  { id: 'employerEIN', type: 'string', required: true, label: 'Employer\'s EIN', format: 'XX-XXXXXXX' },
                  { id: 'employerName', type: 'string', required: true, label: 'Employer\'s name' },
                  { id: 'employerAddress', type: 'object', required: true, label: 'Employer\'s address', fields: [
                    { id: 'street', type: 'string', required: true, label: 'Street Address' },
                    { id: 'city', type: 'string', required: true, label: 'City' },
                    { id: 'state', type: 'string', required: true, label: 'State' },
                    { id: 'zip', type: 'string', required: true, label: 'ZIP Code' }
                  ]}
                ]
              },
              {
                id: 'employeeInfo',
                title: 'Employee Information',
                fields: [
                  { id: 'employeeSSN', type: 'string', required: true, label: 'Employee\'s SSN', format: 'XXX-XX-XXXX' },
                  { id: 'employeeName', type: 'object', required: true, label: 'Employee\'s name', fields: [
                    { id: 'firstName', type: 'string', required: true, label: 'First Name' },
                    { id: 'lastName', type: 'string', required: true, label: 'Last Name' }
                  ]},
                  { id: 'employeeAddress', type: 'object', required: true, label: 'Employee\'s address', fields: [
                    { id: 'street', type: 'string', required: true, label: 'Street Address' },
                    { id: 'city', type: 'string', required: true, label: 'City' },
                    { id: 'state', type: 'string', required: true, label: 'State' },
                    { id: 'zip', type: 'string', required: true, label: 'ZIP Code' }
                  ]}
                ]
              },
              {
                id: 'wagesAndTaxes',
                title: 'Wages and Taxes',
                fields: [
                  { id: 'wagesTipsOtherComp', type: 'number', required: true, label: 'Wages, tips, other compensation' },
                  { id: 'federalIncomeTaxWithheld', type: 'number', required: true, label: 'Federal income tax withheld' },
                  { id: 'socialSecurityWages', type: 'number', required: true, label: 'Social security wages' },
                  { id: 'socialSecurityTaxWithheld', type: 'number', required: true, label: 'Social security tax withheld' },
                  { id: 'medicareWages', type: 'number', required: true, label: 'Medicare wages and tips' },
                  { id: 'medicareTaxWithheld', type: 'number', required: true, label: 'Medicare tax withheld' },
                  { id: 'socialSecurityTips', type: 'number', required: false, label: 'Social security tips' },
                  { id: 'allocatedTips', type: 'number', required: false, label: 'Allocated tips' },
                  { id: 'dependentCareBenefits', type: 'number', required: false, label: 'Dependent care benefits' },
                  { id: 'nonqualifiedPlans', type: 'number', required: false, label: 'Nonqualified plans' },
                  { id: 'box12', type: 'array', required: false, label: 'Box 12', items: {
                    type: 'object',
                    fields: [
                      { id: 'code', type: 'string', required: true, label: 'Code' },
                      { id: 'amount', type: 'number', required: true, label: 'Amount' }
                    ]
                  }},
                  { id: 'statutoryEmployee', type: 'boolean', required: false, label: 'Statutory employee' },
                  { id: 'retirementPlan', type: 'boolean', required: false, label: 'Retirement plan' },
                  { id: 'thirdPartySickPay', type: 'boolean', required: false, label: 'Third-party sick pay' }
                ]
              },
              {
                id: 'stateAndLocalTaxes',
                title: 'State and Local Taxes',
                fields: [
                  { id: 'stateAndLocalTaxes', type: 'array', required: false, label: 'State and Local Taxes', items: {
                    type: 'object',
                    fields: [
                      { id: 'stateCode', type: 'string', required: true, label: 'State' },
                      { id: 'stateEmployerID', type: 'string', required: true, label: 'Employer\'s state ID number' },
                      { id: 'stateWagesTips', type: 'number', required: true, label: 'State wages, tips, etc.' },
                      { id: 'stateIncomeTax', type: 'number', required: true, label: 'State income tax' },
                      { id: 'localityName', type: 'string', required: false, label: 'Locality name' },
                      { id: 'localWagesTips', type: 'number', required: false, label: 'Local wages, tips, etc.' },
                      { id: 'localIncomeTax', type: 'number', required: false, label: 'Local income tax' }
                    ]
                  }}
                ]
              }
            ],
            validations: [
              { rule: 'socialSecurityTaxWithheld === socialSecurityWages * 0.062', message: 'Social security tax withheld should be 6.2% of social security wages' },
              { rule: 'medicareTaxWithheld === medicareWages * 0.0145', message: 'Medicare tax withheld should be 1.45% of Medicare wages' }
            ],
            source: 'embedded'
          }
        },
        2024: {
          '1040': {
            id: '1040',
            name: 'U.S. Individual Income Tax Return',
            // Similar to 2023 with updated values
            source: 'embedded'
          },
          'W-2': {
            id: 'W-2',
            name: 'Wage and Tax Statement',
            // Similar to 2023
            source: 'embedded'
          }
        }
      }
    };
    
    // Get template for the requested form, jurisdiction, and year
    const jurisdictionTemplates = embeddedTemplates[jurisdiction];
    
    if (!jurisdictionTemplates) {
      throw new Error(`No embedded form templates available for jurisdiction: ${jurisdiction}`);
    }
    
    const yearTemplates = jurisdictionTemplates[taxYear];
    
    if (!yearTemplates) {
      // Try to find the closest year
      const years = Object.keys(jurisdictionTemplates).map(Number).sort((a, b) => b - a);
      const closestYear = years.find(year => year <= taxYear);
      
      if (closestYear) {
        this.logger.warn(`No form templates for ${taxYear}, using closest available year: ${closestYear}`);
        
        const formTemplate = jurisdictionTemplates[closestYear][formId];
        
        if (!formTemplate) {
          throw new Error(`No embedded form template available for form: ${formId}`);
        }
        
        return {
          ...formTemplate,
          taxYear: closestYear,
          approximated: true
        };
      }
      
      throw new Error(`No embedded form templates available for year: ${taxYear}`);
    }
    
    const formTemplate = yearTemplates[formId];
    
    if (!formTemplate) {
      throw new Error(`No embedded form template available for form: ${formId}`);
    }
    
    return {
      ...formTemplate,
      taxYear,
      approximated: false
    };
  }
  
  /**
   * Validates form data against a template
   * @private
   * @async
   * @param {Object} data - Form data
   * @param {Object} template - Form template
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Validation result
   */
  async validateFormData(data, template, context) {
    this.logger.info(`Validating form data for ${template.id}`);
    
    const errors = [];
    
    // Validate required fields
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required) {
          const value = this.getNestedValue(data, field.id);
          
          if (value === undefined || value === null || value === '') {
            errors.push(`Required field ${field.label} (${field.id}) is missing`);
          }
        }
        
        // Validate nested fields
        if (field.type === 'object' && field.fields) {
          const objValue = this.getNestedValue(data, field.id);
          
          if (objValue) {
            for (const nestedField of field.fields) {
              if (nestedField.required) {
                const nestedValue = objValue[nestedField.id];
                
                if (nestedValue === undefined || nestedValue === null || nestedValue === '') {
                  errors.push(`Required field ${field.label}.${nestedField.label} (${field.id}.${nestedField.id}) is missing`);
                }
              }
            }
          }
        }
        
        // Validate array items
        if (field.type === 'array' && field.items && field.items.fields) {
          const arrayValue = this.getNestedValue(data, field.id);
          
          if (Array.isArray(arrayValue)) {
            for (let i = 0; i < arrayValue.length; i++) {
              const item = arrayValue[i];
              
              for (const itemField of field.items.fields) {
                if (itemField.required) {
                  const itemValue = item[itemField.id];
                  
                  if (itemValue === undefined || itemValue === null || itemValue === '') {
                    errors.push(`Required field ${field.label}[${i}].${itemField.label} (${field.id}[${i}].${itemField.id}) is missing`);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Validate custom rules
    if (template.validations) {
      for (const validation of template.validations) {
        // This is a simplified approach; in a real implementation, we would use a proper expression evaluator
        try {
          const isValid = this.evaluateValidationRule(validation.rule, data);
          
          if (!isValid) {
            errors.push(validation.message);
          }
        } catch (error) {
          this.logger.warn(`Failed to evaluate validation rule: ${validation.rule}`);
          errors.push(`Validation error: ${error.message}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Evaluates a validation rule
   * @private
   * @param {string} rule - Validation rule
   * @param {Object} data - Form data
   * @returns {boolean} Validation result
   */
  evaluateValidationRule(rule, data) {
    // This is a simplified approach; in a real implementation, we would use a proper expression evaluator
    // For now, we'll just handle a few common cases
    
    if (rule.includes('<=')) {
      const [left, right] = rule.split('<=').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue <= rightValue;
    }
    
    if (rule.includes('>=')) {
      const [left, right] = rule.split('>=').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue >= rightValue;
    }
    
    if (rule.includes('===')) {
      const [left, right] = rule.split('===').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue === rightValue;
    }
    
    if (rule.includes('!==')) {
      const [left, right] = rule.split('!==').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue !== rightValue;
    }
    
    if (rule.includes('?')) {
      const [condition, thenElse] = rule.split('?').map(part => part.trim());
      const [thenPart, elsePart] = thenElse.split(':').map(part => part.trim());
      
      const conditionValue = this.evaluateExpression(condition, data);
      
      if (conditionValue) {
        return this.evaluateExpression(thenPart, data);
      } else {
        return this.evaluateExpression(elsePart, data);
      }
    }
    
    // Default case: evaluate as boolean expression
    return this.evaluateExpression(rule, data);
  }
  
  /**
   * Evaluates an expression
   * @private
   * @param {string} expression - Expression to evaluate
   * @param {Object} data - Form data
   * @returns {*} Evaluation result
   */
  evaluateExpression(expression, data) {
    // This is a simplified approach; in a real implementation, we would use a proper expression evaluator
    
    // Handle literals
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    if (expression === 'null') return null;
    if (expression === 'undefined') return undefined;
    
    // Handle numbers
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return parseFloat(expression);
    }
    
    // Handle field references
    if (/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(expression)) {
      return this.getNestedValue(data, expression);
    }
    
    // Handle simple arithmetic
    if (expression.includes('+')) {
      const [left, right] = expression.split('+').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue + rightValue;
    }
    
    if (expression.includes('-')) {
      const [left, right] = expression.split('-').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue - rightValue;
    }
    
    if (expression.includes('*')) {
      const [left, right] = expression.split('*').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue * rightValue;
    }
    
    if (expression.includes('/')) {
      const [left, right] = expression.split('/').map(part => part.trim());
      const leftValue = this.evaluateExpression(left, data);
      const rightValue = this.evaluateExpression(right, data);
      
      return leftValue / rightValue;
    }
    
    // Handle function calls
    if (expression.startsWith('max(')) {
      const args = expression.substring(4, expression.length - 1).split(',').map(arg => this.evaluateExpression(arg.trim(), data));
      return Math.max(...args);
    }
    
    if (expression.startsWith('min(')) {
      const args = expression.substring(4, expression.length - 1).split(',').map(arg => this.evaluateExpression(arg.trim(), data));
      return Math.min(...args);
    }
    
    if (expression.startsWith('sum(')) {
      const args = expression.substring(4, expression.length - 1).split(',').map(arg => this.evaluateExpression(arg.trim(), data));
      return args.reduce((sum, value) => sum + (value || 0), 0);
    }
    
    // Default: return the expression itself
    return expression;
  }
  
  /**
   * Gets a nested value from an object
   * @private
   * @param {Object} obj - Object to get value from
   * @param {string} path - Path to value
   * @returns {*} Nested value
   */
  getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }
  
  /**
   * Processes form data for submission
   * @private
   * @param {Object} data - Form data
   * @param {Object} template - Form template
   * @returns {Object} Processed form data
   */
  processFormData(data, template) {
    // Deep clone to avoid modifying the original data
    const processedData = JSON.parse(JSON.stringify(data));
    
    // Calculate fields
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.type === 'calculated' && field.formula) {
          try {
            const calculatedValue = this.evaluateExpression(field.formula, processedData);
            this.setNestedValue(processedData, field.id, calculatedValue);
          } catch (error) {
            this.logger.warn(`Failed to calculate field ${field.id}: ${error.message}`);
          }
        }
        
        // Process nested fields
        if (field.type === 'object' && field.fields) {
          const objValue = this.getNestedValue(processedData, field.id);
          
          if (objValue) {
            for (const nestedField of field.fields) {
              if (nestedField.type === 'calculated' && nestedField.formula) {
                try {
                  const calculatedValue = this.evaluateExpression(nestedField.formula, objValue);
                  objValue[nestedField.id] = calculatedValue;
                } catch (error) {
                  this.logger.warn(`Failed to calculate field ${field.id}.${nestedField.id}: ${error.message}`);
                }
              }
            }
          }
        }
      }
    }
    
    return processedData;
  }
  
  /**
   * Sets a nested value in an object
   * @private
   * @param {Object} obj - Object to set value in
   * @param {string} path - Path to value
   * @param {*} value - Value to set
   */
  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (current[part] === undefined) {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Optimizes deductions for financial data
   * @async
   * @param {Object} financialData - Financial data
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Optimized deductions
   */
  async optimizeDeductions(financialData, jurisdiction, taxYear, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Optimizing deductions for ${jurisdiction}, year ${taxYear}`);
    
    try {
      // Get tax rates and rules for this jurisdiction and year
      const taxRates = await this.getTaxRates(jurisdiction, taxYear);
      const deductionRules = await this.getDeductionRules(jurisdiction, taxYear);
      
      // Prepare optimization context
      const context = {
        jurisdiction,
        taxYear,
        taxpayerType: financialData.taxpayerType || 'individual',
        filingStatus: financialData.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Use embedded model for deduction optimization
      const optimization = await this.modelLoaderService.runInference('tax-deduction-optimization', {
        financialData,
        taxRates,
        deductionRules,
        context,
        options: {
          optimizationStrategy: options.optimizationStrategy || 'balanced',
          riskTolerance: options.riskTolerance || 'moderate',
          prioritizeCurrentYear: options.prioritizeCurrentYear !== false
        }
      });
      
      // Enhance optimization with additional metadata
      const enhancedOptimization = {
        ...optimization,
        jurisdiction,
        taxYear,
        taxpayerId: financialData.taxpayerId,
        taxpayerType: context.taxpayerType,
        filingStatus: context.filingStatus,
        timestamp: context.timestamp,
        source: 'embedded'
      };
      
      // Cache optimization if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:tax-optimization:${financialData.taxpayerId}:${jurisdiction}:${taxYear}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedOptimization, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return enhancedOptimization;
    } catch (error) {
      this.logger.error(`Failed to optimize deductions: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verifies tax law compliance for a tax return
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Compliance verification
   */
  async verifyCompliance(taxReturn, jurisdiction, taxYear, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Verifying compliance for tax return: ${taxReturn.id || 'unknown'}`);
    
    try {
      // Get tax regulations from Legal Knowledge Base if available
      let taxRegulations;
      
      if (this.legalKnowledgeBase) {
        taxRegulations = await this.legalKnowledgeBase.getTaxRegulations(jurisdiction, taxYear);
      } else {
        // Use embedded regulations
        taxRegulations = {
          jurisdiction,
          taxYear,
          regulations: (await this.getDeductionRules(jurisdiction, taxYear)).rules
        };
      }
      
      // Prepare verification context
      const context = {
        jurisdiction,
        taxYear,
        taxpayerType: taxReturn.taxpayerType || 'individual',
        filingStatus: taxReturn.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Use embedded model for compliance verification
      const verification = await this.modelLoaderService.runInference('tax-compliance-verification', {
        taxReturn,
        taxRegulations,
        context,
        options: {
          detailLevel: options.detailLevel || 'standard',
          includeReferences: options.includeReferences !== false
        }
      });
      
      // Enhance verification with additional metadata
      const enhancedVerification = {
        ...verification,
        jurisdiction,
        taxYear,
        taxpayerId: taxReturn.taxpayerId,
        taxpayerType: context.taxpayerType,
        filingStatus: context.filingStatus,
        timestamp: context.timestamp,
        source: 'embedded'
      };
      
      // Cache verification if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:tax-compliance:${taxReturn.taxpayerId}:${jurisdiction}:${taxYear}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedVerification, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return enhancedVerification;
    } catch (error) {
      this.logger.error(`Failed to verify compliance: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Assesses audit risk for a tax return
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {string} jurisdiction - Jurisdiction code
   * @param {number} taxYear - Tax year
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Audit risk assessment
   */
  async assessAuditRisk(taxReturn, jurisdiction, taxYear, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Assessing audit risk for tax return: ${taxReturn.id || 'unknown'}`);
    
    try {
      // Prepare assessment context
      const context = {
        jurisdiction,
        taxYear,
        taxpayerType: taxReturn.taxpayerType || 'individual',
        filingStatus: taxReturn.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Use embedded model for audit risk assessment
      const assessment = await this.modelLoaderService.runInference('tax-audit-risk', {
        taxReturn,
        context,
        options: {
          detailLevel: options.detailLevel || 'standard',
          includeRecommendations: options.includeRecommendations !== false
        }
      });
      
      // Enhance assessment with additional metadata
      const enhancedAssessment = {
        ...assessment,
        jurisdiction,
        taxYear,
        taxpayerId: taxReturn.taxpayerId,
        taxpayerType: context.taxpayerType,
        filingStatus: context.filingStatus,
        timestamp: context.timestamp,
        source: 'embedded'
      };
      
      // Cache assessment if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:tax-audit-risk:${taxReturn.taxpayerId}:${jurisdiction}:${taxYear}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedAssessment, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return enhancedAssessment;
    } catch (error) {
      this.logger.error(`Failed to assess audit risk: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates a tax report
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Tax report
   */
  async generateTaxReport(taxReturn, options = {}) {
    if (!this.initialized) {
      throw new Error('TaxPreparationEngine not initialized');
    }
    
    this.logger.info(`Generating tax report for return: ${taxReturn.id || 'unknown'}`);
    
    try {
      // Prepare report context
      const context = {
        jurisdiction: taxReturn.jurisdiction,
        taxYear: taxReturn.taxYear,
        taxpayerType: taxReturn.taxpayerType || 'individual',
        filingStatus: taxReturn.filingStatus || 'single',
        timestamp: new Date().toISOString(),
        options
      };
      
      // Get compliance verification if requested
      let compliance = null;
      if (options.includeCompliance) {
        try {
          compliance = await this.verifyCompliance(taxReturn, taxReturn.jurisdiction, taxReturn.taxYear, options);
        } catch (error) {
          this.logger.warn(`Failed to include compliance verification in report: ${error.message}`);
        }
      }
      
      // Get audit risk assessment if requested
      let auditRisk = null;
      if (options.includeAuditRisk) {
        try {
          auditRisk = await this.assessAuditRisk(taxReturn, taxReturn.jurisdiction, taxReturn.taxYear, options);
        } catch (error) {
          this.logger.warn(`Failed to include audit risk assessment in report: ${error.message}`);
        }
      }
      
      // Generate report content
      const reportContent = await this.generateReportContent(taxReturn, compliance, auditRisk, options);
      
      // Create report object
      const report = {
        id: `${taxReturn.taxpayerId}-${taxReturn.jurisdiction}-${taxReturn.taxYear}-${Date.now()}`,
        taxpayerId: taxReturn.taxpayerId,
        taxpayerType: taxReturn.taxpayerType,
        jurisdiction: taxReturn.jurisdiction,
        taxYear: taxReturn.taxYear,
        filingStatus: taxReturn.filingStatus,
        timestamp: context.timestamp,
        content: reportContent,
        format: options.format || 'markdown',
        metadata: {
          generatedBy: 'TaxPreparationEngine',
          version: '1.0',
          options
        }
      };
      
      // Cache report if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:tax-report:${taxReturn.taxpayerId}:${taxReturn.jurisdiction}:${taxReturn.taxYear}`;
        await this.storageServices.dataStore.set(cacheKey, report, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate tax report: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates content for a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} compliance - Compliance verification
   * @param {Object} auditRisk - Audit risk assessment
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Report content
   */
  async generateReportContent(taxReturn, compliance, auditRisk, options) {
    this.logger.info(`Generating report content for tax return: ${taxReturn.id || 'unknown'}`);
    
    // Define report sections
    const sections = [
      {
        id: 'summary',
        title: 'Executive Summary',
        content: await this.generateSummarySection(taxReturn, compliance, auditRisk, options)
      },
      {
        id: 'income',
        title: 'Income Analysis',
        content: await this.generateIncomeSection(taxReturn, options)
      },
      {
        id: 'deductions',
        title: 'Deductions and Credits',
        content: await this.generateDeductionsSection(taxReturn, options)
      },
      {
        id: 'liability',
        title: 'Tax Liability',
        content: await this.generateLiabilitySection(taxReturn, options)
      }
    ];
    
    // Add compliance section if available
    if (compliance) {
      sections.push({
        id: 'compliance',
        title: 'Compliance Analysis',
        content: await this.generateComplianceSection(taxReturn, compliance, options)
      });
    }
    
    // Add audit risk section if available
    if (auditRisk) {
      sections.push({
        id: 'auditRisk',
        title: 'Audit Risk Assessment',
        content: await this.generateAuditRiskSection(taxReturn, auditRisk, options)
      });
    }
    
    // Add recommendations section
    sections.push({
      id: 'recommendations',
      title: 'Recommendations',
      content: await this.generateRecommendationsSection(taxReturn, compliance, auditRisk, options)
    });
    
    return {
      sections,
      format: options.format || 'markdown'
    };
  }
  
  /**
   * Generates the summary section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} compliance - Compliance verification
   * @param {Object} auditRisk - Audit risk assessment
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateSummarySection(taxReturn, compliance, auditRisk, options) {
    // Use model to generate summary
    const summary = await this.modelLoaderService.generateText('tax-report-summary', {
      taxReturn,
      compliance,
      auditRisk,
      options: {
        format: options.format || 'markdown',
        maxLength: options.summaryLength || 500
      }
    });
    
    return summary;
  }
  
  /**
   * Generates the income section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateIncomeSection(taxReturn, options) {
    // Use model to generate income section
    const income = await this.modelLoaderService.generateText('tax-report-income', {
      taxReturn,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return income;
  }
  
  /**
   * Generates the deductions section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateDeductionsSection(taxReturn, options) {
    // Use model to generate deductions section
    const deductions = await this.modelLoaderService.generateText('tax-report-deductions', {
      taxReturn,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return deductions;
  }
  
  /**
   * Generates the liability section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateLiabilitySection(taxReturn, options) {
    // Use model to generate liability section
    const liability = await this.modelLoaderService.generateText('tax-report-liability', {
      taxReturn,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return liability;
  }
  
  /**
   * Generates the compliance section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} compliance - Compliance verification
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateComplianceSection(taxReturn, compliance, options) {
    // Use model to generate compliance section
    const complianceSection = await this.modelLoaderService.generateText('tax-report-compliance', {
      taxReturn,
      compliance,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return complianceSection;
  }
  
  /**
   * Generates the audit risk section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} auditRisk - Audit risk assessment
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateAuditRiskSection(taxReturn, auditRisk, options) {
    // Use model to generate audit risk section
    const auditRiskSection = await this.modelLoaderService.generateText('tax-report-audit-risk', {
      taxReturn,
      auditRisk,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return auditRiskSection;
  }
  
  /**
   * Generates the recommendations section of a tax report
   * @private
   * @async
   * @param {Object} taxReturn - Tax return
   * @param {Object} compliance - Compliance verification
   * @param {Object} auditRisk - Audit risk assessment
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateRecommendationsSection(taxReturn, compliance, auditRisk, options) {
    // Use model to generate recommendations section
    const recommendations = await this.modelLoaderService.generateText('tax-report-recommendations', {
      taxReturn,
      compliance,
      auditRisk,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard',
        includeNextYearPlanning: options.includeNextYearPlanning !== false
      }
    });
    
    return recommendations;
  }
}

module.exports = TaxPreparationEngine;
