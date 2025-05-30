/**
 * @fileoverview Federated Query Engine for enterprise context connector.
 * 
 * This module provides a system for executing federated queries across multiple
 * enterprise data sources, combining and normalizing results.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * FederatedQueryEngine executes queries across multiple enterprise data sources.
 */
class FederatedQueryEngine {
  /**
   * Constructor for FederatedQueryEngine.
   * @param {Object} dependencies Required dependencies
   * @param {Object} dependencies.logger Logger instance
   * @param {Object} dependencies.performanceMonitor Performance Monitor instance
   * @param {Object} dependencies.contextSecurityManager Context Security Manager instance
   * @param {Object} dependencies.configService Configuration Service instance
   */
  constructor(dependencies) {
    // Validate dependencies
    if (!dependencies) {
      throw new Error('Dependencies are required');
    }
    
    const { logger, performanceMonitor, contextSecurityManager, configService } = dependencies;
    
    if (!logger) {
      throw new Error('Logger is required');
    }
    
    if (!performanceMonitor) {
      throw new Error('Performance Monitor is required');
    }
    
    if (!contextSecurityManager) {
      throw new Error('Context Security Manager is required');
    }
    
    if (!configService) {
      throw new Error('Configuration Service is required');
    }
    
    // Store dependencies
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.contextSecurityManager = contextSecurityManager;
    this.configService = configService;
    
    // Initialize state
    this.resultProcessors = new Map();
    this.queryTransformers = new Map();
    
    // Configure from service
    this.config = this.configService.getConfig('federatedQueryEngine') || {
      defaultTimeout: 30000,
      maxConcurrentQueries: 5,
      resultMergingStrategy: 'interleaved',
      maxResultsPerSource: 100,
      enableScoring: true,
      scoreNormalization: true
    };
    
    // Register default result processors
    this._registerDefaultResultProcessors();
    
    // Register default query transformers
    this._registerDefaultQueryTransformers();
    
    this.logger.info('FederatedQueryEngine created');
  }
  
  /**
   * Execute a federated query across multiple sources.
   * @param {Array<Object>} sources Sources to query
   * @param {Object} query Query parameters
   * @param {Object} options Query options
   * @returns {Promise<Object>} Combined query results
   */
  async executeQuery(sources, query, options = {}) {
    try {
      this.logger.debug('Executing federated query', { sourceCount: sources.length, query });
      
      // Start performance monitoring
      const perfTimer = this.performanceMonitor.startTimer('federatedQuery');
      
      // Validate sources
      if (!Array.isArray(sources) || sources.length === 0) {
        throw new Error('At least one source is required');
      }
      
      // Validate query
      if (!query) {
        throw new Error('Query is required');
      }
      
      // Set default options
      const queryOptions = {
        timeout: options.timeout || this.config.defaultTimeout,
        maxConcurrentQueries: options.maxConcurrentQueries || this.config.maxConcurrentQueries,
        resultMergingStrategy: options.resultMergingStrategy || this.config.resultMergingStrategy,
        maxResultsPerSource: options.maxResultsPerSource || this.config.maxResultsPerSource,
        enableScoring: options.hasOwnProperty('enableScoring') ? options.enableScoring : this.config.enableScoring,
        scoreNormalization: options.hasOwnProperty('scoreNormalization') ? options.scoreNormalization : this.config.scoreNormalization
      };
      
      // Transform query for each source
      const sourceQueries = await this._transformQueries(sources, query, queryOptions);
      
      // Execute queries in parallel with concurrency limit
      const results = await this._executeQueriesWithConcurrency(sources, sourceQueries, queryOptions);
      
      // Process and merge results
      const mergedResults = await this._processAndMergeResults(results, queryOptions);
      
      // End performance monitoring
      this.performanceMonitor.endTimer(perfTimer);
      
      return mergedResults;
    } catch (error) {
      this.logger.error(`Failed to execute federated query: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Register a result processor for a specific source type.
   * @param {string} sourceType Source type
   * @param {Function} processor Result processor function
   * @returns {boolean} True if registration was successful
   */
  registerResultProcessor(sourceType, processor) {
    try {
      if (!sourceType) {
        throw new Error('Source type is required');
      }
      
      if (typeof processor !== 'function') {
        throw new Error('Processor must be a function');
      }
      
      this.resultProcessors.set(sourceType, processor);
      this.logger.debug(`Registered result processor for source type: ${sourceType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register result processor: ${error.message}`, { error, sourceType });
      throw error;
    }
  }
  
  /**
   * Register a query transformer for a specific source type.
   * @param {string} sourceType Source type
   * @param {Function} transformer Query transformer function
   * @returns {boolean} True if registration was successful
   */
  registerQueryTransformer(sourceType, transformer) {
    try {
      if (!sourceType) {
        throw new Error('Source type is required');
      }
      
      if (typeof transformer !== 'function') {
        throw new Error('Transformer must be a function');
      }
      
      this.queryTransformers.set(sourceType, transformer);
      this.logger.debug(`Registered query transformer for source type: ${sourceType}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register query transformer: ${error.message}`, { error, sourceType });
      throw error;
    }
  }
  
  /**
   * Transform queries for each source.
   * @private
   * @param {Array<Object>} sources Sources to query
   * @param {Object} query Original query
   * @param {Object} options Query options
   * @returns {Promise<Map<string, Object>>} Map of source ID to transformed query
   */
  async _transformQueries(sources, query, options) {
    const sourceQueries = new Map();
    
    for (const source of sources) {
      try {
        // Get source type
        const sourceType = source.config ? source.config.type : 'generic';
        
        // Get transformer for source type
        const transformer = this.queryTransformers.get(sourceType) || this.queryTransformers.get('default');
        
        if (transformer) {
          // Transform query
          const transformedQuery = await transformer(query, source, options);
          sourceQueries.set(source.id, transformedQuery);
        } else {
          // Use original query
          sourceQueries.set(source.id, { ...query });
        }
      } catch (error) {
        this.logger.error(`Failed to transform query for source ${source.id}: ${error.message}`, { error, sourceId: source.id });
        // Skip this source
      }
    }
    
    return sourceQueries;
  }
  
  /**
   * Execute queries with concurrency limit.
   * @private
   * @param {Array<Object>} sources Sources to query
   * @param {Map<string, Object>} sourceQueries Map of source ID to query
   * @param {Object} options Query options
   * @returns {Promise<Array<Object>>} Query results
   */
  async _executeQueriesWithConcurrency(sources, sourceQueries, options) {
    // Create a queue of sources to query
    const sourceQueue = [...sources];
    const results = [];
    const maxConcurrent = options.maxConcurrentQueries;
    
    // Function to execute a single query
    const executeSourceQuery = async (source) => {
      try {
        // Get transformed query for this source
        const query = sourceQueries.get(source.id);
        
        if (!query) {
          throw new Error(`No query found for source: ${source.id}`);
        }
        
        // Start performance monitoring for this source
        const sourcePerfTimer = this.performanceMonitor.startTimer(`query_${source.id}`);
        
        // Execute query with timeout
        const queryPromise = source.executeQuery(query, {
          ...options,
          limit: options.maxResultsPerSource
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Query timeout for source: ${source.id}`)), options.timeout);
        });
        
        // Race between query and timeout
        const result = await Promise.race([queryPromise, timeoutPromise]);
        
        // End performance monitoring for this source
        this.performanceMonitor.endTimer(sourcePerfTimer);
        
        // Add source info to result
        const resultWithSource = {
          sourceId: source.id,
          sourceType: source.config ? source.config.type : 'generic',
          result,
          timestamp: Date.now()
        };
        
        results.push(resultWithSource);
        
        this.logger.debug(`Query completed for source: ${source.id}`, { resultCount: result.value ? result.value.length : 0 });
      } catch (error) {
        this.logger.error(`Failed to execute query for source ${source.id}: ${error.message}`, { error, sourceId: source.id });
        
        // Add error result
        results.push({
          sourceId: source.id,
          sourceType: source.config ? source.config.type : 'generic',
          error: {
            message: error.message,
            stack: error.stack
          },
          timestamp: Date.now()
        });
      }
    };
    
    // Execute queries with concurrency limit
    const executeNextBatch = async () => {
      if (sourceQueue.length === 0) {
        return;
      }
      
      const batch = sourceQueue.splice(0, maxConcurrent);
      await Promise.all(batch.map(executeSourceQuery));
      
      // Execute next batch
      await executeNextBatch();
    };
    
    // Start execution
    await executeNextBatch();
    
    return results;
  }
  
  /**
   * Process and merge results from multiple sources.
   * @private
   * @param {Array<Object>} results Results from each source
   * @param {Object} options Query options
   * @returns {Promise<Object>} Merged results
   */
  async _processAndMergeResults(results, options) {
    // Process results from each source
    const processedResults = [];
    
    for (const result of results) {
      try {
        // Skip results with errors
        if (result.error) {
          continue;
        }
        
        // Get processor for source type
        const processor = this.resultProcessors.get(result.sourceType) || this.resultProcessors.get('default');
        
        if (processor) {
          // Process result
          const processed = await processor(result.result, result.sourceId, result.sourceType, options);
          
          if (processed && processed.items) {
            processedResults.push({
              sourceId: result.sourceId,
              sourceType: result.sourceType,
              items: processed.items,
              metadata: processed.metadata || {}
            });
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process results for source ${result.sourceId}: ${error.message}`, { error, sourceId: result.sourceId });
        // Skip this source
      }
    }
    
    // Merge results based on strategy
    let mergedItems = [];
    
    switch (options.resultMergingStrategy) {
      case 'interleaved':
        mergedItems = this._mergeResultsInterleaved(processedResults, options);
        break;
        
      case 'sequential':
        mergedItems = this._mergeResultsSequential(processedResults, options);
        break;
        
      case 'scored':
        mergedItems = this._mergeResultsScored(processedResults, options);
        break;
        
      default:
        mergedItems = this._mergeResultsInterleaved(processedResults, options);
    }
    
    // Create merged result
    const mergedResult = {
      items: mergedItems,
      sources: processedResults.map(r => ({
        id: r.sourceId,
        type: r.sourceType,
        itemCount: r.items.length,
        metadata: r.metadata
      })),
      totalCount: mergedItems.length,
      timestamp: Date.now()
    };
    
    return mergedResult;
  }
  
  /**
   * Merge results using interleaved strategy.
   * @private
   * @param {Array<Object>} processedResults Processed results from each source
   * @param {Object} options Query options
   * @returns {Array<Object>} Merged items
   */
  _mergeResultsInterleaved(processedResults, options) {
    const mergedItems = [];
    let hasMore = true;
    let index = 0;
    
    // Interleave results from each source
    while (hasMore) {
      hasMore = false;
      
      for (const result of processedResults) {
        if (index < result.items.length) {
          mergedItems.push({
            ...result.items[index],
            sourceId: result.sourceId,
            sourceType: result.sourceType
          });
          hasMore = true;
        }
      }
      
      index++;
    }
    
    return mergedItems;
  }
  
  /**
   * Merge results using sequential strategy.
   * @private
   * @param {Array<Object>} processedResults Processed results from each source
   * @param {Object} options Query options
   * @returns {Array<Object>} Merged items
   */
  _mergeResultsSequential(processedResults, options) {
    const mergedItems = [];
    
    // Concatenate results from each source
    for (const result of processedResults) {
      const itemsWithSource = result.items.map(item => ({
        ...item,
        sourceId: result.sourceId,
        sourceType: result.sourceType
      }));
      
      mergedItems.push(...itemsWithSource);
    }
    
    return mergedItems;
  }
  
  /**
   * Merge results using scored strategy.
   * @private
   * @param {Array<Object>} processedResults Processed results from each source
   * @param {Object} options Query options
   * @returns {Array<Object>} Merged items
   */
  _mergeResultsScored(processedResults, options) {
    // Collect all items with scores
    let allItems = [];
    
    for (const result of processedResults) {
      const itemsWithSource = result.items.map(item => ({
        ...item,
        sourceId: result.sourceId,
        sourceType: result.sourceType,
        score: item.score || 0.5 // Default score if not provided
      }));
      
      allItems.push(...itemsWithSource);
    }
    
    // Normalize scores if enabled
    if (options.scoreNormalization) {
      allItems = this._normalizeScores(allItems);
    }
    
    // Sort by score (descending)
    allItems.sort((a, b) => b.score - a.score);
    
    return allItems;
  }
  
  /**
   * Normalize scores across all items.
   * @private
   * @param {Array<Object>} items Items with scores
   * @returns {Array<Object>} Items with normalized scores
   */
  _normalizeScores(items) {
    // Find min and max scores
    let minScore = Number.MAX_VALUE;
    let maxScore = Number.MIN_VALUE;
    
    for (const item of items) {
      minScore = Math.min(minScore, item.score);
      maxScore = Math.max(maxScore, item.score);
    }
    
    // Normalize scores to range [0, 1]
    const range = maxScore - minScore;
    
    if (range > 0) {
      for (const item of items) {
        item.score = (item.score - minScore) / range;
      }
    } else {
      // All scores are the same
      for (const item of items) {
        item.score = 0.5;
      }
    }
    
    return items;
  }
  
  /**
   * Register default result processors.
   * @private
   */
  _registerDefaultResultProcessors() {
    // Default processor
    this.registerResultProcessor('default', (result, sourceId, sourceType, options) => {
      // Extract items from result
      const items = result.value || result.results || result.items || [];
      
      // Extract metadata
      const metadata = {
        totalCount: result.totalCount || result.total || items.length,
        timestamp: Date.now()
      };
      
      return { items, metadata };
    });
    
    // SharePoint processor
    this.registerResultProcessor('sharepoint', (result, sourceId, sourceType, options) => {
      // Extract items from SharePoint result
      const items = result.value || [];
      
      // Transform items to standard format
      const transformedItems = items.map(item => ({
        id: item.id,
        title: item.title || item.name,
        url: item.webUrl || item.url,
        type: item.contentType || item.type || 'document',
        created: item.created || item.createdDateTime,
        modified: item.lastModified || item.lastModifiedDateTime,
        author: item.author || item.createdBy,
        size: item.size,
        score: item.rank ? item.rank / 100 : undefined
      }));
      
      // Extract metadata
      const metadata = {
        totalCount: result.totalCount || items.length,
        timestamp: Date.now()
      };
      
      return { items: transformedItems, metadata };
    });
    
    // Confluence processor
    this.registerResultProcessor('confluence', (result, sourceId, sourceType, options) => {
      // Extract items from Confluence result
      const items = result.results || [];
      
      // Transform items to standard format
      const transformedItems = items.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url || item._links?.webui,
        type: item.type,
        created: item.created,
        modified: item.lastModified || item.version?.when,
        author: item.author?.displayName,
        excerpt: item.excerpt,
        score: item.score
      }));
      
      // Extract metadata
      const metadata = {
        totalCount: result.totalSize || result.size || items.length,
        timestamp: Date.now()
      };
      
      return { items: transformedItems, metadata };
    });
  }
  
  /**
   * Register default query transformers.
   * @private
   */
  _registerDefaultQueryTransformers() {
    // Default transformer
    this.registerQueryTransformer('default', (query, source, options) => {
      // Pass through query unchanged
      return { ...query };
    });
    
    // SharePoint transformer
    this.registerQueryTransformer('sharepoint', (query, source, options) => {
      // Transform generic query to SharePoint query
      const sharePointQuery = { ...query };
      
      // Set query type based on original query
      if (query.type === 'search') {
        sharePointQuery.type = 'search';
        sharePointQuery.query = query.query;
      } else if (query.type === 'document') {
        sharePointQuery.type = 'drive';
        sharePointQuery.driveId = query.containerId || 'drive-1'; // Default drive ID
      } else if (query.type === 'list') {
        sharePointQuery.type = 'list';
        sharePointQuery.listId = query.containerId || 'list-1'; // Default list ID
      } else {
        sharePointQuery.type = 'search';
        sharePointQuery.query = query.query || '';
      }
      
      return sharePointQuery;
    });
    
    // Confluence transformer
    this.registerQueryTransformer('confluence', (query, source, options) => {
      // Transform generic query to Confluence query
      const confluenceQuery = { ...query };
      
      // Set query type based on original query
      if (query.type === 'search') {
        confluenceQuery.type = 'search';
        confluenceQuery.query = query.query;
      } else if (query.type === 'document') {
        confluenceQuery.type = 'page';
        confluenceQuery.spaceKey = query.containerId || 'GENERAL'; // Default space key
      } else if (query.type === 'blog') {
        confluenceQuery.type = 'blog';
        confluenceQuery.spaceKey = query.containerId || 'GENERAL'; // Default space key
      } else {
        confluenceQuery.type = 'search';
        confluenceQuery.query = query.query || '';
      }
      
      return confluenceQuery;
    });
  }
}

module.exports = FederatedQueryEngine;
