/**
 * @fileoverview Legal Research Assistant component for the Legal Tentacle
 * 
 * This component provides advanced legal research capabilities, including case law search,
 * statute lookup, regulatory analysis, and legal citation management. It supports both
 * online and offline operation with embedded legal knowledge.
 * 
 * @module tentacles/legal/LegalResearchAssistant
 * @requires core/utils/Logger
 * @requires core/ml/ModelLoaderService
 */

const Logger = require('../../core/utils/Logger');
const ModelLoaderService = require('../../core/ml/ModelLoaderService');

/**
 * @class LegalResearchAssistant
 * @description Provides advanced legal research capabilities with attorney-level analysis
 */
class LegalResearchAssistant {
  /**
   * Creates an instance of LegalResearchAssistant
   * @param {Object} options - Configuration options
   * @param {Object} options.modelServices - Model services for AI-powered features
   * @param {Object} options.storageServices - Storage services for data persistence
   * @param {Object} options.networkServices - Network services for online data retrieval
   * @param {Object} options.legalKnowledgeBase - Reference to the Legal Knowledge Base
   */
  constructor(options = {}) {
    this.logger = Logger.getLogger('LegalResearchAssistant');
    this.modelServices = options.modelServices || {};
    this.storageServices = options.storageServices || {};
    this.networkServices = options.networkServices || {};
    this.legalKnowledgeBase = options.legalKnowledgeBase;
    
    this.modelLoaderService = this.modelServices.modelLoaderService || new ModelLoaderService();
    this.researchCache = new Map();
    this.citationCache = new Map();
    this.searchHistory = new Map();
    
    this.initialized = false;
    this.offlineMode = false;
    
    this.logger.info('LegalResearchAssistant instance created');
  }
  
  /**
   * Initializes the Legal Research Assistant
   * @async
   * @returns {Promise<boolean>} Initialization success status
   */
  async initialize() {
    try {
      this.logger.info('Initializing LegalResearchAssistant');
      
      // Check network connectivity to determine mode
      this.offlineMode = !(this.networkServices.isOnline && await this.networkServices.isOnline());
      this.logger.info(`Operating in ${this.offlineMode ? 'offline' : 'online'} mode`);
      
      // Load embedded research models
      await this.loadEmbeddedModels();
      
      // Load cached research data from storage
      await this.loadCachedData();
      
      // If online, synchronize with latest research data
      if (!this.offlineMode) {
        await this.synchronizeData();
      }
      
      this.initialized = true;
      this.logger.info('LegalResearchAssistant initialized successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize LegalResearchAssistant: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Loads embedded research models
   * @private
   * @async
   */
  async loadEmbeddedModels() {
    try {
      this.logger.info('Loading embedded research models');
      
      // Load case law analysis model
      await this.modelLoaderService.preloadModel('legal-case-analysis', {
        type: 'nlp',
        task: 'analysis',
        priority: 'high'
      });
      
      // Load statute interpretation model
      await this.modelLoaderService.preloadModel('legal-statute-interpretation', {
        type: 'nlp',
        task: 'analysis',
        priority: 'high'
      });
      
      // Load legal citation model
      await this.modelLoaderService.preloadModel('legal-citation-extraction', {
        type: 'nlp',
        task: 'extraction',
        priority: 'medium'
      });
      
      this.logger.info('Embedded research models loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Loads cached data from storage
   * @private
   * @async
   */
  async loadCachedData() {
    try {
      this.logger.info('Loading cached research data');
      
      if (!this.storageServices.dataStore) {
        this.logger.warn('No data store available, skipping cached data loading');
        return;
      }
      
      // Load research cache
      const researchData = await this.storageServices.dataStore.get('legal:research-cache');
      if (researchData) {
        this.researchCache = new Map(Object.entries(researchData));
        this.logger.info(`Loaded ${this.researchCache.size} research items from cache`);
      }
      
      // Load citation cache
      const citationData = await this.storageServices.dataStore.get('legal:citation-cache');
      if (citationData) {
        this.citationCache = new Map(Object.entries(citationData));
        this.logger.info(`Loaded ${this.citationCache.size} citations from cache`);
      }
      
      // Load search history
      const historyData = await this.storageServices.dataStore.get('legal:search-history');
      if (historyData) {
        this.searchHistory = new Map(Object.entries(historyData));
        this.logger.info(`Loaded ${this.searchHistory.size} search history items from cache`);
      }
      
      this.logger.info('Cached research data loaded successfully');
    } catch (error) {
      this.logger.error(`Failed to load cached data: ${error.message}`);
      this.logger.info('Continuing with initialization using embedded data only');
    }
  }
  
  /**
   * Synchronizes data with online sources
   * @private
   * @async
   */
  async synchronizeData() {
    try {
      this.logger.info('Synchronizing research data with online sources');
      
      if (!this.networkServices.apiClient) {
        this.logger.warn('No API client available, skipping data synchronization');
        return;
      }
      
      // Synchronize frequently used citations
      const citationsResponse = await this.networkServices.apiClient.get('legal/research/citations/frequent');
      if (citationsResponse && citationsResponse.data && citationsResponse.data.citations) {
        for (const [key, value] of Object.entries(citationsResponse.data.citations)) {
          this.citationCache.set(key, value);
        }
        this.logger.info(`Synchronized ${Object.keys(citationsResponse.data.citations).length} frequent citations`);
        
        // Persist to storage
        if (this.storageServices.dataStore) {
          await this.storageServices.dataStore.set('legal:citation-cache', Object.fromEntries(this.citationCache));
        }
      }
      
      this.logger.info('Research data synchronized successfully');
    } catch (error) {
      this.logger.error(`Failed to synchronize research data: ${error.message}`);
      this.logger.info('Continuing with cached data');
    }
  }
  
  /**
   * Searches for case law based on query parameters
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Search results
   */
  async searchCaseLaw(query, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Searching case law with query: ${JSON.stringify(query)}`);
    
    try {
      // Generate cache key
      const cacheKey = `case-law:${JSON.stringify(query)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached case law search result for query: ${JSON.stringify(query)}`);
        
        // Record in search history
        await this.recordSearchHistory('case-law', query, cachedResult.results.length);
        
        return cachedResult;
      }
      
      // If online, search using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/case-law', {
            query,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            // Record in search history
            await this.recordSearchHistory('case-law', query, response.data.results.length);
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to search case law online: ${error.message}`);
        }
      }
      
      // Fall back to embedded search
      const embeddedResult = await this.searchEmbeddedCaseLaw(query, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      // Record in search history
      await this.recordSearchHistory('case-law', query, embeddedResult.results.length);
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to search case law: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Searches embedded case law database
   * @private
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchEmbeddedCaseLaw(query, options) {
    this.logger.info(`Searching embedded case law with query: ${JSON.stringify(query)}`);
    
    try {
      // Use embedded model for case law search
      const searchResult = await this.modelLoaderService.runInference('legal-case-analysis', {
        task: 'search',
        query,
        options
      });
      
      // Enhance search result with metadata
      const enhancedResult = {
        ...searchResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        query
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to search embedded case law: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Searches for statutes based on query parameters
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Search results
   */
  async searchStatutes(query, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Searching statutes with query: ${JSON.stringify(query)}`);
    
    try {
      // Generate cache key
      const cacheKey = `statute:${JSON.stringify(query)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached statute search result for query: ${JSON.stringify(query)}`);
        
        // Record in search history
        await this.recordSearchHistory('statute', query, cachedResult.results.length);
        
        return cachedResult;
      }
      
      // If online, search using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/statutes', {
            query,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            // Record in search history
            await this.recordSearchHistory('statute', query, response.data.results.length);
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to search statutes online: ${error.message}`);
        }
      }
      
      // Fall back to embedded search
      const embeddedResult = await this.searchEmbeddedStatutes(query, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      // Record in search history
      await this.recordSearchHistory('statute', query, embeddedResult.results.length);
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to search statutes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Searches embedded statute database
   * @private
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchEmbeddedStatutes(query, options) {
    this.logger.info(`Searching embedded statutes with query: ${JSON.stringify(query)}`);
    
    try {
      // Use embedded model for statute search
      const searchResult = await this.modelLoaderService.runInference('legal-statute-interpretation', {
        task: 'search',
        query,
        options
      });
      
      // Enhance search result with metadata
      const enhancedResult = {
        ...searchResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        query
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to search embedded statutes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Searches for regulations based on query parameters
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Search results
   */
  async searchRegulations(query, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Searching regulations with query: ${JSON.stringify(query)}`);
    
    try {
      // Generate cache key
      const cacheKey = `regulation:${JSON.stringify(query)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached regulation search result for query: ${JSON.stringify(query)}`);
        
        // Record in search history
        await this.recordSearchHistory('regulation', query, cachedResult.results.length);
        
        return cachedResult;
      }
      
      // If online, search using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/regulations', {
            query,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            // Record in search history
            await this.recordSearchHistory('regulation', query, response.data.results.length);
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to search regulations online: ${error.message}`);
        }
      }
      
      // Fall back to embedded search
      const embeddedResult = await this.searchEmbeddedRegulations(query, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      // Record in search history
      await this.recordSearchHistory('regulation', query, embeddedResult.results.length);
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to search regulations: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Searches embedded regulation database
   * @private
   * @async
   * @param {Object} query - Search query parameters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchEmbeddedRegulations(query, options) {
    this.logger.info(`Searching embedded regulations with query: ${JSON.stringify(query)}`);
    
    try {
      // Use embedded model for regulation search
      const searchResult = await this.modelLoaderService.runInference('legal-statute-interpretation', {
        task: 'search-regulations',
        query,
        options
      });
      
      // Enhance search result with metadata
      const enhancedResult = {
        ...searchResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        query
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to search embedded regulations: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Analyzes a legal case
   * @async
   * @param {Object} caseData - Case data to analyze
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeCase(caseData, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Analyzing case: ${caseData.title || caseData.id}`);
    
    try {
      // Generate cache key
      const cacheKey = `case-analysis:${caseData.id || JSON.stringify(caseData)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached case analysis for: ${caseData.title || caseData.id}`);
        return cachedResult;
      }
      
      // If online, analyze using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/analyze-case', {
            caseData,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to analyze case online: ${error.message}`);
        }
      }
      
      // Fall back to embedded analysis
      const embeddedResult = await this.analyzeEmbeddedCase(caseData, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to analyze case: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Analyzes a case using embedded models
   * @private
   * @async
   * @param {Object} caseData - Case data to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeEmbeddedCase(caseData, options) {
    this.logger.info(`Analyzing case using embedded models: ${caseData.title || caseData.id}`);
    
    try {
      // Use embedded model for case analysis
      const analysisResult = await this.modelLoaderService.runInference('legal-case-analysis', {
        task: 'analyze',
        caseData,
        options
      });
      
      // Enhance analysis result with metadata
      const enhancedResult = {
        ...analysisResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        caseId: caseData.id
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to analyze case using embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Interprets a statute
   * @async
   * @param {Object} statuteData - Statute data to interpret
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Interpretation result
   */
  async interpretStatute(statuteData, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Interpreting statute: ${statuteData.title || statuteData.id}`);
    
    try {
      // Generate cache key
      const cacheKey = `statute-interpretation:${statuteData.id || JSON.stringify(statuteData)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached statute interpretation for: ${statuteData.title || statuteData.id}`);
        return cachedResult;
      }
      
      // If online, interpret using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/interpret-statute', {
            statuteData,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to interpret statute online: ${error.message}`);
        }
      }
      
      // Fall back to embedded interpretation
      const embeddedResult = await this.interpretEmbeddedStatute(statuteData, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to interpret statute: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Interprets a statute using embedded models
   * @private
   * @async
   * @param {Object} statuteData - Statute data to interpret
   * @param {Object} options - Interpretation options
   * @returns {Promise<Object>} Interpretation result
   */
  async interpretEmbeddedStatute(statuteData, options) {
    this.logger.info(`Interpreting statute using embedded models: ${statuteData.title || statuteData.id}`);
    
    try {
      // Use embedded model for statute interpretation
      const interpretationResult = await this.modelLoaderService.runInference('legal-statute-interpretation', {
        task: 'interpret',
        statuteData,
        options
      });
      
      // Enhance interpretation result with metadata
      const enhancedResult = {
        ...interpretationResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        statuteId: statuteData.id
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to interpret statute using embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extracts citations from text
   * @async
   * @param {string} text - Text to extract citations from
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Extraction result
   */
  async extractCitations(text, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Extracting citations from text (${text.length} characters)`);
    
    try {
      // Generate cache key
      const cacheKey = `citation-extraction:${this.generateHashForText(text)}`;
      
      // Check cache
      if (this.researchCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.researchCache.get(cacheKey);
        this.logger.info(`Returning cached citation extraction result`);
        return cachedResult;
      }
      
      // If online, extract using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/extract-citations', {
            text,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.researchCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
            }
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to extract citations online: ${error.message}`);
        }
      }
      
      // Fall back to embedded extraction
      const embeddedResult = await this.extractEmbeddedCitations(text, options);
      
      // Cache result
      this.researchCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:research-cache', Object.fromEntries(this.researchCache));
      }
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to extract citations: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extracts citations using embedded models
   * @private
   * @async
   * @param {string} text - Text to extract citations from
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result
   */
  async extractEmbeddedCitations(text, options) {
    this.logger.info(`Extracting citations using embedded models (${text.length} characters)`);
    
    try {
      // Use embedded model for citation extraction
      const extractionResult = await this.modelLoaderService.runInference('legal-citation-extraction', {
        task: 'extract',
        text,
        options
      });
      
      // Enhance extraction result with metadata
      const enhancedResult = {
        ...extractionResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        textLength: text.length
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to extract citations using embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Formats a citation according to a specified style
   * @async
   * @param {Object} citation - Citation to format
   * @param {string} style - Citation style
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Formatting result
   */
  async formatCitation(citation, style, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Formatting citation in style: ${style}`);
    
    try {
      // Generate cache key
      const cacheKey = `citation-format:${JSON.stringify(citation)}:${style}`;
      
      // Check cache
      if (this.citationCache.has(cacheKey) && !options.bypassCache) {
        const cachedResult = this.citationCache.get(cacheKey);
        this.logger.info(`Returning cached citation format result for style: ${style}`);
        return cachedResult;
      }
      
      // If online, format using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/format-citation', {
            citation,
            style,
            options
          });
          
          if (response && response.data) {
            // Cache result
            this.citationCache.set(cacheKey, response.data);
            
            // Persist to storage
            if (this.storageServices.dataStore) {
              await this.storageServices.dataStore.set('legal:citation-cache', Object.fromEntries(this.citationCache));
            }
            
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to format citation online: ${error.message}`);
        }
      }
      
      // Fall back to embedded formatting
      const embeddedResult = await this.formatEmbeddedCitation(citation, style, options);
      
      // Cache result
      this.citationCache.set(cacheKey, embeddedResult);
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:citation-cache', Object.fromEntries(this.citationCache));
      }
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to format citation: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Formats a citation using embedded models
   * @private
   * @async
   * @param {Object} citation - Citation to format
   * @param {string} style - Citation style
   * @param {Object} options - Formatting options
   * @returns {Promise<Object>} Formatting result
   */
  async formatEmbeddedCitation(citation, style, options) {
    this.logger.info(`Formatting citation using embedded models in style: ${style}`);
    
    try {
      // Use embedded model for citation formatting
      const formattingResult = await this.modelLoaderService.runInference('legal-citation-extraction', {
        task: 'format',
        citation,
        style,
        options
      });
      
      // Enhance formatting result with metadata
      const enhancedResult = {
        ...formattingResult,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        style
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to format citation using embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Creates a research memo
   * @async
   * @param {Object} researchData - Research data
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Research memo
   */
  async createResearchMemo(researchData, options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info(`Creating research memo: ${researchData.title || 'Untitled'}`);
    
    try {
      // If online, create using API
      if (!this.offlineMode && this.networkServices.apiClient) {
        try {
          const response = await this.networkServices.apiClient.post('legal/research/create-memo', {
            researchData,
            options
          });
          
          if (response && response.data) {
            return response.data;
          }
        } catch (error) {
          this.logger.warn(`Failed to create research memo online: ${error.message}`);
        }
      }
      
      // Fall back to embedded memo creation
      const embeddedResult = await this.createEmbeddedResearchMemo(researchData, options);
      
      return embeddedResult;
    } catch (error) {
      this.logger.error(`Failed to create research memo: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Creates a research memo using embedded models
   * @private
   * @async
   * @param {Object} researchData - Research data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Research memo
   */
  async createEmbeddedResearchMemo(researchData, options) {
    this.logger.info(`Creating research memo using embedded models: ${researchData.title || 'Untitled'}`);
    
    try {
      // Use embedded model for memo creation
      const memoResult = await this.modelLoaderService.runInference('legal-case-analysis', {
        task: 'create-memo',
        researchData,
        options
      });
      
      // Generate memo ID
      const memoId = `memo-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Enhance memo result with metadata
      const enhancedResult = {
        ...memoResult,
        id: memoId,
        source: 'embedded',
        timestamp: new Date().toISOString(),
        author: options.author || 'LegalResearchAssistant'
      };
      
      return enhancedResult;
    } catch (error) {
      this.logger.error(`Failed to create research memo using embedded models: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Records search history
   * @private
   * @async
   * @param {string} type - Search type
   * @param {Object} query - Search query
   * @param {number} resultCount - Number of results
   */
  async recordSearchHistory(type, query, resultCount) {
    try {
      const historyId = `${type}:${Date.now()}`;
      
      const historyItem = {
        id: historyId,
        type,
        query,
        resultCount,
        timestamp: new Date().toISOString()
      };
      
      // Store history item
      this.searchHistory.set(historyId, historyItem);
      
      // Limit history size
      if (this.searchHistory.size > 100) {
        // Get oldest entries
        const entries = Array.from(this.searchHistory.entries());
        entries.sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));
        
        // Remove oldest entries
        const toRemove = entries.slice(0, entries.length - 100);
        for (const [key] of toRemove) {
          this.searchHistory.delete(key);
        }
      }
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:search-history', Object.fromEntries(this.searchHistory));
      }
    } catch (error) {
      this.logger.warn(`Failed to record search history: ${error.message}`);
    }
  }
  
  /**
   * Gets search history
   * @async
   * @param {Object} [options] - Additional options
   * @returns {Promise<Array>} Search history
   */
  async getSearchHistory(options = {}) {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info('Getting search history');
    
    try {
      // Get history entries
      const entries = Array.from(this.searchHistory.values());
      
      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply limit
      if (options.limit && options.limit > 0) {
        return entries.slice(0, options.limit);
      }
      
      return entries;
    } catch (error) {
      this.logger.error(`Failed to get search history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clears search history
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async clearSearchHistory() {
    if (!this.initialized) {
      throw new Error('LegalResearchAssistant not initialized');
    }
    
    this.logger.info('Clearing search history');
    
    try {
      // Clear history
      this.searchHistory.clear();
      
      // Persist to storage
      if (this.storageServices.dataStore) {
        await this.storageServices.dataStore.set('legal:search-history', {});
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear search history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generates a hash for text
   * @private
   * @param {string} text - Text to hash
   * @returns {string} Hash
   */
  generateHashForText(text) {
    // Simple hash function for caching purposes
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

module.exports = LegalResearchAssistant;
