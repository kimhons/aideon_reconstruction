/**
 * @fileoverview Implementation of the PatternRecognizer class and related components
 * for the Predictive Intelligence Engine.
 * 
 * @module core/predictive/PatternRecognizer
 */

const { v4: uuidv4 } = require("uuid"); // Assuming uuid is available
const EventEmitter = require("events"); // Assuming EventEmitter is available

// --- Enums and Interfaces (from design) ---

enum PatternType {
  TEMPORAL = "TEMPORAL",
  SEQUENTIAL = "SEQUENTIAL",
  FREQUENCY = "FREQUENCY",
  CLUSTER = "CLUSTER",
  ANOMALY = "ANOMALY",
  CUSTOM = "CUSTOM"
}

interface PatternMetadata {
  createdAt: number;
  updatedAt: number;
  source: string;
  domain: string;
  tags: string[];
  occurrences: number;
  successRate: number;
  averageConfidence: number;
  lastMatchTimestamp: number;
  customProperties: Record<string, any>;
  patternType?: PatternType; // Added for storage/retrieval
}

interface IPattern {
  id: string;
  type: PatternType;
  confidence: number;
  metadata: PatternMetadata;
  matches(data: any): boolean;
  getConfidenceScore(data: any): number;
  update(data: any): void;
  serialize(): string;
  deserialize(data: string): void;
}

interface PatternMatch {
  patternId: string;
  confidence: number;
  matchedAt: number;
  context: any;
  prediction?: any;
  explanation?: string;
}

interface TrainingData {
  samples: any[];
  labels?: any[];
  options?: any; // TrainingOptions
}

interface TrainingResult {
  success: boolean;
  patternsDetected: number;
  accuracy: number;
  trainingTime: number;
  errors?: string[];
}

interface PatternFilter {
  types?: PatternType[];
  minConfidence?: number;
  tags?: string[];
  domain?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  customCriteria?: (pattern: IPattern) => boolean;
}

interface PatternStatistics {
  totalPatterns: number;
  patternsByType: Record<PatternType, number>;
  averageConfidence: number;
  recognitionRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  processingTime: number;
  storageUsage: number;
}

interface IPatternRecognizer {
  id: string;
  name: string;
  description: string;
  patternType: PatternType;
  eventEmitter: EventEmitter; // Make event emitter public for subscription
  
  initialize(config: PatternRecognizerConfig): void;
  train(data: TrainingData): Promise<TrainingResult>;
  detectPatterns(data: any): Promise<PatternMatch[]>;
  getPattern(patternId: string): IPattern;
  getAllPatterns(): IPattern[];
  addPattern(pattern: IPattern): string;
  removePattern(patternId: string): boolean;
  updatePattern(patternId: string, data: any): boolean;
  getStatistics(): PatternStatistics;
  reset(): void;
  on(eventName: string, listener: (...args: any[]) => void): void;
  off(eventName: string, listener: (...args: any[]) => void): void;
}

interface IPatternStorage {
  savePattern(pattern: IPattern): Promise<boolean>;
  loadPattern(patternId: string): Promise<IPattern>;
  deletePattern(patternId: string): Promise<boolean>;
  listPatterns(filter?: PatternFilter): Promise<string[]>;
  getPatternMetadata(patternId: string): Promise<PatternMetadata>;
  optimizeStorage(): Promise<void>;
}

interface IPatternMatcher {
  initialize(config: any): void; // MatcherConfig
  match(data: any, patterns: IPattern[]): PatternMatch[];
  calculateSimilarity(data: any, pattern: IPattern): number;
  rankMatches(matches: PatternMatch[]): PatternMatch[];
}

// Mock dependencies (replace with actual implementations)
class MetricsCollector {
  recordMetric(name: string, data: any) {
    // console.log(`Metric: ${name}`, data);
  }
}

class Logger {
  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }
  debug(message: string, ...args: any[]) {
    // console.debug(`[DEBUG] ${message}`, ...args);
  }
  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

interface PatternRecognizerConfig {
  id?: string;
  name?: string;
  description?: string;
  patternType: PatternType;
  storage?: IPatternStorage;
  matcher?: IPatternMatcher;
  eventEmitter?: EventEmitter;
  metrics?: MetricsCollector;
  logger?: Logger;
  [key: string]: any; // Allow additional config options
}

// --- Default Implementations (from design) ---

class DefaultPatternStorage implements IPatternStorage {
  private storage: Map<string, string>;
  private metadata: Map<string, PatternMetadata>;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.storage = new Map<string, string>();
    this.metadata = new Map<string, PatternMetadata>();
    this.logger = logger || new Logger();
    this.logger.info("DefaultPatternStorage initialized (in-memory).");
  }

  async savePattern(pattern: IPattern): Promise<boolean> {
    try {
      const serialized = pattern.serialize();
      this.storage.set(pattern.id, serialized);
      // Ensure patternType is stored in metadata for deserialization
      const metaToStore = { ...pattern.metadata, patternType: pattern.type };
      this.metadata.set(pattern.id, metaToStore);
      this.logger.debug(`Pattern saved: ${pattern.id}`);
      return true;
    } catch (error) {
      this.logger.error("Error saving pattern", error);
      return false;
    }
  }

  async loadPattern(patternId: string): Promise<IPattern> {
    const serialized = this.storage.get(patternId);
    if (!serialized) {
      throw new Error(`Pattern with ID ${patternId} not found in storage`);
    }

    const metadata = this.metadata.get(patternId);
    if (!metadata || !metadata.patternType) {
      throw new Error(`Metadata or patternType missing for pattern ${patternId}`);
    }

    let pattern: IPattern;
    switch (metadata.patternType) {
      case PatternType.TEMPORAL:
        pattern = new TemporalPattern({ id: patternId });
        break;
      case PatternType.SEQUENTIAL:
        pattern = new SequentialPattern({ id: patternId });
        break;
      // Add other pattern types here
      default:
        throw new Error(`Unknown pattern type ${metadata.patternType} for pattern ${patternId}`);
    }

    pattern.deserialize(serialized);
    this.logger.debug(`Pattern loaded: ${patternId}`);
    return pattern;
  }

  async deletePattern(patternId: string): Promise<boolean> {
    const deleted = this.storage.delete(patternId);
    this.metadata.delete(patternId);
    if (deleted) {
      this.logger.debug(`Pattern deleted: ${patternId}`);
    }
    return deleted;
  }

  async listPatterns(filter?: PatternFilter): Promise<string[]> {
    if (!filter) {
      return Array.from(this.storage.keys());
    }

    return Array.from(this.metadata.entries())
      .filter(([id, metadata]) => {
        if (!metadata) return false; // Should not happen, but safety check
        if (filter.types && !filter.types.includes(metadata.patternType!)) {
          return false;
        }
        if (filter.minConfidence && metadata.averageConfidence < filter.minConfidence) {
          return false;
        }
        if (filter.tags && !filter.tags.every(tag => metadata.tags.includes(tag))) {
          return false;
        }
        if (filter.domain && metadata.domain !== filter.domain) {
          return false;
        }
        if (filter.dateRange) {
          if (metadata.updatedAt < filter.dateRange.start || metadata.updatedAt > filter.dateRange.end) {
            return false;
          }
        }
        // Note: customCriteria filter would require loading patterns, inefficient here.
        // Consider filtering after loading if needed, or storing more in metadata.
        return true;
      })
      .map(([id]) => id);
  }

  async getPatternMetadata(patternId: string): Promise<PatternMetadata> {
    const metadata = this.metadata.get(patternId);
    if (!metadata) {
      throw new Error(`Metadata for pattern ${patternId} not found`);
    }
    return metadata;
  }

  async optimizeStorage(): Promise<void> {
    this.logger.info("Optimizing in-memory pattern storage (no-op for default)...");
    // No-op for basic in-memory storage
  }
}

class DefaultPatternMatcher implements IPatternMatcher {
  private config: any;
  private similarityThreshold: number;
  private logger: Logger;

  constructor(config?: any, logger?: Logger) {
    this.config = config || {};
    this.similarityThreshold = this.config.similarityThreshold || 0.7;
    this.logger = logger || new Logger();
    this.logger.info("DefaultPatternMatcher initialized.");
  }

  initialize(config: any): void {
    this.config = { ...this.config, ...config };
    this.similarityThreshold = this.config.similarityThreshold || this.similarityThreshold;
  }

  match(data: any, patterns: IPattern[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of patterns) {
      try {
        const confidence = pattern.getConfidenceScore(data);
        if (confidence >= this.similarityThreshold) {
          matches.push({
            patternId: pattern.id,
            confidence: confidence,
            matchedAt: Date.now(),
            context: data // Pass input data as context
          });
        }
      } catch (error) {
        this.logger.error(`Error calculating confidence for pattern ${pattern.id}`, error);
      }
    }

    return this.rankMatches(matches);
  }

  calculateSimilarity(data: any, pattern: IPattern): number {
    // Delegate to pattern's own confidence calculation
    try {
      return pattern.getConfidenceScore(data);
    } catch (error) {
      this.logger.error(`Error calculating similarity for pattern ${pattern.id}`, error);
      return 0;
    }
  }

  rankMatches(matches: PatternMatch[]): PatternMatch[] {
    // Sort by confidence, highest first
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
}

// --- Abstract Base Class (from design) ---

abstract class PatternRecognizer implements IPatternRecognizer {
  public id: string;
  public name: string;
  public description: string;
  public patternType: PatternType;
  public eventEmitter: EventEmitter;
  protected config: PatternRecognizerConfig;
  protected patterns: Map<string, IPattern>;
  protected storage: IPatternStorage;
  protected matcher: IPatternMatcher;
  protected metrics: MetricsCollector;
  protected logger: Logger;

  constructor(config: PatternRecognizerConfig) {
    this.id = config.id || uuidv4();
    this.name = config.name || this.constructor.name;
    this.description = config.description || "";
    this.patternType = config.patternType;
    this.config = config;
    this.patterns = new Map<string, IPattern>();

    // Initialize dependencies with defaults
    this.logger = config.logger || new Logger();
    this.storage = config.storage || new DefaultPatternStorage(this.logger);
    this.matcher = config.matcher || new DefaultPatternMatcher({}, this.logger);
    this.eventEmitter = config.eventEmitter || new EventEmitter();
    this.metrics = config.metrics || new MetricsCollector();

    this.logger.info(`Constructing PatternRecognizer: ${this.name} (ID: ${this.id}, Type: ${this.patternType})`);
    // Call abstract initialize in concrete class constructor or separately
  }

  abstract initialize(config: PatternRecognizerConfig): void;
  abstract train(data: TrainingData): Promise<TrainingResult>;
  abstract detectPatterns(data: any): Promise<PatternMatch[]>;

  getPattern(patternId: string): IPattern {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      this.logger.warn(`Pattern with ID ${patternId} not found in active memory.`);
      // Optionally try loading from storage here?
      throw new Error(`Pattern with ID ${patternId} not found`);
    }
    return pattern;
  }

  getAllPatterns(): IPattern[] {
    return Array.from(this.patterns.values());
  }

  addPattern(pattern: IPattern): string {
    if (pattern.type !== this.patternType) {
        this.logger.error(`Cannot add pattern of type ${pattern.type} to recognizer of type ${this.patternType}`);
        throw new Error(`Pattern type mismatch`);
    }
    this.patterns.set(pattern.id, pattern);
    this.storage.savePattern(pattern).catch(err => {
        this.logger.error(`Failed to save pattern ${pattern.id} to storage`, err);
        // Should we remove from memory if storage fails?
    });
    this.eventEmitter.emit("pattern:added", { patternId: pattern.id, recognizerId: this.id });
    this.logger.info(`Pattern added: ${pattern.id}`);
    return pattern.id;
  }

  removePattern(patternId: string): boolean {
    if (!this.patterns.has(patternId)) {
      this.logger.warn(`Attempted to remove non-existent pattern: ${patternId}`);
      return false;
    }
    this.patterns.delete(patternId);
    this.storage.deletePattern(patternId).catch(err => {
        this.logger.error(`Failed to delete pattern ${patternId} from storage`, err);
    });
    this.eventEmitter.emit("pattern:removed", { patternId, recognizerId: this.id });
    this.logger.info(`Pattern removed: ${patternId}`);
    return true;
  }

  updatePattern(patternId: string, data: any): boolean {
    if (!this.patterns.has(patternId)) {
      this.logger.warn(`Attempted to update non-existent pattern: ${patternId}`);
      return false;
    }
    const pattern = this.patterns.get(patternId)!;
    try {
      pattern.update(data);
      this.storage.savePattern(pattern).catch(err => {
          this.logger.error(`Failed to save updated pattern ${patternId} to storage`, err);
      });
      this.eventEmitter.emit("pattern:updated", { patternId, recognizerId: this.id });
      this.logger.info(`Pattern updated: ${patternId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating pattern ${patternId}`, error);
      return false;
    }
  }

  getStatistics(): PatternStatistics {
    // Basic implementation - more detailed stats require tracking metrics
    const stats: PatternStatistics = {
      totalPatterns: this.patterns.size,
      patternsByType: { [this.patternType]: this.patterns.size } as Record<PatternType, number>,
      averageConfidence: 0, // Requires tracking match confidence
      recognitionRate: 0, // Requires tracking detection attempts/successes
      falsePositiveRate: 0, // Requires feedback mechanism
      falseNegativeRate: 0, // Requires feedback mechanism
      processingTime: 0, // Requires tracking detection time
      storageUsage: 0 // Requires storage implementation detail
    };
    // Calculate average confidence if possible
    let totalConfidence = 0;
    if (this.patterns.size > 0) {
        for (const pattern of this.patterns.values()) {
            totalConfidence += pattern.confidence;
        }
        stats.averageConfidence = totalConfidence / this.patterns.size;
    }
    return stats;
  }

  reset(): void {
    this.logger.info(`Resetting recognizer: ${this.id}`);
    this.patterns.clear();
    // Optionally clear storage? Depends on requirements.
    // this.storage.clearAllPatternsOfType(this.patternType); 
    this.eventEmitter.emit("recognizer:reset", { recognizerId: this.id });
  }

  protected async loadPatternsFromStorage(): Promise<void> {
    this.logger.info(`Loading patterns from storage for recognizer: ${this.id}`);
    try {
      const patternIds = await this.storage.listPatterns({ types: [this.patternType] });
      this.logger.debug(`Found ${patternIds.length} patterns of type ${this.patternType} in storage.`);
      let loadedCount = 0;
      for (const id of patternIds) {
        try {
          const pattern = await this.storage.loadPattern(id);
          if (pattern.type === this.patternType) {
            this.patterns.set(id, pattern);
            loadedCount++;
          } else {
            this.logger.warn(`Loaded pattern ${id} has incorrect type ${pattern.type}, expected ${this.patternType}. Skipping.`);
          }
        } catch (error) {
          this.logger.error(`Failed to load pattern ${id} from storage`, error);
        }
      }
      this.logger.info(`Successfully loaded ${loadedCount} patterns into memory.`);
    } catch (error) {
        this.logger.error(`Error listing patterns from storage for type ${this.patternType}`, error);
    }
  }

  protected emitPatternDetected(match: PatternMatch): void {
    this.eventEmitter.emit("pattern:detected", match);
    this.metrics.recordMetric("pattern_detected", {
      patternId: match.patternId,
      confidence: match.confidence,
      recognizerId: this.id,
      patternType: this.patternType
    });
    this.logger.debug(`Pattern detected: ${match.patternId} with confidence ${match.confidence}`);
  }

  // --- Event Emitter Wrappers ---
  on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  off(eventName: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(eventName, listener);
  }
}

// --- Concrete Pattern Implementation Example (Temporal) ---

interface TemporalPatternData {
    id?: string;
    confidence?: number;
    metadata?: Partial<PatternMetadata>;
    periodicity?: number;
    timeSignature?: number[];
    featureThresholds?: Record<string, [number, number]>;
    source?: string;
    domain?: string;
    tags?: string[];
}

class TemporalPattern implements IPattern {
  id: string;
  type: PatternType;
  confidence: number;
  metadata: PatternMetadata;

  private periodicity: number; // in milliseconds
  private timeSignature: number[];
  private featureThresholds: Map<string, [number, number]>; // min, max thresholds

  constructor(data: TemporalPatternData) {
    this.id = data.id || uuidv4();
    this.type = PatternType.TEMPORAL;
    this.confidence = data.confidence || 0.5;
    this.metadata = {
      createdAt: data.metadata?.createdAt || Date.now(),
      updatedAt: data.metadata?.updatedAt || Date.now(),
      source: data.source || data.metadata?.source || "unknown",
      domain: data.domain || data.metadata?.domain || "general",
      tags: data.tags || data.metadata?.tags || [],
      occurrences: data.metadata?.occurrences || 0,
      successRate: data.metadata?.successRate || 0,
      averageConfidence: data.metadata?.averageConfidence || this.confidence,
      lastMatchTimestamp: data.metadata?.lastMatchTimestamp || 0,
      customProperties: data.metadata?.customProperties || {},
      patternType: this.type
    };

    this.periodicity = data.periodicity || 0;
    this.timeSignature = data.timeSignature || [];
    this.featureThresholds = new Map(Object.entries(data.featureThresholds || {}));
  }

  matches(data: any): boolean {
    // Basic matching logic - check if data features fall within thresholds
    if (typeof data !== "object" || data === null) return false;

    for (const [feature, [min, max]] of this.featureThresholds.entries()) {
      if (!(feature in data) || data[feature] < min || data[feature] > max) {
        return false;
      }
    }
    // Add time-based matching logic if needed (periodicity, time signature)
    return true;
  }

  getConfidenceScore(data: any): number {
    // Simple confidence based on matching thresholds
    if (!this.matches(data)) {
      return 0;
    }
    // More sophisticated confidence calculation could be based on how close
    // the data is to the center of the thresholds, periodicity match, etc.
    return this.confidence; // Return base confidence for now
  }

  update(data: any): void {
    // Update metadata based on new match or feedback
    this.metadata.updatedAt = Date.now();
    this.metadata.occurrences++;
    this.metadata.lastMatchTimestamp = Date.now();
    // Potentially update confidence or thresholds based on data
    // Example: Recalculate average confidence
    this.metadata.averageConfidence = 
        ((this.metadata.averageConfidence * (this.metadata.occurrences - 1)) + this.confidence) / this.metadata.occurrences;
  }

  serialize(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      confidence: this.confidence,
      metadata: this.metadata,
      periodicity: this.periodicity,
      timeSignature: this.timeSignature,
      featureThresholds: Object.fromEntries(this.featureThresholds)
    });
  }

  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    if (parsed.id !== this.id) console.warn(`Deserializing pattern with mismatched ID: ${parsed.id} vs ${this.id}`);
    // this.id = parsed.id; // ID should generally not change on deserialize
    this.type = parsed.type;
    this.confidence = parsed.confidence;
    this.metadata = parsed.metadata;
    this.periodicity = parsed.periodicity;
    this.timeSignature = parsed.timeSignature;
    this.featureThresholds = new Map(Object.entries(parsed.featureThresholds || {}));
  }
}

// --- Concrete Recognizer Implementation Example (Temporal) ---

interface TemporalPatternRecognizerConfig extends PatternRecognizerConfig {
    timeWindow?: number;
    samplingRate?: number;
    featureConfig?: any;
}

// Mock TemporalFeatureExtractor
class TemporalFeatureExtractor {
    constructor(config: any) {}
    extractFeatures(samples: any[]): any[] {
        // Placeholder: Extract features relevant for temporal analysis
        return samples.map(s => ({ ...s, timestamp: s.timestamp || Date.now() }));
    }
}

class TemporalPatternRecognizer extends PatternRecognizer {
  private timeWindow: number;
  private samplingRate: number;
  private temporalFeatures: TemporalFeatureExtractor;

  constructor(config: TemporalPatternRecognizerConfig) {
    super({
      ...config,
      patternType: PatternType.TEMPORAL
    });

    this.timeWindow = config.timeWindow || 3600000; // 1 hour default
    this.samplingRate = config.samplingRate || 1000; // 1 second default
    this.temporalFeatures = new TemporalFeatureExtractor(config.featureConfig);
    this.initialize(config);
  }

  initialize(config: PatternRecognizerConfig): void {
    this.logger.info(`Initializing TemporalPatternRecognizer: ${this.id}`);
    this.loadPatternsFromStorage();
  }

  async train(data: TrainingData): Promise<TrainingResult> {
    const startTime = Date.now();
    this.logger.info(`Starting training for TemporalPatternRecognizer: ${this.id}`);
    let patternsDetected = 0;
    let accuracy = 0;

    try {
      // Placeholder for actual training logic
      this.logger.warn("TemporalPatternRecognizer.train() is not fully implemented.");
      // 1. Extract temporal features
      // const features = this.temporalFeatures.extractFeatures(data.samples);
      // 2. Apply temporal pattern mining algorithms
      // const temporalPatternsData = this.mineTemporalPatterns(features, data.options);
      // 3. Create pattern objects and add them
      // for (const patternData of temporalPatternsData) {
      //   const pattern = new TemporalPattern(patternData);
      //   this.addPattern(pattern);
      //   patternsDetected++;
      // }
      // 4. Calculate accuracy if labels are provided
      // if (data.labels) {
      //   accuracy = this.calculateAccuracy(temporalPatternsData, data.labels);
      // }

      const trainingTime = Date.now() - startTime;
      this.logger.info(`Training completed in ${trainingTime}ms. Patterns detected: ${patternsDetected}`);
      return {
        success: true,
        patternsDetected,
        accuracy,
        trainingTime
      };
    } catch (error) {
      this.logger.error("Error during temporal pattern training", error);
      return {
        success: false,
        patternsDetected: 0,
        accuracy: 0,
        trainingTime: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  async detectPatterns(data: any): Promise<PatternMatch[]> {
    const startTime = Date.now();
    this.logger.debug(`Detecting temporal patterns for input data...`);

    try {
      // 1. Extract temporal features from the input data
      // Note: Matching logic in this example uses raw data, not extracted features yet.
      // const features = this.temporalFeatures.extractFeatures([data]);
      
      // 2. Match against known patterns
      const patterns = this.getAllPatterns();
      // Use the matcher instance
      const matches = this.matcher.match(data, patterns);

      const duration = Date.now() - startTime;
      this.logger.debug(`Pattern detection completed in ${duration}ms. Found ${matches.length} matches.`);
      
      // 3. Record metrics
      this.metrics.recordMetric("pattern_detection_time", {
        duration,
        recognizerId: this.id,
        patternCount: patterns.length,
        matchCount: matches.length
      });

      // 4. Emit events for detected patterns
      for (const match of matches) {
        this.emitPatternDetected(match);
      }

      return matches;
    } catch (error) {
      this.logger.error("Error during temporal pattern detection", error);
      return [];
    }
  }

  // Placeholder private methods from design
  private mineTemporalPatterns(features: any[], options?: any): any[] {
    this.logger.warn("mineTemporalPatterns not implemented");
    return [];
  }

  private calculateAccuracy(patterns: any[], labels: any[]): number {
    this.logger.warn("calculateAccuracy not implemented");
    return 0;
  }
}

// --- Concrete Pattern Implementation Example (Sequential) ---

interface SequentialPatternData {
    id?: string;
    confidence?: number;
    metadata?: Partial<PatternMetadata>;
    sequence?: any[];
    maxGap?: number;
    allowPartialMatches?: boolean;
    source?: string;
    domain?: string;
    tags?: string[];
}

class SequentialPattern implements IPattern {
  id: string;
  type: PatternType;
  confidence: number;
  metadata: PatternMetadata;

  private sequence: any[];
  private maxGap: number;
  private allowPartialMatches: boolean;

  constructor(data: SequentialPatternData) {
    this.id = data.id || uuidv4();
    this.type = PatternType.SEQUENTIAL;
    this.confidence = data.confidence || 0.5;
    this.metadata = {
      createdAt: data.metadata?.createdAt || Date.now(),
      updatedAt: data.metadata?.updatedAt || Date.now(),
      source: data.source || data.metadata?.source || "unknown",
      domain: data.domain || data.metadata?.domain || "general",
      tags: data.tags || data.metadata?.tags || [],
      occurrences: data.metadata?.occurrences || 0,
      successRate: data.metadata?.successRate || 0,
      averageConfidence: data.metadata?.averageConfidence || this.confidence,
      lastMatchTimestamp: data.metadata?.lastMatchTimestamp || 0,
      customProperties: data.metadata?.customProperties || {},
      patternType: this.type
    };

    this.sequence = data.sequence || [];
    this.maxGap = data.maxGap === undefined ? 1 : data.maxGap; // Default maxGap to 1
    this.allowPartialMatches = data.allowPartialMatches || false;
  }

  matches(data: any): boolean {
    // Basic sequential matching logic
    if (!Array.isArray(data)) return false;
    if (data.length < this.sequence.length && !this.allowPartialMatches) return false;

    // Simple subsequence check (ignoring maxGap for now)
    let patternIndex = 0;
    for (let dataIndex = 0; dataIndex < data.length && patternIndex < this.sequence.length; dataIndex++) {
      if (this.itemsMatch(data[dataIndex], this.sequence[patternIndex])) {
        patternIndex++;
      }
    }
    return patternIndex === this.sequence.length;
  }

  getConfidenceScore(data: any): number {
    // Simple confidence based on matching
    if (!this.matches(data)) {
      return 0;
    }
    // More sophisticated confidence could consider gaps, partial matches etc.
    return this.confidence;
  }

  update(data: any): void {
    this.metadata.updatedAt = Date.now();
    this.metadata.occurrences++;
    this.metadata.lastMatchTimestamp = Date.now();
    this.metadata.averageConfidence = 
        ((this.metadata.averageConfidence * (this.metadata.occurrences - 1)) + this.confidence) / this.metadata.occurrences;
  }

  serialize(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      confidence: this.confidence,
      metadata: this.metadata,
      sequence: this.sequence,
      maxGap: this.maxGap,
      allowPartialMatches: this.allowPartialMatches
    });
  }

  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    this.type = parsed.type;
    this.confidence = parsed.confidence;
    this.metadata = parsed.metadata;
    this.sequence = parsed.sequence;
    this.maxGap = parsed.maxGap;
    this.allowPartialMatches = parsed.allowPartialMatches;
  }

  // Helper for item comparison (can be customized)
  private itemsMatch(item1: any, item2: any): boolean {
    // Simple equality check, can be extended for complex objects
    return JSON.stringify(item1) === JSON.stringify(item2);
  }
}


module.exports = {
    PatternRecognizer,
    TemporalPatternRecognizer,
    TemporalPattern,
    SequentialPattern,
    DefaultPatternStorage,
    DefaultPatternMatcher,
    PatternType
    // Export other necessary classes/interfaces/enums
};
