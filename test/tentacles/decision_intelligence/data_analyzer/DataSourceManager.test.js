/**
 * @fileoverview Tests for the DataSourceManager component
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;

const { DataSourceManager } = require('../../../../src/tentacles/decision_intelligence/data_analyzer/DataSourceManager');

describe('DataSourceManager', () => {
  let dataSourceManager;
  let mockAideon;
  let mockConfig;
  
  beforeEach(() => {
    // Create mock Aideon object
    mockConfig = {
      getNamespace: sinon.stub().returns({
        getNamespace: sinon.stub().returns({
          get: sinon.stub()
        })
      })
    };
    
    mockAideon = {
      config: mockConfig,
      http: {
        request: sinon.stub().resolves({ data: { test: 'data' } })
      },
      database: {
        query: sinon.stub().resolves([{ id: 1, name: 'Test' }])
      }
    };
    
    // Create DataSourceManager instance with default config
    dataSourceManager = new DataSourceManager(mockAideon, {
      supportedDataSources: ['csv', 'json', 'database', 'api'],
      cacheTTL: 3600000,
      maxCacheSize: 104857600
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should create a new instance with default properties', () => {
      const manager = new DataSourceManager();
      
      expect(manager).to.be.an.instanceOf(DataSourceManager);
      expect(manager.initialized).to.be.false;
      expect(manager.config).to.be.an('object');
      expect(manager.events).to.exist;
      expect(manager.logger).to.exist;
      expect(manager.adapters).to.be.an('object');
      expect(manager.cache).to.be.an.instanceOf(Map);
    });
    
    it('should store the Aideon reference if provided', () => {
      const manager = new DataSourceManager(mockAideon);
      
      expect(manager.aideon).to.equal(mockAideon);
    });
    
    it('should use provided configuration', () => {
      const config = {
        supportedDataSources: ['json'],
        cacheTTL: 60000,
        maxCacheSize: 1000000
      };
      
      const manager = new DataSourceManager(mockAideon, config);
      
      expect(manager.config.supportedDataSources).to.deep.equal(['json']);
      expect(manager.config.cacheTTL).to.equal(60000);
      expect(manager.config.maxCacheSize).to.equal(1000000);
    });
  });
  
  describe('initialize', () => {
    it('should initialize adapters for supported data sources', async () => {
      // Setup spy for _initializeAdapters
      const initAdaptersSpy = sinon.spy(dataSourceManager, '_initializeAdapters');
      
      // Initialize
      await dataSourceManager.initialize();
      
      // Verify
      expect(dataSourceManager.initialized).to.be.true;
      expect(initAdaptersSpy.calledOnce).to.be.true;
      expect(Object.keys(dataSourceManager.adapters)).to.include.members(['csv', 'json', 'database', 'api']);
    });
    
    it('should not reinitialize if already initialized', async () => {
      // Initialize once
      await dataSourceManager.initialize();
      
      // Reset spy
      const initAdaptersSpy = sinon.spy(dataSourceManager, '_initializeAdapters');
      
      // Initialize again
      await dataSourceManager.initialize();
      
      // Verify
      expect(initAdaptersSpy.called).to.be.false;
    });
    
    it('should emit initialized event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataSourceManager.events, 'emit');
      
      // Initialize
      await dataSourceManager.initialize();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('initialized')).to.be.true;
    });
    
    it('should handle initialization errors', async () => {
      // Setup error in initialization
      sinon.stub(dataSourceManager, '_initializeAdapters').throws(new Error('Test error'));
      
      // Attempt to initialize
      try {
        await dataSourceManager.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Test error');
        expect(dataSourceManager.initialized).to.be.false;
      }
    });
  });
  
  describe('shutdown', () => {
    beforeEach(async () => {
      // Initialize before testing shutdown
      await dataSourceManager.initialize();
    });
    
    it('should clear cache and mark as not initialized', async () => {
      // Add something to cache
      dataSourceManager.cache.set('test', { data: 'value', size: 100, expiry: Date.now() + 10000 });
      dataSourceManager.cacheSize = 100;
      
      // Shutdown
      await dataSourceManager.shutdown();
      
      // Verify
      expect(dataSourceManager.initialized).to.be.false;
      expect(dataSourceManager.cache.size).to.equal(0);
      expect(dataSourceManager.cacheSize).to.equal(0);
    });
    
    it('should do nothing if not initialized', async () => {
      // Shutdown once
      await dataSourceManager.shutdown();
      
      // Reset cache
      dataSourceManager.cache.set('test', { data: 'value', size: 100, expiry: Date.now() + 10000 });
      dataSourceManager.cacheSize = 100;
      
      // Setup event spy
      const eventSpy = sinon.spy(dataSourceManager.events, 'emit');
      
      // Shutdown again
      await dataSourceManager.shutdown();
      
      // Verify no events were emitted and cache was not cleared
      expect(eventSpy.called).to.be.false;
      expect(dataSourceManager.cache.size).to.equal(1);
    });
    
    it('should emit shutdown event when complete', async () => {
      // Setup event spy
      const eventSpy = sinon.spy(dataSourceManager.events, 'emit');
      
      // Shutdown
      await dataSourceManager.shutdown();
      
      // Verify event was emitted
      expect(eventSpy.calledWith('shutdown')).to.be.true;
    });
  });
  
  describe('getStatus', () => {
    it('should return the current status', async () => {
      // Initialize
      await dataSourceManager.initialize();
      
      // Add something to cache
      dataSourceManager.cache.set('test', { data: 'value', size: 100, expiry: Date.now() + 10000 });
      dataSourceManager.cacheSize = 100;
      
      // Get status
      const status = dataSourceManager.getStatus();
      
      // Verify
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.adapters).to.be.an('array');
      expect(status.cacheSize).to.equal(100);
      expect(status.cacheEntries).to.equal(1);
    });
  });
  
  describe('fetchData', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await dataSourceManager.shutdown();
      
      // Attempt to fetch
      try {
        await dataSourceManager.fetchData({ type: 'json', content: '{}' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if source is missing', async () => {
      // Attempt to fetch without source
      try {
        await dataSourceManager.fetchData();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Source is required');
      }
    });
    
    it('should use cache if available', async () => {
      // Setup cache
      const source = { type: 'json', content: '{"test": "data"}' };
      const cacheKey = dataSourceManager._generateCacheKey(source);
      const cachedData = { result: 'from cache' };
      
      dataSourceManager.cache.set(cacheKey, {
        data: cachedData,
        size: 100,
        expiry: Date.now() + 10000
      });
      
      // Setup spy for adapter
      const adapterSpy = sinon.spy(dataSourceManager.adapters.json, 'fetch');
      
      // Fetch data
      const result = await dataSourceManager.fetchData(source);
      
      // Verify
      expect(result).to.equal(cachedData);
      expect(adapterSpy.called).to.be.false;
    });
    
    it('should not use cache if disabled', async () => {
      // Setup cache
      const source = { type: 'json', content: '{"test": "data"}' };
      const cacheKey = dataSourceManager._generateCacheKey(source);
      const cachedData = { result: 'from cache' };
      
      dataSourceManager.cache.set(cacheKey, {
        data: cachedData,
        size: 100,
        expiry: Date.now() + 10000
      });
      
      // Setup spy for adapter
      const adapterSpy = sinon.spy(dataSourceManager.adapters.json, 'fetch');
      
      // Fetch data with cache disabled
      await dataSourceManager.fetchData(source, { useCache: false });
      
      // Verify
      expect(adapterSpy.called).to.be.true;
    });
    
    it('should use appropriate adapter based on source type', async () => {
      // Setup spies for adapters
      const jsonSpy = sinon.spy(dataSourceManager.adapters.json, 'fetch');
      const csvSpy = sinon.spy(dataSourceManager.adapters.csv, 'fetch');
      
      // Fetch JSON data
      await dataSourceManager.fetchData({ type: 'json', content: '{"test": "data"}' });
      
      // Verify
      expect(jsonSpy.calledOnce).to.be.true;
      expect(csvSpy.called).to.be.false;
    });
    
    it('should throw an error for unsupported source type', async () => {
      // Attempt to fetch with unsupported type
      try {
        await dataSourceManager.fetchData({ type: 'unsupported' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No adapter available');
      }
    });
    
    it('should cache fetched data', async () => {
      // Setup
      const source = { type: 'json', content: '{"test": "data"}' };
      const cacheKey = dataSourceManager._generateCacheKey(source);
      const fetchedData = { result: 'fetched' };
      
      // Setup adapter to return data
      sinon.stub(dataSourceManager.adapters.json, 'fetch').resolves(fetchedData);
      
      // Setup spy for _addToCache
      const cacheSpy = sinon.spy(dataSourceManager, '_addToCache');
      
      // Fetch data
      const result = await dataSourceManager.fetchData(source);
      
      // Verify
      expect(result).to.equal(fetchedData);
      expect(cacheSpy.calledWith(cacheKey, fetchedData)).to.be.true;
    });
  });
  
  describe('CSV adapter', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should parse CSV content', async () => {
      // Setup
      const content = 'name,age,city\nJohn,30,New York\nJane,25,Boston';
      
      // Parse
      const result = await dataSourceManager.adapters.csv.parse(content);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].name).to.equal('John');
      expect(result[0].age).to.equal('30');
      expect(result[0].city).to.equal('New York');
      expect(result[1].name).to.equal('Jane');
    });
    
    it('should fetch CSV from file path', async () => {
      // Setup
      const source = { type: 'csv', filePath: '/path/to/file.csv' };
      const content = 'name,age\nJohn,30\nJane,25';
      
      // Mock fs.readFile
      sinon.stub(fs, 'readFile').resolves(content);
      
      // Fetch
      const result = await dataSourceManager.adapters.csv.fetch(source);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].name).to.equal('John');
      expect(result[1].name).to.equal('Jane');
    });
    
    it('should fetch CSV from content', async () => {
      // Setup
      const source = { type: 'csv', content: 'name,age\nJohn,30\nJane,25' };
      
      // Fetch
      const result = await dataSourceManager.adapters.csv.fetch(source);
      
      // Verify
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].name).to.equal('John');
      expect(result[1].name).to.equal('Jane');
    });
    
    it('should throw an error if neither filePath nor content is provided', async () => {
      // Setup
      const source = { type: 'csv' };
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.csv.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('must provide filePath or content');
      }
    });
  });
  
  describe('JSON adapter', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should parse JSON content', async () => {
      // Setup
      const content = '{"name": "John", "age": 30}';
      
      // Parse
      const result = await dataSourceManager.adapters.json.parse(content);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.name).to.equal('John');
      expect(result.age).to.equal(30);
    });
    
    it('should fetch JSON from file path', async () => {
      // Setup
      const source = { type: 'json', filePath: '/path/to/file.json' };
      const content = '{"name": "John", "age": 30}';
      
      // Mock fs.readFile
      sinon.stub(fs, 'readFile').resolves(content);
      
      // Fetch
      const result = await dataSourceManager.adapters.json.fetch(source);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.name).to.equal('John');
      expect(result.age).to.equal(30);
    });
    
    it('should fetch JSON from content', async () => {
      // Setup
      const source = { type: 'json', content: '{"name": "John", "age": 30}' };
      
      // Fetch
      const result = await dataSourceManager.adapters.json.fetch(source);
      
      // Verify
      expect(result).to.be.an('object');
      expect(result.name).to.equal('John');
      expect(result.age).to.equal(30);
    });
    
    it('should throw an error if neither filePath nor content is provided', async () => {
      // Setup
      const source = { type: 'json' };
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.json.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('must provide filePath or content');
      }
    });
  });
  
  describe('Database adapter', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should fetch data from database', async () => {
      // Setup
      const source = { 
        type: 'database', 
        query: 'SELECT * FROM users', 
        params: { limit: 10 } 
      };
      
      // Fetch
      const result = await dataSourceManager.adapters.database.fetch(source);
      
      // Verify
      expect(mockAideon.database.query.calledWith(source.query, source.params)).to.be.true;
      expect(result).to.be.an('array');
      expect(result[0].id).to.equal(1);
    });
    
    it('should throw an error if query is not provided', async () => {
      // Setup
      const source = { type: 'database' };
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.database.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('must provide a query');
      }
    });
    
    it('should throw an error if database service is not available', async () => {
      // Setup
      const source = { type: 'database', query: 'SELECT * FROM users' };
      
      // Remove database service
      dataSourceManager.aideon.database = null;
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.database.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Database service not available');
      }
    });
  });
  
  describe('API adapter', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should fetch data from API', async () => {
      // Setup
      const source = { 
        type: 'api', 
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        data: { param: 'value' }
      };
      
      // Fetch
      const result = await dataSourceManager.adapters.api.fetch(source);
      
      // Verify
      expect(mockAideon.http.request.calledOnce).to.be.true;
      expect(mockAideon.http.request.args[0][0].url).to.equal(source.url);
      expect(mockAideon.http.request.args[0][0].method).to.equal(source.method);
      expect(mockAideon.http.request.args[0][0].headers).to.equal(source.headers);
      expect(mockAideon.http.request.args[0][0].data).to.equal(source.data);
      expect(result).to.deep.equal({ test: 'data' });
    });
    
    it('should use default method if not provided', async () => {
      // Setup
      const source = { 
        type: 'api', 
        url: 'https://api.example.com/data'
      };
      
      // Fetch
      await dataSourceManager.adapters.api.fetch(source);
      
      // Verify
      expect(mockAideon.http.request.args[0][0].method).to.equal('GET');
    });
    
    it('should throw an error if URL is not provided', async () => {
      // Setup
      const source = { type: 'api' };
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.api.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('must provide a URL');
      }
    });
    
    it('should throw an error if HTTP service is not available', async () => {
      // Setup
      const source = { type: 'api', url: 'https://api.example.com/data' };
      
      // Remove HTTP service
      dataSourceManager.aideon.http = null;
      
      // Attempt to fetch
      try {
        await dataSourceManager.adapters.api.fetch(source);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('HTTP service not available');
      }
    });
  });
  
  describe('Cache management', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should add data to cache', () => {
      // Setup
      const key = 'test-key';
      const data = { value: 'test' };
      
      // Add to cache
      dataSourceManager._addToCache(key, data);
      
      // Verify
      expect(dataSourceManager.cache.has(key)).to.be.true;
      expect(dataSourceManager.cacheSize).to.be.greaterThan(0);
    });
    
    it('should retrieve data from cache', () => {
      // Setup
      const key = 'test-key';
      const data = { value: 'test' };
      
      dataSourceManager.cache.set(key, {
        data,
        size: 100,
        expiry: Date.now() + 10000
      });
      
      // Get from cache
      const result = dataSourceManager._getFromCache(key);
      
      // Verify
      expect(result).to.equal(data);
    });
    
    it('should return null for expired cache entries', () => {
      // Setup
      const key = 'test-key';
      const data = { value: 'test' };
      
      dataSourceManager.cache.set(key, {
        data,
        size: 100,
        expiry: Date.now() - 1000 // Expired
      });
      dataSourceManager.cacheSize = 100;
      
      // Get from cache
      const result = dataSourceManager._getFromCache(key);
      
      // Verify
      expect(result).to.be.null;
      expect(dataSourceManager.cache.has(key)).to.be.false;
      expect(dataSourceManager.cacheSize).to.equal(0);
    });
    
    it('should evict entries when cache is full', () => {
      // Setup
      dataSourceManager.config.maxCacheSize = 200;
      
      // Add first entry
      dataSourceManager._addToCache('key1', { value: 'test1' });
      const size1 = dataSourceManager.cacheSize;
      
      // Add second entry that would exceed limit
      dataSourceManager._addToCache('key2', { value: 'test2' });
      
      // Verify first entry was evicted
      expect(dataSourceManager.cache.has('key1')).to.be.false;
      expect(dataSourceManager.cache.has('key2')).to.be.true;
      expect(dataSourceManager.cacheSize).to.be.lessThan(size1 * 2);
    });
    
    it('should not cache data larger than max cache size', () => {
      // Setup
      dataSourceManager.config.maxCacheSize = 10;
      
      // Add large data
      dataSourceManager._addToCache('key', { value: 'this is a large value that exceeds the limit' });
      
      // Verify not added to cache
      expect(dataSourceManager.cache.has('key')).to.be.false;
    });
  });
  
  describe('manageSources', () => {
    beforeEach(async () => {
      // Initialize before testing
      await dataSourceManager.initialize();
    });
    
    it('should throw an error if not initialized', async () => {
      // Shutdown to make not initialized
      await dataSourceManager.shutdown();
      
      // Attempt to manage sources
      try {
        await dataSourceManager.manageSources({ action: 'list' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('not initialized');
      }
    });
    
    it('should throw an error if parameters are missing', async () => {
      // Attempt to manage sources without parameters
      try {
        await dataSourceManager.manageSources();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Parameters are required');
      }
    });
    
    it('should handle add action', async () => {
      // Setup spy for _addSource
      const addSpy = sinon.spy(dataSourceManager, '_addSource');
      
      // Manage sources
      await dataSourceManager.manageSources({
        action: 'add',
        source: { type: 'json', name: 'test' }
      });
      
      // Verify
      expect(addSpy.calledOnce).to.be.true;
    });
    
    it('should handle update action', async () => {
      // Setup spy for _updateSource
      const updateSpy = sinon.spy(dataSourceManager, '_updateSource');
      
      // Manage sources
      await dataSourceManager.manageSources({
        action: 'update',
        id: 'source-1',
        source: { type: 'json', name: 'updated' }
      });
      
      // Verify
      expect(updateSpy.calledOnce).to.be.true;
    });
    
    it('should handle remove action', async () => {
      // Setup spy for _removeSource
      const removeSpy = sinon.spy(dataSourceManager, '_removeSource');
      
      // Manage sources
      await dataSourceManager.manageSources({
        action: 'remove',
        id: 'source-1'
      });
      
      // Verify
      expect(removeSpy.calledOnce).to.be.true;
    });
    
    it('should handle list action', async () => {
      // Setup spy for _listSources
      const listSpy = sinon.spy(dataSourceManager, '_listSources');
      
      // Manage sources
      await dataSourceManager.manageSources({
        action: 'list',
        filter: { type: 'json' }
      });
      
      // Verify
      expect(listSpy.calledOnce).to.be.true;
    });
    
    it('should throw an error for unsupported action', async () => {
      // Attempt to manage sources with unsupported action
      try {
        await dataSourceManager.manageSources({ action: 'unsupported' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported action');
      }
    });
  });
});
