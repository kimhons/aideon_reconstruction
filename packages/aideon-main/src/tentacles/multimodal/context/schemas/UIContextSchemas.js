/**
 * @fileoverview UI Context Schemas for the Aideon AI Desktop Agent.
 * 
 * This module defines the schemas for all UI context types used in the MCP integration
 * for User Interface tentacles, including UI state, interactions, preferences,
 * accessibility, and themes.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

/**
 * Base schema for all UI contexts.
 */
const baseUIContextSchema = {
  type: 'object',
  required: ['version', 'timestamp'],
  properties: {
    version: {
      type: 'string',
      description: 'Schema version for backward compatibility'
    },
    timestamp: {
      type: 'number',
      description: 'Unix timestamp when the context was created or updated'
    }
  }
};

/**
 * Schema for UI state context.
 */
const uiStateCurrentSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'state', 'viewId'],
  properties: {
    ...baseUIContextSchema.properties,
    state: {
      type: 'string',
      enum: ['loading', 'ready', 'error', 'updating', 'transitioning'],
      description: 'Current UI state'
    },
    viewId: {
      type: 'string',
      description: 'Identifier for the current view'
    },
    viewData: {
      type: 'object',
      description: 'Data associated with the current view'
    },
    modalState: {
      type: 'object',
      properties: {
        isOpen: {
          type: 'boolean',
          description: 'Whether a modal is currently open'
        },
        modalId: {
          type: 'string',
          description: 'Identifier for the open modal'
        },
        modalData: {
          type: 'object',
          description: 'Data associated with the open modal'
        }
      }
    },
    navigationStack: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Stack of view identifiers representing the navigation history'
    }
  }
};

/**
 * Schema for UI state history context.
 */
const uiStateHistorySchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'stateHistory'],
  properties: {
    ...baseUIContextSchema.properties,
    stateHistory: {
      type: 'array',
      items: {
        type: 'object',
        required: ['state', 'viewId', 'timestamp'],
        properties: {
          state: {
            type: 'string',
            enum: ['loading', 'ready', 'error', 'updating', 'transitioning'],
            description: 'UI state'
          },
          viewId: {
            type: 'string',
            description: 'Identifier for the view'
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp when the state was active'
          },
          duration: {
            type: 'number',
            description: 'Duration in milliseconds that the state was active'
          }
        }
      },
      description: 'History of UI states'
    },
    maxHistoryLength: {
      type: 'number',
      description: 'Maximum number of history entries to maintain'
    }
  }
};

/**
 * Schema for UI interaction event context.
 */
const uiInteractionEventSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'eventType', 'elementId'],
  properties: {
    ...baseUIContextSchema.properties,
    eventType: {
      type: 'string',
      enum: ['click', 'input', 'scroll', 'hover', 'focus', 'blur', 'keypress', 'drag', 'drop', 'resize', 'custom'],
      description: 'Type of interaction event'
    },
    elementId: {
      type: 'string',
      description: 'Identifier for the UI element that was interacted with'
    },
    elementType: {
      type: 'string',
      description: 'Type of UI element (button, input, etc.)'
    },
    viewId: {
      type: 'string',
      description: 'Identifier for the view where the interaction occurred'
    },
    value: {
      type: ['string', 'number', 'boolean', 'object', 'null'],
      description: 'Value associated with the interaction (e.g., input value)'
    },
    position: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate of the interaction'
        },
        y: {
          type: 'number',
          description: 'Y coordinate of the interaction'
        }
      },
      description: 'Position of the interaction'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata about the interaction'
    }
  }
};

/**
 * Schema for UI interaction pattern context.
 */
const uiInteractionPatternSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'patternType', 'confidence'],
  properties: {
    ...baseUIContextSchema.properties,
    patternType: {
      type: 'string',
      enum: ['navigation', 'form-filling', 'data-exploration', 'configuration', 'search', 'custom'],
      description: 'Type of interaction pattern'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence level in the pattern detection (0-1)'
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          eventType: {
            type: 'string',
            description: 'Type of interaction event'
          },
          elementId: {
            type: 'string',
            description: 'Identifier for the UI element'
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp of the event'
          }
        }
      },
      description: 'Sequence of events that form the pattern'
    },
    frequency: {
      type: 'number',
      description: 'Number of times this pattern has been observed'
    },
    lastObserved: {
      type: 'number',
      description: 'Unix timestamp when this pattern was last observed'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata about the pattern'
    }
  }
};

/**
 * Schema for UI preference setting context.
 */
const uiPreferenceSettingSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'preferenceId', 'value'],
  properties: {
    ...baseUIContextSchema.properties,
    preferenceId: {
      type: 'string',
      description: 'Identifier for the preference'
    },
    category: {
      type: 'string',
      description: 'Category of the preference'
    },
    value: {
      type: ['string', 'number', 'boolean', 'object', 'null'],
      description: 'Value of the preference'
    },
    defaultValue: {
      type: ['string', 'number', 'boolean', 'object', 'null'],
      description: 'Default value of the preference'
    },
    scope: {
      type: 'string',
      enum: ['user', 'workspace', 'application', 'global'],
      description: 'Scope of the preference'
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata about the preference'
    }
  }
};

/**
 * Schema for UI preference default context.
 */
const uiPreferenceDefaultSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'defaults'],
  properties: {
    ...baseUIContextSchema.properties,
    defaults: {
      type: 'object',
      description: 'Map of preference identifiers to default values'
    },
    userTier: {
      type: 'string',
      description: 'User tier that these defaults apply to'
    },
    platform: {
      type: 'string',
      description: 'Platform that these defaults apply to'
    },
    version: {
      type: 'string',
      description: 'Application version that these defaults apply to'
    }
  }
};

/**
 * Schema for UI accessibility requirement context.
 */
const uiAccessibilityRequirementSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'requirements'],
  properties: {
    ...baseUIContextSchema.properties,
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'enabled'],
        properties: {
          type: {
            type: 'string',
            enum: ['screenReader', 'highContrast', 'largeText', 'keyboardNavigation', 'colorBlindMode', 'reducedMotion', 'custom'],
            description: 'Type of accessibility requirement'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the requirement is enabled'
          },
          level: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Level of the requirement'
          },
          customSettings: {
            type: 'object',
            description: 'Custom settings for the requirement'
          }
        }
      },
      description: 'List of accessibility requirements'
    },
    detectionMethod: {
      type: 'string',
      enum: ['userPreference', 'systemSetting', 'autoDetected', 'manual'],
      description: 'Method used to detect accessibility requirements'
    },
    lastUpdated: {
      type: 'number',
      description: 'Unix timestamp when requirements were last updated'
    }
  }
};

/**
 * Schema for UI accessibility adaptation context.
 */
const uiAccessibilityAdaptationSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'adaptations'],
  properties: {
    ...baseUIContextSchema.properties,
    adaptations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'elementId', 'adaptation'],
        properties: {
          type: {
            type: 'string',
            enum: ['textSize', 'contrast', 'colorAdjustment', 'focusIndicator', 'alternativeText', 'keyboardShortcut', 'custom'],
            description: 'Type of adaptation'
          },
          elementId: {
            type: 'string',
            description: 'Identifier for the UI element being adapted'
          },
          viewId: {
            type: 'string',
            description: 'Identifier for the view containing the element'
          },
          adaptation: {
            type: 'object',
            description: 'Adaptation details'
          },
          requirement: {
            type: 'string',
            description: 'Accessibility requirement that triggered this adaptation'
          }
        }
      },
      description: 'List of accessibility adaptations'
    },
    globalAdaptations: {
      type: 'object',
      description: 'Global adaptations applied to the entire UI'
    }
  }
};

/**
 * Schema for UI theme current context.
 */
const uiThemeCurrentSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'themeId', 'colorScheme'],
  properties: {
    ...baseUIContextSchema.properties,
    themeId: {
      type: 'string',
      description: 'Identifier for the current theme'
    },
    name: {
      type: 'string',
      description: 'Display name of the theme'
    },
    colorScheme: {
      type: 'string',
      enum: ['light', 'dark', 'system', 'custom'],
      description: 'Color scheme of the theme'
    },
    colors: {
      type: 'object',
      properties: {
        primary: {
          type: 'string',
          description: 'Primary color'
        },
        secondary: {
          type: 'string',
          description: 'Secondary color'
        },
        background: {
          type: 'string',
          description: 'Background color'
        },
        surface: {
          type: 'string',
          description: 'Surface color'
        },
        error: {
          type: 'string',
          description: 'Error color'
        },
        text: {
          type: 'object',
          properties: {
            primary: {
              type: 'string',
              description: 'Primary text color'
            },
            secondary: {
              type: 'string',
              description: 'Secondary text color'
            },
            disabled: {
              type: 'string',
              description: 'Disabled text color'
            }
          }
        }
      },
      description: 'Theme colors'
    },
    typography: {
      type: 'object',
      description: 'Typography settings'
    },
    spacing: {
      type: 'object',
      description: 'Spacing settings'
    },
    isBuiltIn: {
      type: 'boolean',
      description: 'Whether this is a built-in theme'
    }
  }
};

/**
 * Schema for UI theme customization context.
 */
const uiThemeCustomizationSchema = {
  ...baseUIContextSchema,
  required: [...baseUIContextSchema.required, 'baseThemeId', 'customizations'],
  properties: {
    ...baseUIContextSchema.properties,
    baseThemeId: {
      type: 'string',
      description: 'Identifier for the base theme being customized'
    },
    customizations: {
      type: 'object',
      description: 'Theme customizations'
    },
    name: {
      type: 'string',
      description: 'Name of the customized theme'
    },
    author: {
      type: 'string',
      description: 'Author of the customization'
    },
    isShared: {
      type: 'boolean',
      description: 'Whether this customization is shared with other users'
    }
  }
};

/**
 * Validate context data against a schema.
 * @param {Object} data Context data to validate
 * @param {Object} schema Schema to validate against
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateContextSchema(data, schema) {
  // This is a simplified implementation
  // In a production environment, this would use a proper JSON Schema validator
  
  const result = {
    isValid: true,
    errors: []
  };
  
  // Check required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (data[requiredProp] === undefined) {
        result.isValid = false;
        result.errors.push(`Missing required property: ${requiredProp}`);
      }
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (data[propName] !== undefined) {
        // Check type
        if (propSchema.type) {
          const types = Array.isArray(propSchema.type) ? propSchema.type : [propSchema.type];
          
          let typeValid = false;
          for (const type of types) {
            if (type === 'string' && typeof data[propName] === 'string') {
              typeValid = true;
              break;
            } else if (type === 'number' && typeof data[propName] === 'number') {
              typeValid = true;
              break;
            } else if (type === 'boolean' && typeof data[propName] === 'boolean') {
              typeValid = true;
              break;
            } else if (type === 'object' && typeof data[propName] === 'object' && data[propName] !== null) {
              typeValid = true;
              break;
            } else if (type === 'array' && Array.isArray(data[propName])) {
              typeValid = true;
              break;
            } else if (type === 'null' && data[propName] === null) {
              typeValid = true;
              break;
            }
          }
          
          if (!typeValid) {
            result.isValid = false;
            result.errors.push(`Invalid type for property ${propName}: expected ${propSchema.type}, got ${typeof data[propName]}`);
          }
        }
        
        // Check enum
        if (propSchema.enum && !propSchema.enum.includes(data[propName])) {
          result.isValid = false;
          result.errors.push(`Invalid value for property ${propName}: expected one of [${propSchema.enum.join(', ')}], got ${data[propName]}`);
        }
        
        // Check minimum/maximum for numbers
        if (typeof data[propName] === 'number') {
          if (propSchema.minimum !== undefined && data[propName] < propSchema.minimum) {
            result.isValid = false;
            result.errors.push(`Invalid value for property ${propName}: minimum is ${propSchema.minimum}, got ${data[propName]}`);
          }
          
          if (propSchema.maximum !== undefined && data[propName] > propSchema.maximum) {
            result.isValid = false;
            result.errors.push(`Invalid value for property ${propName}: maximum is ${propSchema.maximum}, got ${data[propName]}`);
          }
        }
        
        // Recursively validate nested objects
        if (propSchema.type === 'object' && propSchema.properties && typeof data[propName] === 'object' && data[propName] !== null) {
          const nestedResult = validateContextSchema(data[propName], propSchema);
          
          if (!nestedResult.isValid) {
            result.isValid = false;
            for (const error of nestedResult.errors) {
              result.errors.push(`In property ${propName}: ${error}`);
            }
          }
        }
        
        // Validate array items
        if (propSchema.type === 'array' && propSchema.items && Array.isArray(data[propName])) {
          for (let i = 0; i < data[propName].length; i++) {
            const itemResult = validateContextSchema(data[propName][i], propSchema.items);
            
            if (!itemResult.isValid) {
              result.isValid = false;
              for (const error of itemResult.errors) {
                result.errors.push(`In property ${propName}[${i}]: ${error}`);
              }
            }
          }
        }
      }
    }
  }
  
  return result;
}

// Export schemas and validation function
module.exports = {
  // UI State schemas
  uiStateCurrentSchema,
  uiStateHistorySchema,
  
  // UI Interaction schemas
  uiInteractionEventSchema,
  uiInteractionPatternSchema,
  
  // UI Preference schemas
  uiPreferenceSettingSchema,
  uiPreferenceDefaultSchema,
  
  // UI Accessibility schemas
  uiAccessibilityRequirementSchema,
  uiAccessibilityAdaptationSchema,
  
  // UI Theme schemas
  uiThemeCurrentSchema,
  uiThemeCustomizationSchema,
  
  // Validation function
  validateContextSchema
};
