/**
 * @fileoverview ProcedurePersistenceManager for the Learning from Demonstration system.
 * Handles the storage, retrieval, and management of learned procedures.
 * 
 * @author Aideon Team
 * @copyright 2025 Aideon AI
 */

const EventBus = require("../common/events/EventBus");
const Logger = require("../common/utils/Logger");
const Configuration = require("../common/utils/Configuration");
const { LearningError, ValidationError, OperationError, PersistenceError } = require("../common/utils/ErrorHandler");
const Procedure = require("../common/models/Procedure");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

/**
 * Manages the persistence of learned procedures.
 */
class ProcedurePersistenceManager {
  /**
   * Persistence strategies
   * @enum {string}
   */
  static STRATEGIES = {
    FILESYSTEM: "filesystem",
    DATABASE: "database", // Placeholder for future implementation
    MEMORY: "memory" // For testing or temporary storage
  };

  /**
   * Creates a new ProcedurePersistenceManager instance.
   * @param {Object} options - Manager options
   * @param {EventBus} [options.eventBus] - Event bus for communication
   * @param {Logger} [options.logger] - Logger for logging
   * @param {Configuration} [options.config] - Configuration for settings
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || new EventBus();
    this.logger = options.logger || new Logger("ProcedurePersistenceManager");
    this.config = options.config || new Configuration(ProcedurePersistenceManager.defaultConfig());
    
    this.strategy = this.config.get("persistence.strategy", ProcedurePersistenceManager.STRATEGIES.FILESYSTEM);
    this.storagePath = this.config.get("persistence.filesystem.path", "./procedures");
    this.procedures = new Map(); // In-memory cache
    
    this._initializeStorage();
    this._setupEventListeners();
    this.logger.info(`ProcedurePersistenceManager initialized with strategy: ${this.strategy}`);
  }

  /**
   * Default configuration for the ProcedurePersistenceManager.
   * @returns {Object} Default configuration object
   */
  static defaultConfig() {
    return {
      persistence: {
        strategy: ProcedurePersistenceManager.STRATEGIES.FILESYSTEM,
        autoLoad: true,
        autoSave: true,
        cacheSize: 100,
        filesystem: {
          path: "./procedures",
          format: "json", // "json", "binary"
          prettyPrint: true
        },
        database: { // Placeholder
          connectionString: "",
          tableName: "procedures"
        }
      }
    };
  }

  /**
   * Initializes the storage based on the selected strategy.
   * @private
   */
  async _initializeStorage() {
    try {
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          await fs.mkdir(this.storagePath, { recursive: true });
          this.logger.info(`Filesystem storage initialized at: ${this.storagePath}`);
          if (this.config.get("persistence.autoLoad")) {
            await this.loadAllProcedures();
          }
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          this.logger.warn("Database persistence strategy is not yet implemented.");
          // TODO: Implement database connection and initialization
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          this.logger.info("Using in-memory persistence strategy.");
          break;
          
        default:
          throw new ConfigurationError(`Unsupported persistence strategy: ${this.strategy}`);
      }
    } catch (error) {
      this.logger.error("Failed to initialize storage", error);
      throw new PersistenceError("Storage initialization failed", error);
    }
  }

  /**
   * Saves a procedure.
   * @param {Procedure} procedure - Procedure to save
   * @returns {Promise<void>} Promise resolving when save is complete
   */
  async saveProcedure(procedure) {
    if (!(procedure instanceof Procedure)) {
      throw new ValidationError("Invalid procedure object provided");
    }
    
    const procedureId = procedure.id;
    
    try {
      this.logger.debug(`Saving procedure: ${procedureId}`);
      
      // Update cache
      this.procedures.set(procedureId, procedure);
      this._maintainCacheSize();
      
      // Persist based on strategy
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          await this._saveProcedureToFile(procedure);
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          // TODO: Implement database save
          this.logger.warn("Database save not implemented");
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          // Already saved in memory cache
          break;
      }
      
      this.logger.info(`Saved procedure: ${procedureId}`);
      this.eventBus.emit("procedure:saved", { procedureId, procedure });
    } catch (error) {
      this.logger.error(`Failed to save procedure: ${procedureId}`, error);
      this.eventBus.emit("persistence:error", { operation: "save", procedureId, error });
      throw new PersistenceError(`Failed to save procedure ${procedureId}`, error);
    }
  }

  /**
   * Loads a procedure by ID.
   * @param {string} procedureId - ID of the procedure to load
   * @returns {Promise<Procedure|null>} Promise resolving to the loaded procedure or null if not found
   */
  async loadProcedure(procedureId) {
    if (!procedureId || typeof procedureId !== "string") {
      throw new ValidationError("Procedure ID is required and must be a string");
    }
    
    try {
      // Check cache first
      if (this.procedures.has(procedureId)) {
        this.logger.debug(`Loading procedure from cache: ${procedureId}`);
        return this.procedures.get(procedureId);
      }
      
      this.logger.debug(`Loading procedure from storage: ${procedureId}`);
      
      let procedureData = null;
      
      // Load from storage based on strategy
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          procedureData = await this._loadProcedureFromFile(procedureId);
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          // TODO: Implement database load
          this.logger.warn("Database load not implemented");
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          // Not found if not in cache
          break;
      }
      
      if (!procedureData) {
        this.logger.warn(`Procedure not found: ${procedureId}`);
        return null;
      }
      
      // Reconstruct Procedure object
      const procedure = new Procedure(procedureData);
      
      // Update cache
      this.procedures.set(procedureId, procedure);
      this._maintainCacheSize();
      
      this.logger.info(`Loaded procedure: ${procedureId}`);
      this.eventBus.emit("procedure:loaded", { procedureId, procedure });
      
      return procedure;
    } catch (error) {
      this.logger.error(`Failed to load procedure: ${procedureId}`, error);
      this.eventBus.emit("persistence:error", { operation: "load", procedureId, error });
      // Don't throw PersistenceError for load failures, just return null
      return null;
    }
  }

  /**
   * Loads all procedures from storage.
   * @returns {Promise<Array<Procedure>>} Promise resolving to an array of all loaded procedures
   */
  async loadAllProcedures() {
    try {
      this.logger.info("Loading all procedures from storage");
      let loadedProcedures = [];
      
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          loadedProcedures = await this._loadAllProceduresFromFilesystem();
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          // TODO: Implement database load all
          this.logger.warn("Database load all not implemented");
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          loadedProcedures = Array.from(this.procedures.values());
          break;
      }
      
      // Update cache with all loaded procedures
      this.procedures.clear();
      for (const procedure of loadedProcedures) {
        this.procedures.set(procedure.id, procedure);
      }
      this._maintainCacheSize(); // Ensure cache doesn't exceed limit
      
      this.logger.info(`Loaded ${loadedProcedures.length} procedures`);
      this.eventBus.emit("procedures:loaded", { count: loadedProcedures.length });
      
      return loadedProcedures;
    } catch (error) {
      this.logger.error("Failed to load all procedures", error);
      this.eventBus.emit("persistence:error", { operation: "loadAll", error });
      throw new PersistenceError("Failed to load all procedures", error);
    }
  }

  /**
   * Deletes a procedure by ID.
   * @param {string} procedureId - ID of the procedure to delete
   * @returns {Promise<boolean>} Promise resolving to true if deleted, false if not found
   */
  async deleteProcedure(procedureId) {
    if (!procedureId || typeof procedureId !== "string") {
      throw new ValidationError("Procedure ID is required and must be a string");
    }
    
    try {
      this.logger.debug(`Deleting procedure: ${procedureId}`);
      let deleted = false;
      
      // Remove from cache
      this.procedures.delete(procedureId);
      
      // Delete from storage based on strategy
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          deleted = await this._deleteProcedureFromFile(procedureId);
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          // TODO: Implement database delete
          this.logger.warn("Database delete not implemented");
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          // Already removed from cache
          deleted = true; // Assume it existed if it was in cache
          break;
      }
      
      if (deleted) {
        this.logger.info(`Deleted procedure: ${procedureId}`);
        this.eventBus.emit("procedure:deleted", { procedureId });
      } else {
        this.logger.warn(`Procedure not found for deletion: ${procedureId}`);
      }
      
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete procedure: ${procedureId}`, error);
      this.eventBus.emit("persistence:error", { operation: "delete", procedureId, error });
      throw new PersistenceError(`Failed to delete procedure ${procedureId}`, error);
    }
  }

  /**
   * Lists all available procedure IDs.
   * @returns {Promise<Array<string>>} Promise resolving to an array of procedure IDs
   */
  async listProcedureIds() {
    try {
      this.logger.debug("Listing procedure IDs");
      let ids = [];
      
      switch (this.strategy) {
        case ProcedurePersistenceManager.STRATEGIES.FILESYSTEM:
          ids = await this._listProcedureIdsFromFilesystem();
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.DATABASE:
          // TODO: Implement database list IDs
          this.logger.warn("Database list IDs not implemented");
          break;
          
        case ProcedurePersistenceManager.STRATEGIES.MEMORY:
          ids = Array.from(this.procedures.keys());
          break;
      }
      
      this.logger.info(`Found ${ids.length} procedure IDs`);
      return ids;
    } catch (error) {
      this.logger.error("Failed to list procedure IDs", error);
      this.eventBus.emit("persistence:error", { operation: "listIds", error });
      throw new PersistenceError("Failed to list procedure IDs", error);
    }
  }

  /**
   * Gets all procedures currently in the cache.
   * @returns {Array<Procedure>} Array of cached procedures
   */
  getCachedProcedures() {
    return Array.from(this.procedures.values());
  }

  /**
   * Clears the procedure cache.
   * @returns {ProcedurePersistenceManager} This instance for chaining
   */
  clearCache() {
    this.procedures.clear();
    this.logger.debug("Cleared procedure cache");
    return this;
  }

  /**
   * Saves a procedure to a file.
   * @param {Procedure} procedure - Procedure to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveProcedureToFile(procedure) {
    const filePath = this._getFilePath(procedure.id);
    const format = this.config.get("persistence.filesystem.format", "json");
    let dataToSave;
    
    if (format === "json") {
      const prettyPrint = this.config.get("persistence.filesystem.prettyPrint", true);
      dataToSave = JSON.stringify(procedure.toJSON(), null, prettyPrint ? 2 : 0);
    } else {
      // TODO: Implement binary format (e.g., using protobuf or msgpack)
      this.logger.warn("Binary file format not yet implemented, saving as JSON.");
      dataToSave = JSON.stringify(procedure.toJSON());
    }
    
    await fs.writeFile(filePath, dataToSave, "utf8");
    this.logger.debug(`Procedure saved to file: ${filePath}`);
  }

  /**
   * Loads a procedure from a file.
   * @param {string} procedureId - ID of the procedure to load
   * @returns {Promise<Object|null>} Promise resolving to procedure data or null
   * @private
   */
  async _loadProcedureFromFile(procedureId) {
    const filePath = this._getFilePath(procedureId);
    
    try {
      const fileContent = await fs.readFile(filePath, "utf8");
      const format = this.config.get("persistence.filesystem.format", "json");
      let procedureData;
      
      if (format === "json") {
        procedureData = JSON.parse(fileContent);
      } else {
        // TODO: Implement binary format loading
        this.logger.warn("Binary file format loading not yet implemented, assuming JSON.");
        procedureData = JSON.parse(fileContent);
      }
      
      this.logger.debug(`Procedure loaded from file: ${filePath}`);
      return procedureData;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File not found is not an error for load operation
        this.logger.debug(`Procedure file not found: ${filePath}`);
        return null;
      } else {
        throw error; // Rethrow other errors
      }
    }
  }

  /**
   * Deletes a procedure file.
   * @param {string} procedureId - ID of the procedure to delete
   * @returns {Promise<boolean>} Promise resolving to true if deleted, false if not found
   * @private
   */
  async _deleteProcedureFromFile(procedureId) {
    const filePath = this._getFilePath(procedureId);
    
    try {
      await fs.unlink(filePath);
      this.logger.debug(`Procedure file deleted: ${filePath}`);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File not found means it was already deleted or never existed
        return false;
      } else {
        throw error; // Rethrow other errors
      }
    }
  }

  /**
   * Loads all procedures from the filesystem storage directory.
   * @returns {Promise<Array<Procedure>>} Promise resolving to an array of procedures
   * @private
   */
  async _loadAllProceduresFromFilesystem() {
    const files = await fs.readdir(this.storagePath);
    const format = this.config.get("persistence.filesystem.format", "json");
    const extension = format === "json" ? ".json" : ".bin"; // Adjust for binary later
    
    const procedureFiles = files.filter(file => file.endsWith(extension));
    const procedures = [];
    
    for (const file of procedureFiles) {
      const procedureId = path.basename(file, extension);
      try {
        const procedureData = await this._loadProcedureFromFile(procedureId);
        if (procedureData) {
          procedures.push(new Procedure(procedureData));
        }
      } catch (error) {
        this.logger.error(`Failed to load procedure file: ${file}`, error);
      }
    }
    
    return procedures;
  }

  /**
   * Lists all procedure IDs from the filesystem storage directory.
   * @returns {Promise<Array<string>>} Promise resolving to an array of procedure IDs
   * @private
   */
  async _listProcedureIdsFromFilesystem() {
    const files = await fs.readdir(this.storagePath);
    const format = this.config.get("persistence.filesystem.format", "json");
    const extension = format === "json" ? ".json" : ".bin"; // Adjust for binary later
    
    return files
      .filter(file => file.endsWith(extension))
      .map(file => path.basename(file, extension));
  }

  /**
   * Gets the file path for a given procedure ID.
   * @param {string} procedureId - Procedure ID
   * @returns {string} Full file path
   * @private
   */
  _getFilePath(procedureId) {
    const format = this.config.get("persistence.filesystem.format", "json");
    const extension = format === "json" ? ".json" : ".bin"; // Adjust for binary later
    return path.join(this.storagePath, `${procedureId}${extension}`);
  }

  /**
   * Maintains the cache size according to the configuration.
   * @private
   */
  _maintainCacheSize() {
    const maxSize = this.config.get("persistence.cacheSize", 100);
    if (this.procedures.size > maxSize) {
      // Simple LRU-like eviction: remove the oldest entry
      const oldestKey = this.procedures.keys().next().value;
      if (oldestKey) {
        this.procedures.delete(oldestKey);
        this.logger.debug(`Cache evicted procedure: ${oldestKey}`);
      }
    }
  }

  /**
   * Sets up event listeners.
   * @private
   */
  _setupEventListeners() {
    // Example: Listen for configuration changes
    this.config.addChangeListener((key, newValue, oldValue) => {
      this.logger.debug(`Configuration changed: ${key}`, { newValue, oldValue });
      // Handle relevant config changes, e.g., storage path
      if (key === "persistence.filesystem.path") {
        this.storagePath = newValue;
        this._initializeStorage(); // Re-initialize storage if path changes
      }
    });
  }
}

module.exports = ProcedurePersistenceManager;
