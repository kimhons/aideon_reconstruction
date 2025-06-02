/**
 * @fileoverview Compliance Checker component for the Legal Tentacle
 * 
 * This component monitors regulatory requirements, identifies compliance gaps,
 * recommends remediation actions, generates compliance documentation, and
 * tracks regulatory updates across various legal domains.
 * 
 * @module tentacles/legal/ComplianceChecker
 * @requires core/utils/Logger
 * @requires core/ml/ModelLoaderService
 */

const Logger = require('../../core/utils/Logger');
const ModelLoaderService = require('../../core/ml/ModelLoaderService');

/**
 * @class ComplianceChecker
 * @description Monitors regulatory requirements and ensures compliance across legal domains
 */
class ComplianceChecker {
  /**
   * Creates an instance of ComplianceChecker
   * @param {Object} options - Configuration options
   * @param {Object} options.modelServices - Model services for AI-powered features
   * @param {Object} options.storageServices - Storage services for data persistence
   * @param {Object} options.networkServices - Network services for online data retrieval
   * @param {Object} options.legalKnowledgeBase - Reference to the Legal Knowledge Base
   */
  constructor(options = {}) {
    this.logger = Logger.getLogger('ComplianceChecker');
    this.modelServices = options.modelServices || {};
    this.storageServices = options.storageServices || {};
    this.networkServices = options.networkServices || {};
    this.legalKnowledgeBase = options.legalKnowledgeBase;
    
    this.modelLoaderService = this.modelServices.modelLoaderService || new ModelLoaderService();
    this.regulationStore = new Map();
    this.complianceTemplates = new Map();
    this.updateRegistry = new Map();
    
    this.initialized = false;
    this.offlineMode = false;
    
    this.logger.info('ComplianceChecker instance created');
  }
  
  /**
   * Initializes the Compliance Checker
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      this.logger.info('Initializing ComplianceChecker');
      
      // Check network connectivity to determine mode
      this.offlineMode = !(this.networkServices.isOnline && await this.networkServices.isOnline());
      this.logger.info(`Operating in ${this.offlineMode ? 'offline' : 'online'} mode`);
      
      // Load embedded compliance models
      await this.loadEmbeddedModels();
      
      // Load cached regulations from storage
      await this.loadCachedRegulations();
      
      // If online, synchronize with latest regulatory data
      if (!this.offlineMode) {
        await this.synchronizeRegulations();
      }
      
      this.initialized = true;
      this.logger.info('ComplianceChecker initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ComplianceChecker: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Loads embedded compliance models
   * @private
   * @async
   */
  async loadEmbeddedModels() {
    try {
      this.logger.info('Loading embedded compliance models');
      
      // Load compliance analysis model
      await this.modelLoaderService.preloadModel('compliance-analysis', {
        type: 'nlp',
        task: 'classification',
        priority: 'high'
      });
      
      // Load gap identification model
      await this.modelLoaderService.preloadModel('compliance-gap-identification', {
        type: 'nlp',
        task: 'extraction',
        priority: 'medium'
      });
      
      // Load remediation recommendation model
      await this.modelLoaderService.preloadModel('compliance-remediation', {
        type: 'nlp',
        task: 'generation',
        priority: 'medium'
      });
      
      this.logger.info('Embedded compliance models loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Loads cached regulations from storage
   * @private
   * @async
   */
  async loadCachedRegulations() {
    try {
      this.logger.info('Loading cached regulations');
      
      if (!this.storageServices.dataStore) {
        this.logger.warn('No data store available, skipping cached regulations loading');
        return;
      }
      
      // Load regulation store
      const regulations = await this.storageServices.dataStore.get('legal:regulations');
      if (regulations) {
        // Convert flat object to nested Map structure
        for (const [key, value] of Object.entries(regulations)) {
          const [domain, jurisdiction] = key.split(':');
          
          if (!this.regulationStore.has(domain)) {
            this.regulationStore.set(domain, new Map());
          }
          
          this.regulationStore.get(domain).set(jurisdiction, value);
        }
        
        this.logger.info(`Loaded regulations for ${this.regulationStore.size} domains from cache`);
      }
      
      // Load compliance templates
      const templates = await this.storageServices.dataStore.get('legal:compliance-templates');
      if (templates) {
        this.complianceTemplates = new Map(Object.entries(templates));
        this.logger.info(`Loaded ${this.complianceTemplates.size} compliance templates from cache`);
      }
      
      // Load update registry
      const updates = await this.storageServices.dataStore.get('legal:regulation-updates');
      if (updates) {
        this.updateRegistry = new Map(Object.entries(updates));
        this.logger.info(`Loaded ${this.updateRegistry.size} regulatory update records from cache`);
      }
      
      this.logger.info('Cached regulations loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load cached regulations: ${error.message}`);
      this.logger.info('Continuing with initialization using embedded regulations only');
    }
  }
  
  /**
   * Synchronizes regulations with online sources
   * @private
   * @async
   */
  async synchronizeRegulations() {
    try {
      this.logger.info('Synchronizing regulations with online sources');
      
      if (!this.networkServices.apiClient) {
        this.logger.warn('No API client available, skipping regulation synchronization');
        return;
      }
      
      // Get list of domains to synchronize
      const domainsResponse = await this.networkServices.apiClient.get('legal/regulations/domains');
      if (!domainsResponse || !domainsResponse.data || !domainsResponse.data.domains) {
        this.logger.warn('Invalid response from regulations API, skipping synchronization');
        return;
      }
      
      const domains = domainsResponse.data.domains;
      this.logger.info(`Synchronizing regulations for ${domains.length} domains`);
      
      // Synchronize each domain
      for (const domain of domains) {
        await this.synchronizeDomainRegulations(domain);
      }
      
      // Synchronize compliance templates
      const templatesResponse = await this.networkServices.apiClient.get('legal/compliance-templates');
      if (templatesResponse && templatesResponse.data && templatesResponse.data.templates) {
        this.complianceTemplates = new Map(Object.entries(templatesResponse.data.templates));
        this.logger.info(`Synchronized ${this.complianceTemplates.size} compliance templates`);
        
        // Persist to storage
        if (this.storageServices.dataStore) {
          await this.storageServices.dataStore.set('legal:compliance-templates', Object.fromEntries(this.complianceTemplates));
        }
      }
      
      this.logger.info('Regulations synchronized successfully');
    } catch (error) {
      this.logger.error(`Failed to synchronize regulations: ${error.message}`);
      this.logger.info('Continuing with cached regulations');
    }
  }
  
  /**
   * Synchronizes regulations for a specific domain
   * @private
   * @async
   * @param {string} domain - Regulatory domain
   */
  async synchronizeDomainRegulations(domain) {
    try {
      this.logger.info(`Synchronizing regulations for domain: ${domain}`);
      
      // Get list of jurisdictions for this domain
      const jurisdictionsResponse = await this.networkServices.apiClient.get(`legal/regulations/${domain}/jurisdictions`);
      if (!jurisdictionsResponse || !jurisdictionsResponse.data || !jurisdictionsResponse.data.jurisdictions) {
        this.logger.warn(`Invalid response for domain ${domain}, skipping`);
        return;
      }
      
      const jurisdictions = jurisdictionsResponse.data.jurisdictions;
      this.logger.info(`Synchronizing ${domain} regulations for ${jurisdictions.length} jurisdictions`);
      
      // Create domain map if it doesn't exist
      if (!this.regulationStore.has(domain)) {
        this.regulationStore.set(domain, new Map());
      }
      
      const domainMap = this.regulationStore.get(domain);
      
      // Synchronize each jurisdiction
      for (const jurisdiction of jurisdictions) {
        const regulationsResponse = await this.networkServices.apiClient.get(`legal/regulations/${domain}/${jurisdiction}`);
        if (regulationsResponse && regulationsResponse.data) {
          domainMap.set(jurisdiction, regulationsResponse.data);
          this.logger.info(`Synchronized ${domain} regulations for ${jurisdiction}`);
        }
      }
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        const flatRegulations = {};
        
        for (const [domain, jurisdictionMap] of this.regulationStore.entries()) {
          for (const [jurisdiction, regulations] of jurisdictionMap.entries()) {
            flatRegulations[`${domain}:${jurisdiction}`] = regulations;
          }
        }
        
        await this.storageServices.dataStore.set('legal:regulations', flatRegulations);
      }
    } catch (error) {
      this.logger.error(`Failed to synchronize ${domain} regulations: ${error.message}`);
    }
  }
  
  /**
   * Tracks regulatory requirements for a domain and jurisdiction
   * @async
   * @param {string} domain - Regulatory domain
   * @param {string} jurisdiction - Jurisdiction code
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Tracking result
   */
  async trackRegulations(domain, jurisdiction, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Tracking regulations for domain ${domain}, jurisdiction ${jurisdiction}`);
    
    try {
      // Check if we have regulations for this domain and jurisdiction
      if (!this.regulationStore.has(domain) || !this.regulationStore.get(domain).has(jurisdiction)) {
        if (this.offlineMode) {
          throw new Error(`Regulations for ${domain}/${jurisdiction} not found in offline data`);
        }
        
        // Try to fetch from online source
        if (this.networkServices.apiClient) {
          const response = await this.networkServices.apiClient.get(`legal/regulations/${domain}/${jurisdiction}`);
          
          if (response && response.data) {
            // Store the regulations
            if (!this.regulationStore.has(domain)) {
              this.regulationStore.set(domain, new Map());
            }
            
            this.regulationStore.get(domain).set(jurisdiction, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              const flatRegulations = {};
              
              for (const [d, jurisdictionMap] of this.regulationStore.entries()) {
                for (const [j, regulations] of jurisdictionMap.entries()) {
                  flatRegulations[`${d}:${j}`] = regulations;
                }
              }
              
              await this.storageServices.dataStore.set('legal:regulations', flatRegulations);
            }
          } else {
            throw new Error(`Regulations for ${domain}/${jurisdiction} not found`);
          }
        } else {
          throw new Error(`Regulations for ${domain}/${jurisdiction} not found and no online access`);
        }
      }
      
      // Get the regulations
      const regulations = this.regulationStore.get(domain).get(jurisdiction);
      
      // Register for updates if requested
      if (options.registerForUpdates) {
        await this.registerForUpdates(domain, jurisdiction, options);
      }
      
      return {
        domain,
        jurisdiction,
        regulations,
        tracked: true,
        updateRegistration: options.registerForUpdates || false
      };
    } catch (error) {
      this.logger.error(`Failed to track regulations: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Analyzes compliance status for an entity
   * @async
   * @param {Object} entityData - Entity data to analyze
   * @param {Object} regulations - Regulations to check against
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Compliance analysis
   */
  async analyzeCompliance(entityData, regulations, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Analyzing compliance for entity: ${entityData.id || 'unknown'}`);
    
    try {
      // Prepare analysis context
      const context = {
        entityType: entityData.type || 'unknown',
        domain: regulations.domain,
        jurisdiction: regulations.jurisdiction,
        timestamp: new Date().toISOString(),
        options
      };
      
      // Use embedded model for compliance analysis
      const analysis = await this.modelLoaderService.runInference('compliance-analysis', {
        entityData,
        regulations: regulations.regulations,
        context
      });
      
      // Enhance analysis with additional metadata
      const enhancedAnalysis = {
        ...analysis,
        entityId: entityData.id,
        entityType: entityData.type,
        domain: regulations.domain,
        jurisdiction: regulations.jurisdiction,
        timestamp: context.timestamp,
        source: 'embedded'
      };
      
      // Cache analysis if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:compliance:${entityData.id}:${regulations.domain}:${regulations.jurisdiction}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedAnalysis, {
          expiration: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
      }
      
      return enhancedAnalysis;
    } catch (error) {
      this.logger.error(`Failed to analyze compliance: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Identifies compliance gaps from analysis
   * @async
   * @param {Object} complianceAnalysis - Compliance analysis
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Identified gaps
   */
  async identifyGaps(complianceAnalysis, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Identifying compliance gaps for entity: ${complianceAnalysis.entityId || 'unknown'}`);
    
    try {
      // Use embedded model for gap identification
      const gaps = await this.modelLoaderService.runInference('compliance-gap-identification', {
        analysis: complianceAnalysis,
        options
      });
      
      // Enhance gaps with additional metadata
      const enhancedGaps = {
        ...gaps,
        entityId: complianceAnalysis.entityId,
        domain: complianceAnalysis.domain,
        jurisdiction: complianceAnalysis.jurisdiction,
        timestamp: new Date().toISOString(),
        analysisTimestamp: complianceAnalysis.timestamp,
        source: 'embedded'
      };
      
      // Cache gaps if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:compliance-gaps:${complianceAnalysis.entityId}:${complianceAnalysis.domain}:${complianceAnalysis.jurisdiction}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedGaps, {
          expiration: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
      }
      
      return enhancedGaps;
    } catch (error) {
      this.logger.error(`Failed to identify compliance gaps: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Recommends remediation actions for compliance gaps
   * @async
   * @param {Object} gaps - Identified compliance gaps
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Remediation recommendations
   */
  async recommendRemediation(gaps, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Recommending remediation for entity: ${gaps.entityId || 'unknown'}`);
    
    try {
      // Use embedded model for remediation recommendations
      const remediation = await this.modelLoaderService.runInference('compliance-remediation', {
        gaps,
        options
      });
      
      // Enhance remediation with additional metadata
      const enhancedRemediation = {
        ...remediation,
        entityId: gaps.entityId,
        domain: gaps.domain,
        jurisdiction: gaps.jurisdiction,
        timestamp: new Date().toISOString(),
        gapsTimestamp: gaps.timestamp,
        source: 'embedded'
      };
      
      // Cache remediation if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:compliance-remediation:${gaps.entityId}:${gaps.domain}:${gaps.jurisdiction}`;
        await this.storageServices.dataStore.set(cacheKey, enhancedRemediation, {
          expiration: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
      }
      
      return enhancedRemediation;
    } catch (error) {
      this.logger.error(`Failed to recommend remediation: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates a compliance report
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Compliance report
   */
  async generateComplianceReport(entityData, analysis, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Generating compliance report for entity: ${entityData.id || 'unknown'}`);
    
    try {
      // Get template for this domain and report type
      const templateKey = `${analysis.domain}:${options.reportType || 'standard'}`;
      let template = this.complianceTemplates.get(templateKey);
      
      if (!template) {
        // Use default template
        template = this.complianceTemplates.get('default:standard');
        
        if (!template) {
          // Create basic template
          template = {
            sections: [
              {
                id: 'summary',
                title: 'Executive Summary',
                content: 'Summary of compliance status and key findings.'
              },
              {
                id: 'details',
                title: 'Compliance Details',
                content: 'Detailed analysis of compliance status for each requirement.'
              },
              {
                id: 'gaps',
                title: 'Compliance Gaps',
                content: 'Identified gaps in compliance and their severity.'
              },
              {
                id: 'remediation',
                title: 'Remediation Recommendations',
                content: 'Recommended actions to address compliance gaps.'
              },
              {
                id: 'conclusion',
                title: 'Conclusion',
                content: 'Overall compliance assessment and next steps.'
              }
            ],
            metadata: {
              version: '1.0',
              type: 'standard',
              domain: 'default'
            }
          };
        }
      }
      
      // Generate report content
      const reportContent = await this.generateReportContent(entityData, analysis, template, options);
      
      // Create report object
      const report = {
        id: `${entityData.id}-${analysis.domain}-${analysis.jurisdiction}-${Date.now()}`,
        entityId: entityData.id,
        entityType: entityData.type,
        domain: analysis.domain,
        jurisdiction: analysis.jurisdiction,
        timestamp: new Date().toISOString(),
        analysisTimestamp: analysis.timestamp,
        template: templateKey,
        content: reportContent,
        format: options.format || 'markdown',
        metadata: {
          generatedBy: 'ComplianceChecker',
          version: '1.0',
          options
        }
      };
      
      // Cache report if storage is available
      if (this.storageServices.dataStore) {
        const cacheKey = `legal:compliance-report:${entityData.id}:${analysis.domain}:${analysis.jurisdiction}`;
        await this.storageServices.dataStore.set(cacheKey, report, {
          expiration: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
      }
      
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate compliance report: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates content for a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} template - Report template
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Report content
   */
  async generateReportContent(entityData, analysis, template, options) {
    this.logger.info(`Generating report content using template: ${template.metadata.type}`);
    
    // Get gaps if available
    let gaps = null;
    if (this.storageServices.dataStore) {
      const gapsKey = `legal:compliance-gaps:${entityData.id}:${analysis.domain}:${analysis.jurisdiction}`;
      gaps = await this.storageServices.dataStore.get(gapsKey);
    }
    
    // Get remediation if available
    let remediation = null;
    if (gaps && this.storageServices.dataStore) {
      const remediationKey = `legal:compliance-remediation:${entityData.id}:${analysis.domain}:${analysis.jurisdiction}`;
      remediation = await this.storageServices.dataStore.get(remediationKey);
    }
    
    // Generate content for each section
    const content = {};
    
    for (const section of template.sections) {
      switch (section.id) {
        case 'summary':
          content[section.id] = await this.generateSummarySection(entityData, analysis, options);
          break;
          
        case 'details':
          content[section.id] = await this.generateDetailsSection(entityData, analysis, options);
          break;
          
        case 'gaps':
          content[section.id] = await this.generateGapsSection(entityData, analysis, gaps, options);
          break;
          
        case 'remediation':
          content[section.id] = await this.generateRemediationSection(entityData, analysis, gaps, remediation, options);
          break;
          
        case 'conclusion':
          content[section.id] = await this.generateConclusionSection(entityData, analysis, gaps, remediation, options);
          break;
          
        default:
          // Custom section
          content[section.id] = section.content;
          break;
      }
    }
    
    return {
      sections: template.sections.map(section => ({
        id: section.id,
        title: section.title,
        content: content[section.id]
      })),
      format: options.format || 'markdown'
    };
  }
  
  /**
   * Generates the summary section of a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateSummarySection(entityData, analysis, options) {
    // Use model to generate summary
    const summary = await this.modelLoaderService.generateText('compliance-report-summary', {
      entityData,
      analysis,
      options: {
        format: options.format || 'markdown',
        maxLength: options.summaryLength || 500
      }
    });
    
    return summary;
  }
  
  /**
   * Generates the details section of a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateDetailsSection(entityData, analysis, options) {
    // Use model to generate details
    const details = await this.modelLoaderService.generateText('compliance-report-details', {
      entityData,
      analysis,
      options: {
        format: options.format || 'markdown',
        detailLevel: options.detailLevel || 'standard'
      }
    });
    
    return details;
  }
  
  /**
   * Generates the gaps section of a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} gaps - Compliance gaps
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateGapsSection(entityData, analysis, gaps, options) {
    // If gaps not provided, identify them
    if (!gaps) {
      gaps = await this.identifyGaps(analysis, options);
    }
    
    // Use model to generate gaps section
    const gapsContent = await this.modelLoaderService.generateText('compliance-report-gaps', {
      entityData,
      analysis,
      gaps,
      options: {
        format: options.format || 'markdown',
        severityThreshold: options.severityThreshold || 'low'
      }
    });
    
    return gapsContent;
  }
  
  /**
   * Generates the remediation section of a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} gaps - Compliance gaps
   * @param {Object} remediation - Remediation recommendations
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateRemediationSection(entityData, analysis, gaps, remediation, options) {
    // If gaps not provided, identify them
    if (!gaps) {
      gaps = await this.identifyGaps(analysis, options);
    }
    
    // If remediation not provided, generate it
    if (!remediation) {
      remediation = await this.recommendRemediation(gaps, options);
    }
    
    // Use model to generate remediation section
    const remediationContent = await this.modelLoaderService.generateText('compliance-report-remediation', {
      entityData,
      analysis,
      gaps,
      remediation,
      options: {
        format: options.format || 'markdown',
        priorityThreshold: options.priorityThreshold || 'low'
      }
    });
    
    return remediationContent;
  }
  
  /**
   * Generates the conclusion section of a compliance report
   * @private
   * @async
   * @param {Object} entityData - Entity data
   * @param {Object} analysis - Compliance analysis
   * @param {Object} gaps - Compliance gaps
   * @param {Object} remediation - Remediation recommendations
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Section content
   */
  async generateConclusionSection(entityData, analysis, gaps, remediation, options) {
    // Use model to generate conclusion
    const conclusion = await this.modelLoaderService.generateText('compliance-report-conclusion', {
      entityData,
      analysis,
      gaps,
      remediation,
      options: {
        format: options.format || 'markdown',
        maxLength: options.conclusionLength || 300
      }
    });
    
    return conclusion;
  }
  
  /**
   * Monitors regulatory updates for a domain and jurisdiction
   * @async
   * @param {string} domain - Regulatory domain
   * @param {string} jurisdiction - Jurisdiction code
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Monitoring result
   */
  async monitorUpdates(domain, jurisdiction, options = {}) {
    if (!this.initialized) {
      throw new Error('ComplianceChecker not initialized');
    }
    
    this.logger.info(`Monitoring updates for domain ${domain}, jurisdiction ${jurisdiction}`);
    
    try {
      // Register for updates
      await this.registerForUpdates(domain, jurisdiction, options);
      
      // Check for updates
      const updates = await this.checkForUpdates(domain, jurisdiction, options);
      
      return {
        domain,
        jurisdiction,
        monitoring: true,
        updates,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to monitor updates: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Registers for regulatory updates
   * @private
   * @async
   * @param {string} domain - Regulatory domain
   * @param {string} jurisdiction - Jurisdiction code
   * @param {Object} options - Registration options
   * @returns {Promise<Object>} Registration result
   */
  async registerForUpdates(domain, jurisdiction, options) {
    this.logger.info(`Registering for updates: ${domain}/${jurisdiction}`);
    
    const updateKey = `${domain}:${jurisdiction}`;
    
    // Create or update registration
    const registration = {
      domain,
      jurisdiction,
      registeredAt: new Date().toISOString(),
      lastChecked: null,
      lastUpdated: null,
      notificationEmail: options.notificationEmail,
      notificationFrequency: options.notificationFrequency || 'weekly',
      active: true
    };
    
    this.updateRegistry.set(updateKey, registration);
    
    // Persist to storage
    if (this.storageServices.dataStore) {
      await this.storageServices.dataStore.set('legal:regulation-updates', Object.fromEntries(this.updateRegistry));
    }
    
    // Register with online service if available
    if (!this.offlineMode && this.networkServices.apiClient && options.registerOnline !== false) {
      try {
        await this.networkServices.apiClient.post('legal/regulations/register-updates', {
          domain,
          jurisdiction,
          options
        });
      } catch (error) {
        this.logger.warn(`Failed to register for online updates: ${error.message}`);
      }
    }
    
    return {
      domain,
      jurisdiction,
      registered: true,
      registeredAt: registration.registeredAt
    };
  }
  
  /**
   * Checks for regulatory updates
   * @private
   * @async
   * @param {string} domain - Regulatory domain
   * @param {string} jurisdiction - Jurisdiction code
   * @param {Object} options - Check options
   * @returns {Promise<Array>} Updates
   */
  async checkForUpdates(domain, jurisdiction, options) {
    this.logger.info(`Checking for updates: ${domain}/${jurisdiction}`);
    
    const updateKey = `${domain}:${jurisdiction}`;
    const registration = this.updateRegistry.get(updateKey);
    
    if (!registration) {
      throw new Error(`No update registration found for ${domain}/${jurisdiction}`);
    }
    
    // Update last checked timestamp
    registration.lastChecked = new Date().toISOString();
    this.updateRegistry.set(updateKey, registration);
    
    // Persist to storage
    if (this.storageServices.dataStore) {
      await this.storageServices.dataStore.set('legal:regulation-updates', Object.fromEntries(this.updateRegistry));
    }
    
    // Check for updates online if available
    if (!this.offlineMode && this.networkServices.apiClient) {
      try {
        const response = await this.networkServices.apiClient.get(`legal/regulations/${domain}/${jurisdiction}/updates`, {
          params: {
            since: registration.lastUpdated || registration.registeredAt
          }
        });
        
        if (response && response.data && response.data.updates) {
          // If updates found, update the regulations
          if (response.data.updates.length > 0) {
            // Get the current regulations
            if (!this.regulationStore.has(domain)) {
              this.regulationStore.set(domain, new Map());
            }
            
            const domainMap = this.regulationStore.get(domain);
            const currentRegs = domainMap.get(jurisdiction) || {};
            
            // Apply updates
            const updatedRegs = { ...currentRegs };
            
            for (const update of response.data.updates) {
              if (update.action === 'add' || update.action === 'update') {
                updatedRegs[update.code] = update.regulation;
              } else if (update.action === 'delete') {
                delete updatedRegs[update.code];
              }
            }
            
            // Store updated regulations
            domainMap.set(jurisdiction, updatedRegs);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              const flatRegulations = {};
              
              for (const [d, jurisdictionMap] of this.regulationStore.entries()) {
                for (const [j, regulations] of jurisdictionMap.entries()) {
                  flatRegulations[`${d}:${j}`] = regulations;
                }
              }
              
              await this.storageServices.dataStore.set('legal:regulations', flatRegulations);
            }
            
            // Update last updated timestamp
            registration.lastUpdated = new Date().toISOString();
            this.updateRegistry.set(updateKey, registration);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:regulation-updates', Object.fromEntries(this.updateRegistry));
            }
          }
          
          return response.data.updates;
        }
      } catch (error) {
        this.logger.warn(`Failed to check for online updates: ${error.message}`);
      }
    }
    
    // No updates or offline
    return [];
  }
}

module.exports = ComplianceChecker;
