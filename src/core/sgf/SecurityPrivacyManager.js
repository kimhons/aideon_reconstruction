/**
 * @fileoverview Security and privacy review utility for the HTN Planner.
 * This module provides functionality for identifying and handling sensitive data
 * and enforcing security policies during HTN planning and execution.
 */

/**
 * Class for managing security and privacy concerns in the HTN Planner system.
 */
class SecurityPrivacyManager {
  /**
   * Creates a new SecurityPrivacyManager instance.
   * @param {Object} config - Configuration options.
   * @param {Array<Object>} config.sensitiveDataPatterns - Patterns for identifying sensitive data.
   * @param {Object} config.securityPolicies - Security policies to enforce.
   */
  constructor(config = {}) {
    // Patterns for identifying sensitive data
    this.sensitiveDataPatterns = config.sensitiveDataPatterns || [
      { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, redactionStrategy: 'partial' },
      { type: 'phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, redactionStrategy: 'partial' },
      { type: 'ssn', pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, redactionStrategy: 'full' },
      { type: 'credit_card', pattern: /\b(?:\d{4}[-]?){3}\d{4}\b/, redactionStrategy: 'partial' },
      { type: 'api_key', pattern: /\b[A-Za-z0-9_-]{20,}\b/, redactionStrategy: 'full' },
      { type: 'password', pattern: /\bpassword\s*[=:]\s*['"]?[^'"]+['"]?/i, redactionStrategy: 'full' }
    ];
    
    // Security policies to enforce
    this.securityPolicies = config.securityPolicies || {
      // Default policies
      allowedFileOperations: {
        readPaths: ['${AIDEON_WORKSPACE}/**/*'],
        writePaths: ['${AIDEON_WORKSPACE}/**/*'],
        deletePaths: ['${AIDEON_WORKSPACE}/**/*'],
        excludedPaths: ['${SYSTEM_DIRECTORIES}/**/*', '${USER_HOME}/.ssh/**/*']
      },
      allowedNetworkOperations: {
        allowedDomains: ['*.example.com', 'api.openai.com', 'huggingface.co'],
        blockedDomains: ['*.malicious.com'],
        requireUserConfirmation: ['banking.example.com', 'payment.example.com']
      },
      dataHandling: {
        logSensitiveData: false,
        allowExternalSharing: false,
        requireEncryption: true
      }
    };
    
    // Initialize sensitive data registry
    this.sensitiveDataRegistry = new Map();
  }

  /**
   * Scans data for sensitive information.
   * @param {Object|string} data - The data to scan.
   * @param {string} context - Context of the data (e.g., 'action_params', 'state', 'log').
   * @returns {Array<Object>} - Array of detected sensitive data items.
   */
  scanForSensitiveData(data, context) {
    const sensitiveItems = [];
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Scan for each sensitive data pattern
    for (const pattern of this.sensitiveDataPatterns) {
      const matches = stringData.match(pattern.pattern);
      
      if (matches) {
        for (const match of matches) {
          sensitiveItems.push({
            type: pattern.type,
            value: match,
            context,
            redactionStrategy: pattern.redactionStrategy,
            timestamp: new Date().toISOString()
          });
          
          // Register the sensitive data
          this.registerSensitiveData(match, pattern.type, context);
        }
      }
    }
    
    return sensitiveItems;
  }

  /**
   * Registers sensitive data for tracking.
   * @param {string} value - The sensitive data value.
   * @param {string} type - The type of sensitive data.
   * @param {string} context - Context where the data was found.
   * @private
   */
  registerSensitiveData(value, type, context) {
    const hash = this.hashValue(value);
    
    this.sensitiveDataRegistry.set(hash, {
      type,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      contexts: [context]
    });
  }

  /**
   * Hashes a value for secure storage.
   * @param {string} value - The value to hash.
   * @returns {string} - The hashed value.
   * @private
   */
  hashValue(value) {
    // In a real implementation, this would use a secure hashing algorithm
    // For now, we'll use a simple hash function
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Redacts sensitive data from a string or object.
   * @param {Object|string} data - The data to redact.
   * @param {string} context - Context of the data.
   * @returns {Object|string} - The redacted data.
   */
  redactSensitiveData(data, context) {
    const sensitiveItems = this.scanForSensitiveData(data, context);
    
    if (sensitiveItems.length === 0) {
      return data;
    }
    
    let redactedData = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Redact each sensitive item
    for (const item of sensitiveItems) {
      const redactedValue = this.getRedactedValue(item.value, item.type, item.redactionStrategy);
      redactedData = redactedData.replace(new RegExp(this.escapeRegExp(item.value), 'g'), redactedValue);
    }
    
    return typeof data === 'string' ? redactedData : JSON.parse(redactedData);
  }

  /**
   * Escapes special characters in a string for use in a regular expression.
   * @param {string} string - The string to escape.
   * @returns {string} - The escaped string.
   * @private
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Gets a redacted version of a value based on its type and redaction strategy.
   * @param {string} value - The value to redact.
   * @param {string} type - The type of sensitive data.
   * @param {string} strategy - The redaction strategy ('full', 'partial').
   * @returns {string} - The redacted value.
   * @private
   */
  getRedactedValue(value, type, strategy) {
    if (strategy === 'full') {
      return '[REDACTED]';
    }
    
    // Partial redaction based on type
    switch (type) {
      case 'email':
        // Redact everything before the @ symbol except the first character
        const atIndex = value.indexOf('@');
        if (atIndex > 1) {
          return value.charAt(0) + '***' + value.substring(atIndex);
        }
        break;
      
      case 'phone':
        // Redact middle digits
        return value.replace(/^(\d{3}[-.]?)(\d{3})([-.]?\d{4})$/, '$1***$3');
      
      case 'credit_card':
        // Keep only the last 4 digits
        return value.replace(/^(?:\d{4}[-]?){3}(\d{4})$/, '****-****-****-$1');
      
      default:
        // Default to redacting the middle 70% of the value
        const length = value.length;
        const visibleChars = Math.max(2, Math.floor(length * 0.3));
        const prefixLength = Math.ceil(visibleChars / 2);
        const suffixLength = Math.floor(visibleChars / 2);
        
        return value.substring(0, prefixLength) + 
               '*'.repeat(length - prefixLength - suffixLength) + 
               value.substring(length - suffixLength);
    }
    
    // Fallback to full redaction
    return '[REDACTED]';
  }

  /**
   * Checks if an action complies with security policies.
   * @param {Object} action - The action to check.
   * @returns {Object} - Result of the check { compliant: boolean, violations: Array, recommendations: Array }.
   */
  checkActionCompliance(action) {
    const result = {
      compliant: true,
      violations: [],
      recommendations: []
    };
    
    // Check for sensitive data in action parameters
    const sensitiveItems = this.scanForSensitiveData(action.params, 'action_params');
    
    if (sensitiveItems.length > 0) {
      result.recommendations.push({
        type: 'sensitive_data_detected',
        message: `Action contains ${sensitiveItems.length} sensitive data items`,
        items: sensitiveItems.map(item => ({ type: item.type, redactionStrategy: item.redactionStrategy }))
      });
      
      // If data handling policy doesn't allow sensitive data, mark as non-compliant
      if (this.securityPolicies.dataHandling.logSensitiveData === false) {
        result.compliant = false;
        result.violations.push({
          type: 'sensitive_data_policy_violation',
          message: 'Action contains sensitive data but policy prohibits logging sensitive data'
        });
      }
    }
    
    // Check file operation compliance
    if (['read_file', 'write_file', 'delete_file', 'copy_file', 'move_file'].includes(action.type)) {
      const filePath = action.params.path || action.params.source || action.params.destination || '';
      
      // Check against allowed paths
      let allowed = false;
      let excluded = false;
      
      // Check if path is in excluded paths
      for (const excludedPath of this.securityPolicies.allowedFileOperations.excludedPaths) {
        if (this.pathMatchesPattern(filePath, excludedPath)) {
          excluded = true;
          break;
        }
      }
      
      if (excluded) {
        result.compliant = false;
        result.violations.push({
          type: 'file_operation_policy_violation',
          message: `File operation on excluded path: ${filePath}`
        });
      } else {
        // Check if path is in allowed paths
        const allowedPathsKey = action.type === 'read_file' ? 'readPaths' : 
                               action.type === 'write_file' ? 'writePaths' : 'deletePaths';
        
        for (const allowedPath of this.securityPolicies.allowedFileOperations[allowedPathsKey]) {
          if (this.pathMatchesPattern(filePath, allowedPath)) {
            allowed = true;
            break;
          }
        }
        
        if (!allowed) {
          result.compliant = false;
          result.violations.push({
            type: 'file_operation_policy_violation',
            message: `File operation not allowed on path: ${filePath}`
          });
        }
      }
    }
    
    // Check network operation compliance
    if (['http_request', 'fetch_url', 'download_file'].includes(action.type)) {
      const url = action.params.url || '';
      const domain = this.extractDomain(url);
      
      // Check if domain is blocked
      for (const blockedDomain of this.securityPolicies.allowedNetworkOperations.blockedDomains) {
        if (this.domainMatchesPattern(domain, blockedDomain)) {
          result.compliant = false;
          result.violations.push({
            type: 'network_operation_policy_violation',
            message: `Network operation to blocked domain: ${domain}`
          });
          break;
        }
      }
      
      // Check if domain requires user confirmation
      for (const confirmationDomain of this.securityPolicies.allowedNetworkOperations.requireUserConfirmation) {
        if (this.domainMatchesPattern(domain, confirmationDomain)) {
          result.recommendations.push({
            type: 'user_confirmation_required',
            message: `Network operation to domain requiring user confirmation: ${domain}`
          });
          break;
        }
      }
      
      // Check if domain is allowed
      let allowed = false;
      for (const allowedDomain of this.securityPolicies.allowedNetworkOperations.allowedDomains) {
        if (this.domainMatchesPattern(domain, allowedDomain)) {
          allowed = true;
          break;
        }
      }
      
      if (!allowed) {
        result.compliant = false;
        result.violations.push({
          type: 'network_operation_policy_violation',
          message: `Network operation to non-allowed domain: ${domain}`
        });
      }
    }
    
    return result;
  }

  /**
   * Checks if a path matches a pattern.
   * @param {string} path - The path to check.
   * @param {string} pattern - The pattern to match against.
   * @returns {boolean} - Whether the path matches the pattern.
   * @private
   */
  pathMatchesPattern(path, pattern) {
    // Replace variables in pattern
    const expandedPattern = pattern
      .replace('${AIDEON_WORKSPACE}', '/path/to/aideon/workspace')
      .replace('${SYSTEM_DIRECTORIES}', '/path/to/system')
      .replace('${USER_HOME}', '/home/user');
    
    // Convert glob pattern to regex
    const regexPattern = expandedPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Extracts the domain from a URL.
   * @param {string} url - The URL to extract the domain from.
   * @returns {string} - The extracted domain.
   * @private
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url;
    }
  }

  /**
   * Checks if a domain matches a pattern.
   * @param {string} domain - The domain to check.
   * @param {string} pattern - The pattern to match against.
   * @returns {boolean} - Whether the domain matches the pattern.
   * @private
   */
  domainMatchesPattern(domain, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^.]*');
    
    return new RegExp(`^${regexPattern}$`).test(domain);
  }

  /**
   * Generates a security report for the HTN Planner system.
   * @returns {Object} - The security report.
   */
  generateSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      sensitiveDataStats: {
        totalItems: this.sensitiveDataRegistry.size,
        byType: Array.from(this.sensitiveDataRegistry.values()).reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {})
      },
      securityPolicies: this.securityPolicies,
      recommendations: [
        // Example recommendations
        {
          type: 'policy_update',
          message: 'Consider updating network security policies to restrict access to specific API endpoints'
        },
        {
          type: 'encryption',
          message: 'Ensure all sensitive data is encrypted at rest and in transit'
        }
      ]
    };
  }
}

module.exports = SecurityPrivacyManager;
