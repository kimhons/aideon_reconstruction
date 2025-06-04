/**
 * @fileoverview Pattern Extraction Engine for Learning from Demonstration.
 * Identifies patterns in recorded actions and extracts parameters.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Extracts patterns from recorded demonstration actions.
 */
class PatternExtractionEngine {
  /**
   * Constructor for PatternExtractionEngine.
   * @param {Object} options Configuration options
   * @param {Object} options.logger Logger instance
   * @param {Object} options.configService Configuration service
   * @param {Object} options.knowledgeGraphManager Knowledge graph manager
   * @param {Object} options.probabilisticKnowledgeManager Probabilistic knowledge manager
   */
  constructor(options) {
    // Validate required dependencies
    if (!options) throw new Error("Options are required for PatternExtractionEngine");
    if (!options.logger) throw new Error("Logger is required for PatternExtractionEngine");
    if (!options.configService) throw new Error("ConfigService is required for PatternExtractionEngine");
    if (!options.knowledgeGraphManager) throw new Error("KnowledgeGraphManager is required for PatternExtractionEngine");
    if (!options.probabilisticKnowledgeManager) throw new Error("ProbabilisticKnowledgeManager is required for PatternExtractionEngine");
    
    // Initialize properties
    this.logger = options.logger;
    this.configService = options.configService;
    this.knowledgeGraphManager = options.knowledgeGraphManager;
    this.probabilisticKnowledgeManager = options.probabilisticKnowledgeManager;
    
    this.logger.info("PatternExtractionEngine created");
  }
  
  /**
   * Extract patterns from a demonstration.
   * @param {Object} demonstration The demonstration to analyze
   * @returns {Promise<Object>} Extracted patterns and metadata
   */
  async extractPatterns(demonstration) {
    if (!demonstration || !demonstration.events || !Array.isArray(demonstration.events)) {
      throw new Error("Valid demonstration with events array is required");
    }
    
    this.logger.info(`Extracting patterns from demonstration: ${demonstration.id}`);
    
    try {
      // Prepare the result object
      const result = {
        demonstrationId: demonstration.id,
        timestamp: Date.now(),
        patterns: [],
        parameters: [],
        sequences: [],
        metadata: {
          eventCount: demonstration.events.length,
          processingTime: 0
        }
      };
      
      const startTime = Date.now();
      
      // Extract action sequences
      const sequences = await this._extractActionSequences(demonstration);
      result.sequences = sequences;
      
      // Identify patterns in sequences
      const patterns = await this._identifyPatterns(sequences, demonstration);
      result.patterns = patterns;
      
      // Extract parameters
      const parameters = await this._extractParameters(patterns, demonstration);
      result.parameters = parameters;
      
      // Calculate processing time
      result.metadata.processingTime = Date.now() - startTime;
      
      this.logger.info(`Pattern extraction complete for demonstration: ${demonstration.id}`, {
        patternCount: patterns.length,
        parameterCount: parameters.length,
        sequenceCount: sequences.length,
        processingTime: result.metadata.processingTime
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error extracting patterns: ${error.message}`, { error, demonstrationId: demonstration.id });
      throw error;
    }
  }
  
  /**
   * Extract action sequences from a demonstration.
   * @private
   * @param {Object} demonstration The demonstration to analyze
   * @returns {Promise<Array<Object>>} Extracted action sequences
   */
  async _extractActionSequences(demonstration) {
    const sequences = [];
    
    try {
      // Filter events to only include actions
      const actionEvents = demonstration.events.filter(event => 
        event.type.startsWith('action.') || 
        event.type === 'context.applicationChange'
      );
      
      if (actionEvents.length === 0) {
        this.logger.warn(`No action events found in demonstration: ${demonstration.id}`);
        return sequences;
      }
      
      // Sort events by timestamp
      actionEvents.sort((a, b) => a.timestamp - b.timestamp);
      
      // Group events by application
      const applicationGroups = new Map();
      let currentApp = null;
      
      for (const event of actionEvents) {
        if (event.type === 'context.applicationChange') {
          currentApp = event.application.id;
          if (!applicationGroups.has(currentApp)) {
            applicationGroups.set(currentApp, []);
          }
        } else if (currentApp) {
          const appEvents = applicationGroups.get(currentApp);
          appEvents.push(event);
        }
      }
      
      // Process each application group
      for (const [appId, appEvents] of applicationGroups.entries()) {
        if (appEvents.length === 0) continue;
        
        // Create a sequence for this application
        const sequence = {
          id: `seq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          applicationId: appId,
          applicationName: appEvents[0]?.application?.name || "Unknown",
          startTime: appEvents[0]?.timestamp,
          endTime: appEvents[appEvents.length - 1]?.timestamp,
          actions: appEvents,
          metadata: {
            demonstrationId: demonstration.id,
            actionCount: appEvents.length,
            duration: (appEvents[appEvents.length - 1]?.timestamp - appEvents[0]?.timestamp) / 1000 // in seconds
          }
        };
        
        sequences.push(sequence);
      }
      
      // Look for cross-application sequences
      if (sequences.length > 1) {
        const crossAppSequence = {
          id: `seq_cross_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          type: 'cross-application',
          startTime: actionEvents[0]?.timestamp,
          endTime: actionEvents[actionEvents.length - 1]?.timestamp,
          actions: actionEvents,
          applications: Array.from(applicationGroups.keys()),
          metadata: {
            demonstrationId: demonstration.id,
            actionCount: actionEvents.length,
            applicationCount: applicationGroups.size,
            duration: (actionEvents[actionEvents.length - 1]?.timestamp - actionEvents[0]?.timestamp) / 1000 // in seconds
          }
        };
        
        sequences.push(crossAppSequence);
      }
      
      return sequences;
    } catch (error) {
      this.logger.error(`Error extracting action sequences: ${error.message}`, { error, demonstrationId: demonstration.id });
      return sequences;
    }
  }
  
  /**
   * Identify patterns in action sequences.
   * @private
   * @param {Array<Object>} sequences Action sequences to analyze
   * @param {Object} demonstration The original demonstration
   * @returns {Promise<Array<Object>>} Identified patterns
   */
  async _identifyPatterns(sequences, demonstration) {
    const patterns = [];
    
    try {
      // Process each sequence
      for (const sequence of sequences) {
        // Skip sequences with too few actions
        if (sequence.actions.length < 2) continue;
        
        // Look for repetitive patterns
        const repetitivePatterns = await this._findRepetitivePatterns(sequence);
        patterns.push(...repetitivePatterns);
        
        // Look for workflow patterns
        const workflowPatterns = await this._findWorkflowPatterns(sequence);
        patterns.push(...workflowPatterns);
        
        // Look for data transformation patterns
        const dataPatterns = await this._findDataTransformationPatterns(sequence);
        patterns.push(...dataPatterns);
      }
      
      // Deduplicate patterns
      const uniquePatterns = this._deduplicatePatterns(patterns);
      
      // Calculate confidence scores
      const scoredPatterns = await this._calculatePatternConfidence(uniquePatterns, demonstration);
      
      // Sort by confidence score
      scoredPatterns.sort((a, b) => b.confidence - a.confidence);
      
      return scoredPatterns;
    } catch (error) {
      this.logger.error(`Error identifying patterns: ${error.message}`, { error, demonstrationId: demonstration.id });
      return patterns;
    }
  }
  
  /**
   * Find repetitive patterns in a sequence.
   * @private
   * @param {Object} sequence The sequence to analyze
   * @returns {Promise<Array<Object>>} Repetitive patterns
   */
  async _findRepetitivePatterns(sequence) {
    const patterns = [];
    const actions = sequence.actions;
    
    try {
      // Look for repeating action types
      const actionTypes = actions.map(action => action.type);
      const actionTypeCounts = {};
      
      for (const type of actionTypes) {
        actionTypeCounts[type] = (actionTypeCounts[type] || 0) + 1;
      }
      
      // Find action types that repeat
      for (const [type, count] of Object.entries(actionTypeCounts)) {
        if (count >= 2) {
          // Get all actions of this type
          const typeActions = actions.filter(action => action.type === type);
          
          // Look for similarities between these actions
          const similarities = this._findActionSimilarities(typeActions);
          
          if (Object.keys(similarities.common).length > 0) {
            // Create a pattern
            const pattern = {
              id: `pattern_rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              type: 'repetitive',
              actionType: type,
              count: count,
              commonProperties: similarities.common,
              variableProperties: similarities.variable,
              actions: typeActions.map(action => action.id),
              sequenceId: sequence.id,
              confidence: 0 // Will be calculated later
            };
            
            patterns.push(pattern);
          }
        }
      }
      
      // Look for repeating sequences of actions
      if (actions.length >= 4) { // Need at least 4 actions to find a repeating sequence of 2
        for (let patternLength = 2; patternLength <= Math.floor(actions.length / 2); patternLength++) {
          const repeatingSequences = this._findRepeatingActionSequences(actions, patternLength);
          
          for (const repeatingSequence of repeatingSequences) {
            const pattern = {
              id: `pattern_seq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              type: 'sequence',
              length: patternLength,
              count: repeatingSequence.count,
              actionTypes: repeatingSequence.actionTypes,
              occurrences: repeatingSequence.occurrences,
              sequenceId: sequence.id,
              confidence: 0 // Will be calculated later
            };
            
            patterns.push(pattern);
          }
        }
      }
      
      return patterns;
    } catch (error) {
      this.logger.error(`Error finding repetitive patterns: ${error.message}`, { error, sequenceId: sequence.id });
      return patterns;
    }
  }
  
  /**
   * Find workflow patterns in a sequence.
   * @private
   * @param {Object} sequence The sequence to analyze
   * @returns {Promise<Array<Object>>} Workflow patterns
   */
  async _findWorkflowPatterns(sequence) {
    const patterns = [];
    const actions = sequence.actions;
    
    try {
      // Check for common workflow patterns
      
      // File operations pattern
      const fileOperations = actions.filter(action => 
        action.type === 'action.fileOpen' || 
        action.type === 'action.fileSave'
      );
      
      if (fileOperations.length >= 2) {
        const pattern = {
          id: `pattern_workflow_file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          type: 'workflow',
          subtype: 'file-operations',
          actions: fileOperations.map(action => action.id),
          actionTypes: fileOperations.map(action => action.type),
          sequenceId: sequence.id,
          confidence: 0 // Will be calculated later
        };
        
        patterns.push(pattern);
      }
      
      // Form filling pattern
      const formActions = actions.filter(action => 
        action.type === 'action.input' || 
        (action.type === 'action.click' && action.target?.type === 'button')
      );
      
      if (formActions.length >= 3) {
        const inputActions = formActions.filter(action => action.type === 'action.input');
        const buttonActions = formActions.filter(action => 
          action.type === 'action.click' && action.target?.type === 'button'
        );
        
        if (inputActions.length >= 2 && buttonActions.length >= 1) {
          const pattern = {
            id: `pattern_workflow_form_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            type: 'workflow',
            subtype: 'form-filling',
            inputFields: inputActions.length,
            buttons: buttonActions.length,
            actions: formActions.map(action => action.id),
            sequenceId: sequence.id,
            confidence: 0 // Will be calculated later
          };
          
          patterns.push(pattern);
        }
      }
      
      // Copy-paste pattern
      const clipboardActions = actions.filter(action => 
        action.type === 'action.copy' || 
        action.type === 'action.paste'
      );
      
      if (clipboardActions.length >= 2) {
        const copyActions = clipboardActions.filter(action => action.type === 'action.copy');
        const pasteActions = clipboardActions.filter(action => action.type === 'action.paste');
        
        if (copyActions.length >= 1 && pasteActions.length >= 1) {
          const pattern = {
            id: `pattern_workflow_clipboard_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            type: 'workflow',
            subtype: 'copy-paste',
            copyCount: copyActions.length,
            pasteCount: pasteActions.length,
            actions: clipboardActions.map(action => action.id),
            sequenceId: sequence.id,
            confidence: 0 // Will be calculated later
          };
          
          patterns.push(pattern);
        }
      }
      
      return patterns;
    } catch (error) {
      this.logger.error(`Error finding workflow patterns: ${error.message}`, { error, sequenceId: sequence.id });
      return patterns;
    }
  }
  
  /**
   * Find data transformation patterns in a sequence.
   * @private
   * @param {Object} sequence The sequence to analyze
   * @returns {Promise<Array<Object>>} Data transformation patterns
   */
  async _findDataTransformationPatterns(sequence) {
    const patterns = [];
    const actions = sequence.actions;
    
    try {
      // Look for copy-paste with modifications
      const copyActions = actions.filter(action => action.type === 'action.copy');
      const pasteActions = actions.filter(action => action.type === 'action.paste');
      
      if (copyActions.length >= 1 && pasteActions.length >= 1) {
        // Look for input actions between copy and paste
        for (let i = 0; i < copyActions.length; i++) {
          const copyAction = copyActions[i];
          
          // Find the next paste action after this copy
          const nextPasteIndex = actions.findIndex(action => 
            action.type === 'action.paste' && action.timestamp > copyAction.timestamp
          );
          
          if (nextPasteIndex !== -1) {
            const pasteAction = actions[nextPasteIndex];
            
            // Look for input or keypress actions between copy and paste
            const modificationActions = actions.filter(action => 
              (action.type === 'action.input' || action.type === 'action.keypress') && 
              action.timestamp > copyAction.timestamp && 
              action.timestamp < pasteAction.timestamp
            );
            
            if (modificationActions.length > 0) {
              const pattern = {
                id: `pattern_data_transform_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                type: 'data-transformation',
                subtype: 'copy-modify-paste',
                copyAction: copyAction.id,
                pasteAction: pasteAction.id,
                modificationActions: modificationActions.map(action => action.id),
                modificationCount: modificationActions.length,
                sequenceId: sequence.id,
                confidence: 0 // Will be calculated later
              };
              
              patterns.push(pattern);
            }
          }
        }
      }
      
      return patterns;
    } catch (error) {
      this.logger.error(`Error finding data transformation patterns: ${error.message}`, { error, sequenceId: sequence.id });
      return patterns;
    }
  }
  
  /**
   * Find similarities between actions of the same type.
   * @private
   * @param {Array<Object>} actions Actions to compare
   * @returns {Object} Common and variable properties
   */
  _findActionSimilarities(actions) {
    const result = {
      common: {},
      variable: {}
    };
    
    if (actions.length < 2) return result;
    
    try {
      // Get all property paths from the first action
      const propertyPaths = this._extractPropertyPaths(actions[0]);
      
      // Check each property path across all actions
      for (const path of propertyPaths) {
        const values = actions.map(action => this._getPropertyByPath(action, path));
        
        // Check if all values are the same
        const allSame = values.every(value => JSON.stringify(value) === JSON.stringify(values[0]));
        
        if (allSame) {
          // This is a common property
          result.common[path] = values[0];
        } else {
          // This is a variable property
          result.variable[path] = values;
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error finding action similarities: ${error.message}`, { error });
      return result;
    }
  }
  
  /**
   * Extract all property paths from an object.
   * @private
   * @param {Object} obj Object to extract paths from
   * @param {string} [prefix=''] Current path prefix
   * @returns {Array<string>} Array of property paths
   */
  _extractPropertyPaths(obj, prefix = '') {
    const paths = [];
    
    if (!obj || typeof obj !== 'object') return paths;
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const newPath = prefix ? `${prefix}.${key}` : key;
        
        paths.push(newPath);
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Recurse for nested objects
          const nestedPaths = this._extractPropertyPaths(value, newPath);
          paths.push(...nestedPaths);
        }
      }
    }
    
    return paths;
  }
  
  /**
   * Get a property value by its path.
   * @private
   * @param {Object} obj Object to get property from
   * @param {string} path Property path (e.g., 'target.selector')
   * @returns {*} Property value
   */
  _getPropertyByPath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Find repeating sequences of actions.
   * @private
   * @param {Array<Object>} actions Actions to analyze
   * @param {number} patternLength Length of pattern to look for
   * @returns {Array<Object>} Repeating sequences
   */
  _findRepeatingActionSequences(actions, patternLength) {
    const results = [];
    
    try {
      // Convert actions to type sequences for easier comparison
      const actionTypes = actions.map(action => action.type);
      
      // Look for repeating sequences of the specified length
      for (let i = 0; i <= actionTypes.length - patternLength * 2; i++) {
        const pattern = actionTypes.slice(i, i + patternLength);
        const patternStr = pattern.join(',');
        
        // Look for occurrences of this pattern
        const occurrences = [];
        
        for (let j = 0; j <= actionTypes.length - patternLength; j++) {
          const sequence = actionTypes.slice(j, j + patternLength);
          const sequenceStr = sequence.join(',');
          
          if (sequenceStr === patternStr) {
            occurrences.push({
              startIndex: j,
              endIndex: j + patternLength - 1,
              actions: actions.slice(j, j + patternLength).map(action => action.id)
            });
          }
        }
        
        // If we found multiple occurrences, add to results
        if (occurrences.length >= 2) {
          // Check if this pattern is already in results
          const existingPattern = results.find(result => result.patternStr === patternStr);
          
          if (!existingPattern) {
            results.push({
              patternStr,
              actionTypes: pattern,
              count: occurrences.length,
              occurrences
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error(`Error finding repeating action sequences: ${error.message}`, { error, patternLength });
      return results;
    }
  }
  
  /**
   * Deduplicate patterns.
   * @private
   * @param {Array<Object>} patterns Patterns to deduplicate
   * @returns {Array<Object>} Deduplicated patterns
   */
  _deduplicatePatterns(patterns) {
    const uniquePatterns = [];
    const patternMap = new Map();
    
    for (const pattern of patterns) {
      // Create a key for this pattern
      let key;
      
      if (pattern.type === 'repetitive') {
        key = `repetitive:${pattern.actionType}:${JSON.stringify(pattern.commonProperties)}`;
      } else if (pattern.type === 'sequence') {
        key = `sequence:${pattern.actionTypes.join(',')}`;
      } else if (pattern.type === 'workflow') {
        key = `workflow:${pattern.subtype}:${pattern.sequenceId}`;
      } else if (pattern.type === 'data-transformation') {
        key = `data-transformation:${pattern.subtype}:${pattern.copyAction}:${pattern.pasteAction}`;
      } else {
        // Unknown pattern type, keep it
        uniquePatterns.push(pattern);
        continue;
      }
      
      // Check if we've seen this pattern before
      if (!patternMap.has(key)) {
        patternMap.set(key, pattern);
        uniquePatterns.push(pattern);
      }
    }
    
    return uniquePatterns;
  }
  
  /**
   * Calculate confidence scores for patterns.
   * @private
   * @param {Array<Object>} patterns Patterns to score
   * @param {Object} demonstration The original demonstration
   * @returns {Promise<Array<Object>>} Patterns with confidence scores
   */
  async _calculatePatternConfidence(patterns, demonstration) {
    try {
      for (const pattern of patterns) {
        let confidence = 0;
        
        // Base confidence on pattern type
        switch (pattern.type) {
          case 'repetitive':
            // Higher confidence for more repetitions and more common properties
            confidence = 0.5 + 
              Math.min(0.3, pattern.count * 0.05) + 
              Math.min(0.2, Object.keys(pattern.commonProperties).length * 0.02);
            break;
            
          case 'sequence':
            // Higher confidence for longer sequences with more repetitions
            confidence = 0.4 + 
              Math.min(0.3, pattern.length * 0.05) + 
              Math.min(0.3, pattern.count * 0.05);
            break;
            
          case 'workflow':
            // Different confidence based on workflow subtype
            switch (pattern.subtype) {
              case 'file-operations':
                confidence = 0.7;
                break;
              case 'form-filling':
                confidence = 0.8;
                break;
              case 'copy-paste':
                confidence = 0.6;
                break;
              default:
                confidence = 0.5;
            }
            break;
            
          case 'data-transformation':
            // Higher confidence for more modifications
            confidence = 0.6 + Math.min(0.3, pattern.modificationCount * 0.05);
            break;
            
          default:
            confidence = 0.5;
        }
        
        // Check if similar patterns exist in knowledge graph
        try {
          const similarPatterns = await this._findSimilarPatternsInKnowledgeGraph(pattern);
          
          if (similarPatterns.length > 0) {
            // Boost confidence based on number of similar patterns
            const boost = Math.min(0.2, similarPatterns.length * 0.05);
            confidence += boost;
          }
        } catch (error) {
          this.logger.error(`Error finding similar patterns in knowledge graph: ${error.message}`, { error, patternId: pattern.id });
          // Continue without boosting confidence
        }
        
        // Ensure confidence is between 0 and 1
        pattern.confidence = Math.max(0, Math.min(1, confidence));
        
        // Add confidence explanation
        pattern.confidenceExplanation = this._generateConfidenceExplanation(pattern);
      }
      
      return patterns;
    } catch (error) {
      this.logger.error(`Error calculating pattern confidence: ${error.message}`, { error, demonstrationId: demonstration.id });
      // Return patterns with default confidence
      return patterns.map(pattern => ({
        ...pattern,
        confidence: pattern.confidence || 0.5
      }));
    }
  }
  
  /**
   * Find similar patterns in the knowledge graph.
   * @private
   * @param {Object} pattern Pattern to find similar patterns for
   * @returns {Promise<Array<Object>>} Similar patterns
   */
  async _findSimilarPatternsInKnowledgeGraph(pattern) {
    try {
      // Query depends on pattern type
      let query;
      
      switch (pattern.type) {
        case 'repetitive':
          query = {
            type: 'Pattern',
            properties: {
              patternType: 'repetitive',
              actionType: pattern.actionType
            }
          };
          break;
          
        case 'sequence':
          query = {
            type: 'Pattern',
            properties: {
              patternType: 'sequence',
              actionTypesCount: pattern.actionTypes.length
            }
          };
          break;
          
        case 'workflow':
          query = {
            type: 'Pattern',
            properties: {
              patternType: 'workflow',
              subtype: pattern.subtype
            }
          };
          break;
          
        case 'data-transformation':
          query = {
            type: 'Pattern',
            properties: {
              patternType: 'data-transformation',
              subtype: pattern.subtype
            }
          };
          break;
          
        default:
          return [];
      }
      
      // Query the knowledge graph
      const results = await this.knowledgeGraphManager.query(query);
      
      return results;
    } catch (error) {
      this.logger.error(`Error querying knowledge graph for similar patterns: ${error.message}`, { error, patternType: pattern.type });
      return [];
    }
  }
  
  /**
   * Generate an explanation for a pattern's confidence score.
   * @private
   * @param {Object} pattern Pattern to explain confidence for
   * @returns {string} Confidence explanation
   */
  _generateConfidenceExplanation(pattern) {
    let explanation = `Base confidence for ${pattern.type} pattern`;
    
    switch (pattern.type) {
      case 'repetitive':
        explanation += `: ${pattern.count} repetitions of action type "${pattern.actionType}"`;
        explanation += ` with ${Object.keys(pattern.commonProperties).length} common properties`;
        break;
        
      case 'sequence':
        explanation += `: sequence of ${pattern.length} actions repeated ${pattern.count} times`;
        break;
        
      case 'workflow':
        explanation += `: recognized "${pattern.subtype}" workflow pattern`;
        break;
        
      case 'data-transformation':
        explanation += `: "${pattern.subtype}" with ${pattern.modificationCount} modifications`;
        break;
    }
    
    return explanation;
  }
  
  /**
   * Extract parameters from patterns.
   * @private
   * @param {Array<Object>} patterns Patterns to extract parameters from
   * @param {Object} demonstration The original demonstration
   * @returns {Promise<Array<Object>>} Extracted parameters
   */
  async _extractParameters(patterns, demonstration) {
    const parameters = [];
    
    try {
      // Process each pattern
      for (const pattern of patterns) {
        switch (pattern.type) {
          case 'repetitive':
            // Extract parameters from variable properties
            for (const [path, values] of Object.entries(pattern.variableProperties)) {
              // Skip if all values are null or undefined
              if (values.every(value => value === null || value === undefined)) continue;
              
              // Create parameter
              const parameter = {
                id: `param_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                name: this._generateParameterName(path),
                path,
                patternId: pattern.id,
                type: this._inferParameterType(values),
                values,
                metadata: {
                  demonstrationId: demonstration.id,
                  patternType: pattern.type,
                  confidence: pattern.confidence
                }
              };
              
              parameters.push(parameter);
            }
            break;
            
          case 'workflow':
            // Extract parameters based on workflow subtype
            if (pattern.subtype === 'form-filling') {
              // Extract input field values
              const inputActions = demonstration.events.filter(event => 
                pattern.actions.includes(event.id) && 
                event.type === 'action.input'
              );
              
              for (const inputAction of inputActions) {
                if (!inputAction.value?.text) continue;
                
                // Create parameter
                const parameter = {
                  id: `param_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                  name: this._generateInputParameterName(inputAction),
                  actionId: inputAction.id,
                  patternId: pattern.id,
                  type: 'string',
                  value: inputAction.value.text,
                  metadata: {
                    demonstrationId: demonstration.id,
                    patternType: pattern.type,
                    patternSubtype: pattern.subtype,
                    confidence: pattern.confidence,
                    isPassword: inputAction.value?.isPassword || false
                  }
                };
                
                parameters.push(parameter);
              }
            } else if (pattern.subtype === 'file-operations') {
              // Extract file paths
              const fileActions = demonstration.events.filter(event => 
                pattern.actions.includes(event.id) && 
                (event.type === 'action.fileOpen' || event.type === 'action.fileSave')
              );
              
              for (const fileAction of fileActions) {
                if (!fileAction.file?.path) continue;
                
                // Create parameter
                const parameter = {
                  id: `param_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                  name: fileAction.type === 'action.fileOpen' ? 'inputFilePath' : 'outputFilePath',
                  actionId: fileAction.id,
                  patternId: pattern.id,
                  type: 'file',
                  value: fileAction.file.path,
                  metadata: {
                    demonstrationId: demonstration.id,
                    patternType: pattern.type,
                    patternSubtype: pattern.subtype,
                    confidence: pattern.confidence,
                    fileName: fileAction.file.name,
                    fileType: fileAction.file.type
                  }
                };
                
                parameters.push(parameter);
              }
            }
            break;
            
          case 'data-transformation':
            // Extract transformation parameters
            if (pattern.subtype === 'copy-modify-paste') {
              // Get copy and paste actions
              const copyAction = demonstration.events.find(event => event.id === pattern.copyAction);
              const pasteAction = demonstration.events.find(event => event.id === pattern.pasteAction);
              
              if (copyAction?.content?.text && pasteAction?.content?.text) {
                // Create parameter for transformation
                const parameter = {
                  id: `param_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                  name: 'transformationPattern',
                  patternId: pattern.id,
                  type: 'transformation',
                  sourceValue: copyAction.content.text,
                  targetValue: pasteAction.content.text,
                  metadata: {
                    demonstrationId: demonstration.id,
                    patternType: pattern.type,
                    patternSubtype: pattern.subtype,
                    confidence: pattern.confidence,
                    modificationCount: pattern.modificationCount
                  }
                };
                
                parameters.push(parameter);
              }
            }
            break;
        }
      }
      
      return parameters;
    } catch (error) {
      this.logger.error(`Error extracting parameters: ${error.message}`, { error, demonstrationId: demonstration.id });
      return parameters;
    }
  }
  
  /**
   * Generate a parameter name from a property path.
   * @private
   * @param {string} path Property path
   * @returns {string} Parameter name
   */
  _generateParameterName(path) {
    // Convert path to camelCase
    const parts = path.split('.');
    const name = parts.map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');
    
    return name;
  }
  
  /**
   * Generate a parameter name for an input action.
   * @private
   * @param {Object} inputAction Input action
   * @returns {string} Parameter name
   */
  _generateInputParameterName(inputAction) {
    // Try to use element ID or other attributes
    if (inputAction.target?.id) {
      return `input_${inputAction.target.id}`;
    }
    
    if (inputAction.target?.attributes?.name) {
      return `input_${inputAction.target.attributes.name}`;
    }
    
    if (inputAction.target?.attributes?.placeholder) {
      return `input_${inputAction.target.attributes.placeholder.replace(/\s+/g, '_').toLowerCase()}`;
    }
    
    // Fallback to generic name
    return `input_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  /**
   * Infer parameter type from values.
   * @private
   * @param {Array<*>} values Values to infer type from
   * @returns {string} Parameter type
   */
  _inferParameterType(values) {
    // Check if all values are of the same type
    const types = values.map(value => {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'string') return 'string';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'boolean') return 'boolean';
      if (Array.isArray(value)) return 'array';
      if (typeof value === 'object') return 'object';
      return 'unknown';
    });
    
    // If all types are the same, use that
    if (types.every(type => type === types[0])) {
      return types[0] === 'null' ? 'string' : types[0];
    }
    
    // If mix of strings and numbers, check if numbers can be parsed from strings
    if (types.every(type => type === 'string' || type === 'number')) {
      const allCanBeNumbers = values.every(value => {
        if (typeof value === 'number') return true;
        return !isNaN(parseFloat(value)) && isFinite(value);
      });
      
      if (allCanBeNumbers) return 'number';
    }
    
    // Default to string
    return 'string';
  }
}

module.exports = PatternExtractionEngine;
