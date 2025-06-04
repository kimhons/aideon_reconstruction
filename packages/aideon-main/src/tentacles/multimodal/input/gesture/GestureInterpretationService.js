/**
 * @fileoverview GestureInterpretationService analyzes gesture sequences and identifies
 * dominant gestures to provide higher-level interpretation of user intent.
 * 
 * This service processes raw gesture detections from providers like MediaPipe and
 * extracts meaningful patterns, sequences, and dominant gestures to enable more
 * natural and intuitive gesture-based interactions.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events');
const { EnhancedAsyncLock } = require('../utils/EnhancedAsyncLock');

/**
 * @typedef {Object} GestureInterpretationConfig
 * @property {number} sequenceWindowSize - Number of frames to consider for sequence analysis
 * @property {number} minSequenceConfidence - Minimum confidence for sequence detection
 * @property {number} dominantGestureThreshold - Minimum frequency to consider a gesture dominant
 * @property {Object} gestureWeights - Custom weights for different gesture types
 */

/**
 * GestureInterpretationService analyzes gesture sequences and identifies dominant gestures.
 */
class GestureInterpretationService extends EventEmitter {
  /**
   * Creates a new GestureInterpretationService instance.
   * 
   * @param {Object} options - Configuration options
   * @param {GestureInterpretationConfig} options.config - Interpretation configuration
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      sequenceWindowSize: options.sequenceWindowSize || 30, // ~1 second at 30fps
      minSequenceConfidence: options.minSequenceConfidence || 0.6,
      dominantGestureThreshold: options.dominantGestureThreshold || 0.3, // 30% of frames
      gestureWeights: options.gestureWeights || {
        // Default weights for different gesture types
        'Pointing': 1.5,      // Pointing is often intentional, give it higher weight
        'Wave': 1.8,          // Wave is a clear communication gesture
        'Thumbs Up': 1.5,     // Clear affirmative gesture
        'Thumbs Down': 1.5,   // Clear negative gesture
        'Swipe Left': 1.3,    // Navigation gestures
        'Swipe Right': 1.3,
        'Swipe Up': 1.3,
        'Swipe Down': 1.3,
        'Pinch': 1.2,         // Manipulation gesture
        'Open Palm': 1.0,     // Standard weight for basic gestures
        'Closed Fist': 1.0,
        'Victory': 1.0,
        'OK Sign': 1.0,
        'Rock Sign': 1.0,
        'T-Pose': 1.0,
        'Arms Raised': 1.0
      },
      ...(options.config || {})
    };
    
    this.logger = options.logger || console;
    
    // Initialize state
    this.isInitialized = false;
    this.gestureHistory = [];
    this.gestureFrequency = new Map();
    this.sequencePatterns = new Map();
    this.lastAnalysisTime = 0;
    this.analysisInterval = 500; // Analyze every 500ms
    
    // Create locks for thread safety
    this.initLock = new EnhancedAsyncLock();
    this.processLock = new EnhancedAsyncLock();
    
    // Bind methods to ensure correct 'this' context
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.processGestures = this.processGestures.bind(this);
    this.analyzeGestureSequences = this.analyzeGestureSequences.bind(this);
    this.findDominantGestures = this.findDominantGestures.bind(this);
    this.interpret = this.interpret.bind(this);
  }
  
  /**
   * Initializes the GestureInterpretationService.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info('GestureInterpretationService already initialized');
          return true;
        }
        
        this.logger.info('Initializing GestureInterpretationService');
        
        // Load predefined sequence patterns
        this.loadSequencePatterns();
        
        this.isInitialized = true;
        this.emit('initialized');
        this.logger.info('GestureInterpretationService initialized successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to initialize GestureInterpretationService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Loads predefined gesture sequence patterns.
   * 
   * @private
   */
  loadSequencePatterns() {
    // Define common gesture sequences and their interpretations
    this.sequencePatterns.set(
      'wave_sequence',
      {
        pattern: ['Open Palm', 'Closed Fist', 'Open Palm', 'Closed Fist'],
        maxGapFrames: 5,
        interpretation: {
          action: 'Greeting',
          confidence: 0.9
        }
      }
    );
    
    this.sequencePatterns.set(
      'zoom_in_sequence',
      {
        pattern: ['Pinch', 'Open Palm'],
        maxGapFrames: 8,
        interpretation: {
          action: 'ZoomIn',
          confidence: 0.8
        }
      }
    );
    
    this.sequencePatterns.set(
      'zoom_out_sequence',
      {
        pattern: ['Open Palm', 'Pinch'],
        maxGapFrames: 8,
        interpretation: {
          action: 'ZoomOut',
          confidence: 0.8
        }
      }
    );
    
    this.sequencePatterns.set(
      'scroll_down_sequence',
      {
        pattern: ['Open Palm', 'Swipe Down'],
        maxGapFrames: 3,
        interpretation: {
          action: 'ScrollDown',
          confidence: 0.85
        }
      }
    );
    
    this.sequencePatterns.set(
      'scroll_up_sequence',
      {
        pattern: ['Open Palm', 'Swipe Up'],
        maxGapFrames: 3,
        interpretation: {
          action: 'ScrollUp',
          confidence: 0.85
        }
      }
    );
    
    this.sequencePatterns.set(
      'select_sequence',
      {
        pattern: ['Pointing', 'Pinch'],
        maxGapFrames: 5,
        interpretation: {
          action: 'Select',
          confidence: 0.8
        }
      }
    );
    
    this.sequencePatterns.set(
      'cancel_sequence',
      {
        pattern: ['Open Palm', 'Closed Fist'],
        maxGapFrames: 3,
        interpretation: {
          action: 'Cancel',
          confidence: 0.75
        }
      }
    );
    
    this.sequencePatterns.set(
      'next_sequence',
      {
        pattern: ['Swipe Left'],
        maxGapFrames: 0,
        interpretation: {
          action: 'Next',
          confidence: 0.8
        }
      }
    );
    
    this.sequencePatterns.set(
      'previous_sequence',
      {
        pattern: ['Swipe Right'],
        maxGapFrames: 0,
        interpretation: {
          action: 'Previous',
          confidence: 0.8
        }
      }
    );
    
    this.sequencePatterns.set(
      'confirm_sequence',
      {
        pattern: ['Thumbs Up'],
        maxGapFrames: 0,
        interpretation: {
          action: 'Confirm',
          confidence: 0.9
        }
      }
    );
    
    this.sequencePatterns.set(
      'reject_sequence',
      {
        pattern: ['Thumbs Down'],
        maxGapFrames: 0,
        interpretation: {
          action: 'Reject',
          confidence: 0.9
        }
      }
    );
  }
  
  /**
   * Shuts down the GestureInterpretationService.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          this.logger.info('GestureInterpretationService not initialized');
          return true;
        }
        
        this.logger.info('Shutting down GestureInterpretationService');
        
        // Clear state
        this.gestureHistory = [];
        this.gestureFrequency.clear();
        
        this.isInitialized = false;
        this.emit('shutdown');
        this.logger.info('GestureInterpretationService shut down successfully');
        return true;
      } catch (error) {
        this.logger.error('Failed to shut down GestureInterpretationService', error);
        this.emit('error', error);
        return false;
      }
    });
  }
  
  /**
   * Processes new gesture detections.
   * 
   * @param {Array<Object>} gestures - Detected gestures
   * @param {number} timestamp - Current timestamp
   * @returns {Promise<Object>} - Processing result
   */
  async processGestures(gestures, timestamp) {
    return await this.processLock.acquire(async () => {
      try {
        if (!this.isInitialized) {
          throw new Error('GestureInterpretationService not initialized');
        }
        
        // Add gestures to history with timestamp
        const timestampedGestures = gestures.map(gesture => ({
          ...gesture,
          processTimestamp: timestamp
        }));
        
        this.gestureHistory.push(...timestampedGestures);
        
        // Limit history size
        if (this.gestureHistory.length > this.config.sequenceWindowSize * 2) {
          this.gestureHistory = this.gestureHistory.slice(-this.config.sequenceWindowSize * 2);
        }
        
        // Update gesture frequency counts
        for (const gesture of gestures) {
          const count = this.gestureFrequency.get(gesture.name) || 0;
          this.gestureFrequency.set(gesture.name, count + 1);
        }
        
        // Perform analysis periodically
        let analysisResult = null;
        if (timestamp - this.lastAnalysisTime >= this.analysisInterval) {
          // Analyze sequences
          const sequences = await this.analyzeGestureSequences();
          
          // Find dominant gestures
          const dominantGestures = await this.findDominantGestures();
          
          analysisResult = {
            sequences,
            dominantGestures,
            timestamp
          };
          
          this.lastAnalysisTime = timestamp;
          this.emit('analysisCompleted', analysisResult);
        }
        
        return {
          processedCount: gestures.length,
          historySize: this.gestureHistory.length,
          analysisResult
        };
      } catch (error) {
        this.logger.error('Failed to process gestures', error);
        this.emit('error', error);
        throw error;
      }
    });
  }
  
  /**
   * Analyzes gesture sequences in the history.
   * 
   * @returns {Promise<Array<Object>>} - Detected sequences
   */
  async analyzeGestureSequences() {
    try {
      const detectedSequences = [];
      
      // Skip if not enough history
      if (this.gestureHistory.length < 2) {
        return detectedSequences;
      }
      
      // Get recent history within the window size
      const recentHistory = this.gestureHistory.slice(-this.config.sequenceWindowSize);
      
      // Check for each predefined sequence pattern
      for (const [patternName, patternDef] of this.sequencePatterns.entries()) {
        const { pattern, maxGapFrames, interpretation } = patternDef;
        
        // Skip if we don't have enough history for this pattern
        if (recentHistory.length < pattern.length) {
          continue;
        }
        
        // Try to find the pattern in the history
        const matches = this.findPatternMatches(recentHistory, pattern, maxGapFrames);
        
        for (const match of matches) {
          // Calculate confidence based on individual gesture confidences
          const avgConfidence = match.gestures.reduce((sum, g) => sum + g.confidence, 0) / match.gestures.length;
          const sequenceConfidence = avgConfidence * interpretation.confidence;
          
          // Only include sequences with sufficient confidence
          if (sequenceConfidence >= this.config.minSequenceConfidence) {
            detectedSequences.push({
              name: patternName,
              action: interpretation.action,
              confidence: sequenceConfidence,
              startTime: match.gestures[0].processTimestamp,
              endTime: match.gestures[match.gestures.length - 1].processTimestamp,
              duration: match.gestures[match.gestures.length - 1].processTimestamp - match.gestures[0].processTimestamp,
              gestures: match.gestures.map(g => g.name)
            });
          }
        }
      }
      
      // Sort sequences by confidence
      detectedSequences.sort((a, b) => b.confidence - a.confidence);
      
      return detectedSequences;
    } catch (error) {
      this.logger.error('Failed to analyze gesture sequences', error);
      return [];
    }
  }
  
  /**
   * Finds matches of a gesture pattern in the history.
   * 
   * @private
   * @param {Array<Object>} history - Gesture history
   * @param {Array<string>} pattern - Gesture pattern to match
   * @param {number} maxGapFrames - Maximum allowed gap between pattern elements
   * @returns {Array<Object>} - Matches found
   */
  findPatternMatches(history, pattern, maxGapFrames) {
    const matches = [];
    const patternLength = pattern.length;
    
    // Group gestures by hand ID to analyze each hand separately
    const handGroups = new Map();
    
    for (const gesture of history) {
      if (!gesture.handId) continue;
      
      if (!handGroups.has(gesture.handId)) {
        handGroups.set(gesture.handId, []);
      }
      handGroups.get(gesture.handId).push(gesture);
    }
    
    // Process each hand's gestures separately
    for (const [handId, handGestures] of handGroups.entries()) {
      // Sort by timestamp
      handGestures.sort((a, b) => a.processTimestamp - b.processTimestamp);
      
      // Try to find the pattern
      let patternIndex = 0;
      let matchStart = -1;
      let matchGestures = [];
      let gapCount = 0;
      
      for (let i = 0; i < handGestures.length; i++) {
        const gesture = handGestures[i];
        
        if (gesture.name === pattern[patternIndex]) {
          // Found a match for the current pattern element
          if (patternIndex === 0) {
            // Start of a new potential match
            matchStart = i;
            matchGestures = [gesture];
          } else {
            // Continuing a match
            matchGestures.push(gesture);
          }
          
          patternIndex++;
          gapCount = 0;
          
          // Check if we've matched the complete pattern
          if (patternIndex === patternLength) {
            matches.push({
              handId,
              startIndex: matchStart,
              endIndex: i,
              gestures: matchGestures
            });
            
            // Reset to look for more matches
            patternIndex = 0;
            matchStart = -1;
            matchGestures = [];
          }
        } else if (patternIndex > 0) {
          // We're in the middle of a potential match but found a non-matching gesture
          gapCount++;
          
          // If we've exceeded the maximum allowed gap, reset the match
          if (gapCount > maxGapFrames) {
            patternIndex = 0;
            matchStart = -1;
            matchGestures = [];
            gapCount = 0;
          }
        }
      }
    }
    
    // Also check for patterns that don't require specific hand IDs (like pose gestures)
    const nonHandGestures = history.filter(g => !g.handId);
    if (nonHandGestures.length > 0 && pattern.some(p => ['Arms Raised', 'T-Pose'].includes(p))) {
      // Sort by timestamp
      nonHandGestures.sort((a, b) => a.processTimestamp - b.processTimestamp);
      
      // Try to find the pattern
      let patternIndex = 0;
      let matchStart = -1;
      let matchGestures = [];
      let gapCount = 0;
      
      for (let i = 0; i < nonHandGestures.length; i++) {
        const gesture = nonHandGestures[i];
        
        if (gesture.name === pattern[patternIndex]) {
          // Found a match for the current pattern element
          if (patternIndex === 0) {
            // Start of a new potential match
            matchStart = i;
            matchGestures = [gesture];
          } else {
            // Continuing a match
            matchGestures.push(gesture);
          }
          
          patternIndex++;
          gapCount = 0;
          
          // Check if we've matched the complete pattern
          if (patternIndex === patternLength) {
            matches.push({
              poseId: gesture.poseId,
              startIndex: matchStart,
              endIndex: i,
              gestures: matchGestures
            });
            
            // Reset to look for more matches
            patternIndex = 0;
            matchStart = -1;
            matchGestures = [];
          }
        } else if (patternIndex > 0) {
          // We're in the middle of a potential match but found a non-matching gesture
          gapCount++;
          
          // If we've exceeded the maximum allowed gap, reset the match
          if (gapCount > maxGapFrames) {
            patternIndex = 0;
            matchStart = -1;
            matchGestures = [];
            gapCount = 0;
          }
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Finds dominant gestures in the history.
   * 
   * @returns {Promise<Array<Object>>} - Dominant gestures
   */
  async findDominantGestures() {
    try {
      const dominantGestures = [];
      
      // Skip if not enough history
      if (this.gestureHistory.length < 5) {
        return dominantGestures;
      }
      
      // Get recent history within the window size
      const recentHistory = this.gestureHistory.slice(-this.config.sequenceWindowSize);
      const totalFrames = recentHistory.length;
      
      // Count gesture occurrences by hand
      const gestureCountsByHand = new Map();
      
      for (const gesture of recentHistory) {
        const handId = gesture.handId || 'pose';
        const gestureName = gesture.name;
        
        if (!gestureCountsByHand.has(handId)) {
          gestureCountsByHand.set(handId, new Map());
        }
        
        const handCounts = gestureCountsByHand.get(handId);
        const count = handCounts.get(gestureName) || 0;
        handCounts.set(gestureName, count + 1);
      }
      
      // Find dominant gestures for each hand
      for (const [handId, handCounts] of gestureCountsByHand.entries()) {
        const handGestures = recentHistory.filter(g => (g.handId || 'pose') === handId);
        const handFrames = handGestures.length;
        
        // Convert counts to array and sort by frequency
        const gestureCounts = Array.from(handCounts.entries()).map(([name, count]) => {
          // Apply gesture-specific weight
          const weight = this.config.gestureWeights[name] || 1.0;
          const frequency = count / handFrames;
          const weightedFrequency = frequency * weight;
          
          return {
            name,
            count,
            frequency,
            weightedFrequency
          };
        });
        
        // Sort by weighted frequency
        gestureCounts.sort((a, b) => b.weightedFrequency - a.weightedFrequency);
        
        // Add gestures that meet the threshold
        for (const gestureCount of gestureCounts) {
          if (gestureCount.frequency >= this.config.dominantGestureThreshold) {
            // Find the most recent instance of this gesture for this hand
            const recentInstance = [...recentHistory]
              .reverse()
              .find(g => (g.handId || 'pose') === handId && g.name === gestureCount.name);
            
            if (recentInstance) {
              dominantGestures.push({
                name: gestureCount.name,
                handId: handId === 'pose' ? undefined : handId,
                poseId: handId === 'pose' ? recentInstance.poseId : undefined,
                frequency: gestureCount.frequency,
                weightedFrequency: gestureCount.weightedFrequency,
                count: gestureCount.count,
                confidence: recentInstance.confidence,
                lastSeen: recentInstance.processTimestamp
              });
            }
          }
        }
      }
      
      // Sort by weighted frequency
      dominantGestures.sort((a, b) => b.weightedFrequency - a.weightedFrequency);
      
      return dominantGestures;
    } catch (error) {
      this.logger.error('Failed to find dominant gestures', error);
      return [];
    }
  }
  
  /**
   * Interprets a gesture or sequence of gestures.
   * 
   * @param {Object|Array<Object>} input - Gesture or gestures to interpret
   * @returns {Promise<Object>} - Interpretation result
   */
  async interpret(input) {
    try {
      if (!this.isInitialized) {
        throw new Error('GestureInterpretationService not initialized');
      }
      
      // Handle array input
      if (Array.isArray(input)) {
        // Process all gestures
        await this.processGestures(input, Date.now());
        
        // Analyze sequences
        const sequences = await this.analyzeGestureSequences();
        
        // Find dominant gestures
        const dominantGestures = await this.findDominantGestures();
        
        // Return the highest confidence interpretation
        if (sequences.length > 0) {
          const topSequence = sequences[0];
          return {
            action: topSequence.action,
            confidence: topSequence.confidence,
            source: 'sequence',
            details: {
              sequence: topSequence.gestures,
              duration: topSequence.duration
            }
          };
        } else if (dominantGestures.length > 0) {
          const topGesture = dominantGestures[0];
          return this.mapGestureToAction(topGesture);
        } else {
          return {
            action: null,
            confidence: 0,
            source: 'none',
            details: {}
          };
        }
      } else {
        // Single gesture interpretation
        return this.mapGestureToAction(input);
      }
    } catch (error) {
      this.logger.error('Failed to interpret gesture', error);
      return {
        action: null,
        confidence: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Maps a gesture to an action.
   * 
   * @private
   * @param {Object} gesture - Gesture to map
   * @returns {Object} - Action mapping
   */
  mapGestureToAction(gesture) {
    // Direct mappings for common gestures
    const directMappings = {
      'Pointing': { action: 'Select', confidence: 0.8 },
      'Open Palm': { action: 'Stop', confidence: 0.7 },
      'Closed Fist': { action: 'Grab', confidence: 0.7 },
      'Thumbs Up': { action: 'Confirm', confidence: 0.9 },
      'Thumbs Down': { action: 'Reject', confidence: 0.9 },
      'Victory': { action: 'Select', confidence: 0.6 },
      'Pinch': { action: 'Grab', confidence: 0.7 },
      'OK Sign': { action: 'Confirm', confidence: 0.8 },
      'Rock Sign': { action: 'Select', confidence: 0.6 },
      'Swipe Left': { action: 'Next', confidence: 0.8 },
      'Swipe Right': { action: 'Previous', confidence: 0.8 },
      'Swipe Up': { action: 'ScrollUp', confidence: 0.8 },
      'Swipe Down': { action: 'ScrollDown', confidence: 0.8 },
      'Wave': { action: 'Attention', confidence: 0.9 },
      'Arms Raised': { action: 'Attention', confidence: 0.8 },
      'T-Pose': { action: 'Reset', confidence: 0.7 }
    };
    
    const mapping = directMappings[gesture.name];
    
    if (mapping) {
      return {
        action: mapping.action,
        confidence: gesture.confidence * mapping.confidence,
        source: 'gesture',
        details: {
          gesture: gesture.name,
          hand: gesture.hand
        }
      };
    } else {
      return {
        action: null,
        confidence: 0,
        source: 'unknown',
        details: {
          gesture: gesture.name
        }
      };
    }
  }
  
  /**
   * Clears the gesture history.
   */
  clearHistory() {
    this.gestureHistory = [];
    this.gestureFrequency.clear();
    this.lastAnalysisTime = 0;
    this.logger.info('Gesture history cleared');
  }
  
  /**
   * Gets statistics about the gesture history.
   * 
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const totalGestures = this.gestureHistory.length;
    const uniqueGestures = this.gestureFrequency.size;
    const gestureDistribution = Array.from(this.gestureFrequency.entries())
      .map(([name, count]) => ({ name, count, percentage: (count / totalGestures) * 100 }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalGestures,
      uniqueGestures,
      gestureDistribution,
      historyWindowSize: this.config.sequenceWindowSize
    };
  }
}

// Add module.exports at the end of the file
module.exports = { GestureInterpretationService };
