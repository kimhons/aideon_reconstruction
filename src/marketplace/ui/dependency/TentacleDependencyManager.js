/**
 * @fileoverview Tentacle Dependency Management System for the Aideon Tentacle Marketplace
 * This component manages dependencies between tentacles, ensuring users understand
 * compatibility requirements and relationships between different tentacles.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies with support for dependency injection in tests
var Logger;
var EventEmitter;

// Use try-catch to support both direct imports and mocked imports
try {
  var LoggerModule = require('../../../../core/logging/Logger');
  var EventEmitterModule = require('../../../../core/events/EventEmitter');
  
  Logger = LoggerModule.Logger;
  EventEmitter = EventEmitterModule.EventEmitter;
} catch (error) {
  // In test environment, these will be mocked
  Logger = require('../../../../test/mocks/Logger').Logger;
  EventEmitter = require('../../../../test/mocks/EventEmitter').EventEmitter;
}

/**
 * TentacleDependencyManager class - Manages dependencies between tentacles
 */
function TentacleDependencyManager(options) {
  options = options || {};
  
  this.options = options;
  this.container = options.container;
  this.marketplaceCore = options.marketplaceCore;
  this.config = options.config || {};
  this.logger = new Logger("TentacleDependencyManager");
  this.events = new EventEmitter();
  
  // Default configuration
  this.config.autoInstallDependencies = this.config.autoInstallDependencies === true;
  this.config.showDependencyWarnings = this.config.showDependencyWarnings !== false;
  this.config.enableVersionConstraints = this.config.enableVersionConstraints !== false;
  this.config.checkForConflicts = this.config.checkForConflicts !== false;
  this.config.maxDependencyDepth = this.config.maxDependencyDepth || 5;
  
  this.state = {
    dependencies: {},
    reverseDependencies: {},
    installedTentacles: {},
    selectedTentacle: null,
    dependencyGraph: null,
    conflicts: {},
    isLoading: false,
    error: null
  };
  
  this.initialized = false;
  
  // For testing environments, accept a mock container
  if (process.env.NODE_ENV === 'test' && !this.container) {
    this.container = {
      appendChild: function() {},
      querySelector: function() { return {}; },
      querySelectorAll: function() { return []; },
      addEventListener: function() {},
      removeEventListener: function() {},
      classList: {
        add: function() {},
        remove: function() {},
        toggle: function() {}
      }
    };
  }
  
  this.logger.info("TentacleDependencyManager instance created");
}

/**
 * Initialize the TentacleDependencyManager
 * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
 */
TentacleDependencyManager.prototype.initialize = function() {
  var self = this;
  
  if (this.initialized) {
    this.logger.warn("TentacleDependencyManager already initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Initializing TentacleDependencyManager");
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate dependencies
      if (!self.container && process.env.NODE_ENV !== 'test') {
        throw new Error("Container element is required");
      }
      
      if (!self.marketplaceCore) {
        throw new Error("MarketplaceCore reference is required");
      }
      
      // Initialize marketplace core if not already initialized
      var initPromise = Promise.resolve();
      if (!self.marketplaceCore.initialized) {
        initPromise = self.marketplaceCore.initialize();
      }
      
      initPromise
        .then(function() {
          // Set up event listeners
          self._setupEventListeners();
          
          // Set up UI layout
          if (process.env.NODE_ENV !== 'test') {
            self._setupUILayout();
          }
          
          // Load installed tentacles
          return self.loadInstalledTentacles();
        })
        .then(function() {
          self.initialized = true;
          self.logger.info("TentacleDependencyManager initialized successfully");
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to initialize TentacleDependencyManager", error);
          self.state.error = error.message;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to initialize TentacleDependencyManager", error);
      self.state.error = error.message;
      reject(error);
    }
  });
};

/**
 * Load installed tentacles
 * @returns {Promise<Object>} - Promise resolving to installed tentacles
 */
TentacleDependencyManager.prototype.loadInstalledTentacles = function() {
  var self = this;
  
  this.logger.info("Loading installed tentacles");
  this.state.isLoading = true;
  
  return new Promise(function(resolve, reject) {
    try {
      // Get installed tentacles from marketplace core
      self.marketplaceCore.getInstalledTentacles()
        .then(function(tentacles) {
          // Update state
          self.state.installedTentacles = {};
          
          for (var i = 0; i < tentacles.length; i++) {
            var tentacle = tentacles[i];
            self.state.installedTentacles[tentacle.id] = tentacle;
          }
          
          self.state.isLoading = false;
          
          // Emit installed tentacles loaded event
          self.events.emit('installed-tentacles:loaded', {
            tentacles: tentacles
          });
          
          self.logger.info("Loaded " + tentacles.length + " installed tentacles");
          resolve(self.state.installedTentacles);
        })
        .catch(function(error) {
          self.logger.error("Failed to load installed tentacles", error);
          self.state.error = error.message;
          self.state.isLoading = false;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to load installed tentacles", error);
      self.state.error = error.message;
      self.state.isLoading = false;
      reject(error);
    }
  });
};

/**
 * Load dependencies for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} options - Options
 * @param {boolean} options.includeTransitive - Whether to include transitive dependencies
 * @param {number} options.maxDepth - Maximum depth for transitive dependencies
 * @returns {Promise<Object>} - Promise resolving to dependencies
 */
TentacleDependencyManager.prototype.loadDependencies = function(tentacleId, options) {
  var self = this;
  options = options || {};
  
  this.logger.info("Loading dependencies for tentacle: " + tentacleId);
  this.state.isLoading = true;
  
  // Set default options
  options.includeTransitive = options.includeTransitive !== false;
  options.maxDepth = options.maxDepth || this.config.maxDependencyDepth;
  
  return new Promise(function(resolve, reject) {
    try {
      // Get dependencies from marketplace core
      self.marketplaceCore.getTentacleDependencies(tentacleId, options)
        .then(function(dependencies) {
          // Update state
          self.state.dependencies[tentacleId] = dependencies;
          self.state.isLoading = false;
          
          // Build dependency graph if transitive dependencies are included
          if (options.includeTransitive) {
            self._buildDependencyGraph(tentacleId, dependencies);
          }
          
          // Check for conflicts
          if (self.config.checkForConflicts) {
            self._checkForConflicts(tentacleId, dependencies);
          }
          
          // Emit dependencies loaded event
          self.events.emit('dependencies:loaded', {
            tentacleId: tentacleId,
            dependencies: dependencies,
            graph: self.state.dependencyGraph,
            conflicts: self.state.conflicts[tentacleId] || []
          });
          
          // Render dependencies if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._renderDependencies(tentacleId, dependencies);
          }
          
          self.logger.info("Loaded dependencies for tentacle " + tentacleId);
          resolve(dependencies);
        })
        .catch(function(error) {
          self.logger.error("Failed to load dependencies for tentacle " + tentacleId, error);
          self.state.error = error.message;
          self.state.isLoading = false;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to load dependencies for tentacle " + tentacleId, error);
      self.state.error = error.message;
      self.state.isLoading = false;
      reject(error);
    }
  });
};

/**
 * Load reverse dependencies for a tentacle (tentacles that depend on this one)
 * @param {string} tentacleId - Tentacle ID
 * @returns {Promise<Object>} - Promise resolving to reverse dependencies
 */
TentacleDependencyManager.prototype.loadReverseDependencies = function(tentacleId) {
  var self = this;
  
  this.logger.info("Loading reverse dependencies for tentacle: " + tentacleId);
  this.state.isLoading = true;
  
  return new Promise(function(resolve, reject) {
    try {
      // Get reverse dependencies from marketplace core
      self.marketplaceCore.getTentacleReverseDependencies(tentacleId)
        .then(function(reverseDependencies) {
          // Update state
          self.state.reverseDependencies[tentacleId] = reverseDependencies;
          self.state.isLoading = false;
          
          // Emit reverse dependencies loaded event
          self.events.emit('reverse-dependencies:loaded', {
            tentacleId: tentacleId,
            reverseDependencies: reverseDependencies
          });
          
          // Render reverse dependencies if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._renderReverseDependencies(tentacleId, reverseDependencies);
          }
          
          self.logger.info("Loaded reverse dependencies for tentacle " + tentacleId);
          resolve(reverseDependencies);
        })
        .catch(function(error) {
          self.logger.error("Failed to load reverse dependencies for tentacle " + tentacleId, error);
          self.state.error = error.message;
          self.state.isLoading = false;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to load reverse dependencies for tentacle " + tentacleId, error);
      self.state.error = error.message;
      self.state.isLoading = false;
      reject(error);
    }
  });
};

/**
 * Check if a tentacle's dependencies are satisfied
 * @param {string} tentacleId - Tentacle ID
 * @returns {Promise<Object>} - Promise resolving to dependency status
 */
TentacleDependencyManager.prototype.checkDependenciesSatisfied = function(tentacleId) {
  var self = this;
  
  this.logger.info("Checking if dependencies are satisfied for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Load dependencies if not already loaded
      var dependenciesPromise = self.state.dependencies[tentacleId] 
        ? Promise.resolve(self.state.dependencies[tentacleId])
        : self.loadDependencies(tentacleId);
      
      dependenciesPromise
        .then(function(dependencies) {
          // Check if dependencies are satisfied
          var missingDependencies = [];
          var versionMismatches = [];
          
          for (var i = 0; i < dependencies.direct.length; i++) {
            var dependency = dependencies.direct[i];
            var installed = self.state.installedTentacles[dependency.id];
            
            if (!installed) {
              missingDependencies.push(dependency);
            } else if (self.config.enableVersionConstraints && dependency.versionConstraint) {
              // Check version constraint
              if (!self._satisfiesVersionConstraint(installed.version, dependency.versionConstraint)) {
                versionMismatches.push({
                  dependency: dependency,
                  installed: installed
                });
              }
            }
          }
          
          var result = {
            satisfied: missingDependencies.length === 0 && versionMismatches.length === 0,
            missingDependencies: missingDependencies,
            versionMismatches: versionMismatches
          };
          
          // Emit dependencies checked event
          self.events.emit('dependencies:checked', {
            tentacleId: tentacleId,
            result: result
          });
          
          self.logger.info("Dependencies checked for tentacle " + tentacleId + ": " + (result.satisfied ? "satisfied" : "not satisfied"));
          resolve(result);
        })
        .catch(function(error) {
          self.logger.error("Failed to check dependencies for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to check dependencies for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Install missing dependencies for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @returns {Promise<Object>} - Promise resolving to installation result
 */
TentacleDependencyManager.prototype.installMissingDependencies = function(tentacleId) {
  var self = this;
  
  this.logger.info("Installing missing dependencies for tentacle: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Check dependencies first
      self.checkDependenciesSatisfied(tentacleId)
        .then(function(status) {
          if (status.satisfied) {
            // No missing dependencies
            self.logger.info("No missing dependencies to install for tentacle " + tentacleId);
            return Promise.resolve({
              success: true,
              installed: [],
              failed: []
            });
          }
          
          // Install missing dependencies
          var installPromises = [];
          
          for (var i = 0; i < status.missingDependencies.length; i++) {
            var dependency = status.missingDependencies[i];
            installPromises.push(self._installDependency(dependency));
          }
          
          return Promise.all(installPromises)
            .then(function(results) {
              // Process results
              var installed = [];
              var failed = [];
              
              for (var j = 0; j < results.length; j++) {
                var result = results[j];
                if (result.success) {
                  installed.push(result.dependency);
                } else {
                  failed.push({
                    dependency: result.dependency,
                    error: result.error
                  });
                }
              }
              
              return {
                success: failed.length === 0,
                installed: installed,
                failed: failed
              };
            });
        })
        .then(function(result) {
          // Reload installed tentacles
          return self.loadInstalledTentacles()
            .then(function() {
              return result;
            });
        })
        .then(function(result) {
          // Emit dependencies installed event
          self.events.emit('dependencies:installed', {
            tentacleId: tentacleId,
            result: result
          });
          
          self.logger.info("Dependencies installation completed for tentacle " + tentacleId + ": " + 
                          result.installed.length + " installed, " + result.failed.length + " failed");
          resolve(result);
        })
        .catch(function(error) {
          self.logger.error("Failed to install dependencies for tentacle " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to install dependencies for tentacle " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Get dependency graph for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @returns {Object} - Dependency graph
 */
TentacleDependencyManager.prototype.getDependencyGraph = function(tentacleId) {
  if (!this.state.dependencyGraph || this.state.dependencyGraph.rootId !== tentacleId) {
    // Load dependencies if not already loaded
    if (!this.state.dependencies[tentacleId]) {
      this.logger.warn("Dependencies not loaded for tentacle " + tentacleId);
      return null;
    }
    
    // Build dependency graph
    this._buildDependencyGraph(tentacleId, this.state.dependencies[tentacleId]);
  }
  
  return this.state.dependencyGraph;
};

/**
 * Get conflicts for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @returns {Array} - Conflicts
 */
TentacleDependencyManager.prototype.getConflicts = function(tentacleId) {
  return this.state.conflicts[tentacleId] || [];
};

/**
 * Check if a tentacle can be safely uninstalled
 * @param {string} tentacleId - Tentacle ID
 * @returns {Promise<Object>} - Promise resolving to uninstall status
 */
TentacleDependencyManager.prototype.checkCanUninstall = function(tentacleId) {
  var self = this;
  
  this.logger.info("Checking if tentacle can be safely uninstalled: " + tentacleId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Load reverse dependencies if not already loaded
      var reverseDependenciesPromise = self.state.reverseDependencies[tentacleId] 
        ? Promise.resolve(self.state.reverseDependencies[tentacleId])
        : self.loadReverseDependencies(tentacleId);
      
      reverseDependenciesPromise
        .then(function(reverseDependencies) {
          var result = {
            canUninstall: reverseDependencies.length === 0,
            dependentTentacles: reverseDependencies
          };
          
          // Emit can uninstall checked event
          self.events.emit('can-uninstall:checked', {
            tentacleId: tentacleId,
            result: result
          });
          
          self.logger.info("Uninstall check for tentacle " + tentacleId + ": " + 
                          (result.canUninstall ? "can uninstall" : "cannot uninstall, has " + reverseDependencies.length + " dependent tentacles"));
          resolve(result);
        })
        .catch(function(error) {
          self.logger.error("Failed to check if tentacle can be uninstalled " + tentacleId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to check if tentacle can be uninstalled " + tentacleId, error);
      reject(error);
    }
  });
};

/**
 * Set up event listeners
 * @private
 */
TentacleDependencyManager.prototype._setupEventListeners = function() {
  var self = this;
  
  this.logger.info("Setting up event listeners");
  
  // Listen for marketplace core events
  if (this.marketplaceCore && this.marketplaceCore.events) {
    this.marketplaceCore.events.on("tentacle:selected", function(event) {
      self._handleTentacleSelected(event);
    });
    
    this.marketplaceCore.events.on("tentacle:installed", function(event) {
      self._handleTentacleInstalled(event);
    });
    
    this.marketplaceCore.events.on("tentacle:uninstalled", function(event) {
      self._handleTentacleUninstalled(event);
    });
    
    this.marketplaceCore.events.on("tentacle:updated", function(event) {
      self._handleTentacleUpdated(event);
    });
  }
  
  // Set up UI event listeners if container is available
  if (this.container && process.env.NODE_ENV !== 'test') {
    // Install dependencies button
    var installButton = this.container.querySelector('.dependency-install-button');
    if (installButton) {
      installButton.addEventListener('click', function(event) {
        self._handleInstallButtonClick(event);
      });
    }
    
    // View graph button
    var viewGraphButton = this.container.querySelector('.dependency-view-graph-button');
    if (viewGraphButton) {
      viewGraphButton.addEventListener('click', function(event) {
        self._handleViewGraphButtonClick(event);
      });
    }
  }
  
  this.logger.info("Event listeners set up");
};

/**
 * Set up UI layout
 * @private
 */
TentacleDependencyManager.prototype._setupUILayout = function() {
  var self = this;
  
  this.logger.info("Setting up UI layout");
  
  // Create dependency manager container
  var dependencyContainer = document.createElement('div');
  dependencyContainer.className = 'dependency-manager-container';
  
  // Create dependency header
  var dependencyHeader = document.createElement('div');
  dependencyHeader.className = 'dependency-header';
  
  // Create dependency title
  var dependencyTitle = document.createElement('h3');
  dependencyTitle.className = 'dependency-title';
  dependencyTitle.textContent = 'Dependencies';
  
  // Create dependency actions
  var dependencyActions = document.createElement('div');
  dependencyActions.className = 'dependency-actions';
  
  // Create install button
  var installButton = document.createElement('button');
  installButton.className = 'dependency-install-button';
  installButton.textContent = 'Install Missing Dependencies';
  installButton.disabled = true;
  
  // Create view graph button
  var viewGraphButton = document.createElement('button');
  viewGraphButton.className = 'dependency-view-graph-button';
  viewGraphButton.textContent = 'View Dependency Graph';
  viewGraphButton.disabled = true;
  
  // Add buttons to actions
  dependencyActions.appendChild(installButton);
  dependencyActions.appendChild(viewGraphButton);
  
  // Add title and actions to header
  dependencyHeader.appendChild(dependencyTitle);
  dependencyHeader.appendChild(dependencyActions);
  
  // Create dependency content
  var dependencyContent = document.createElement('div');
  dependencyContent.className = 'dependency-content';
  
  // Create dependencies section
  var dependenciesSection = document.createElement('div');
  dependenciesSection.className = 'dependencies-section';
  
  var dependenciesTitle = document.createElement('h4');
  dependenciesTitle.className = 'section-title';
  dependenciesTitle.textContent = 'Required Dependencies';
  
  var dependenciesList = document.createElement('div');
  dependenciesList.className = 'dependencies-list';
  
  dependenciesSection.appendChild(dependenciesTitle);
  dependenciesSection.appendChild(dependenciesList);
  
  // Create reverse dependencies section
  var reverseDependenciesSection = document.createElement('div');
  reverseDependenciesSection.className = 'reverse-dependencies-section';
  
  var reverseDependenciesTitle = document.createElement('h4');
  reverseDependenciesTitle.className = 'section-title';
  reverseDependenciesTitle.textContent = 'Used By';
  
  var reverseDependenciesList = document.createElement('div');
  reverseDependenciesList.className = 'reverse-dependencies-list';
  
  reverseDependenciesSection.appendChild(reverseDependenciesTitle);
  reverseDependenciesSection.appendChild(reverseDependenciesList);
  
  // Create conflicts section
  var conflictsSection = document.createElement('div');
  conflictsSection.className = 'conflicts-section';
  
  var conflictsTitle = document.createElement('h4');
  conflictsTitle.className = 'section-title';
  conflictsTitle.textContent = 'Conflicts';
  
  var conflictsList = document.createElement('div');
  conflictsList.className = 'conflicts-list';
  
  conflictsSection.appendChild(conflictsTitle);
  conflictsSection.appendChild(conflictsList);
  
  // Add sections to content
  dependencyContent.appendChild(dependenciesSection);
  dependencyContent.appendChild(reverseDependenciesSection);
  dependencyContent.appendChild(conflictsSection);
  
  // Add header and content to container
  dependencyContainer.appendChild(dependencyHeader);
  dependencyContainer.appendChild(dependencyContent);
  
  // Add container to main container
  this.container.appendChild(dependencyContainer);
  
  this.logger.info("UI layout set up");
};

/**
 * Render dependencies for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} dependencies - Dependencies
 * @private
 */
TentacleDependencyManager.prototype._renderDependencies = function(tentacleId, dependencies) {
  var self = this;
  
  this.logger.info("Rendering dependencies for tentacle: " + tentacleId);
  
  var dependenciesList = this.container.querySelector('.dependencies-list');
  
  if (!dependenciesList) {
    this.logger.error("Dependencies list container not found");
    return;
  }
  
  // Clear existing content
  dependenciesList.innerHTML = '';
  
  // Get direct dependencies
  var directDependencies = dependencies.direct || [];
  
  if (directDependencies.length === 0) {
    // Create empty state
    var emptyState = document.createElement('div');
    emptyState.className = 'dependency-empty-state';
    
    var emptyStateMessage = document.createElement('p');
    emptyStateMessage.textContent = 'No dependencies required.';
    
    emptyState.appendChild(emptyStateMessage);
    dependenciesList.appendChild(emptyState);
    
    this.logger.info("No dependencies to render for tentacle " + tentacleId);
    return;
  }
  
  // Create dependency items
  for (var i = 0; i < directDependencies.length; i++) {
    var dependency = directDependencies[i];
    
    // Create dependency item
    var dependencyItem = document.createElement('div');
    dependencyItem.className = 'dependency-item';
    dependencyItem.dataset.dependencyId = dependency.id;
    
    // Check if dependency is installed
    var isInstalled = !!this.state.installedTentacles[dependency.id];
    var hasVersionMismatch = false;
    
    if (isInstalled && this.config.enableVersionConstraints && dependency.versionConstraint) {
      var installed = this.state.installedTentacles[dependency.id];
      hasVersionMismatch = !this._satisfiesVersionConstraint(installed.version, dependency.versionConstraint);
    }
    
    if (isInstalled && !hasVersionMismatch) {
      dependencyItem.classList.add('installed');
    } else if (hasVersionMismatch) {
      dependencyItem.classList.add('version-mismatch');
    } else {
      dependencyItem.classList.add('not-installed');
    }
    
    // Create dependency icon
    var dependencyIcon = document.createElement('div');
    dependencyIcon.className = 'dependency-icon';
    
    var iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    
    if (isInstalled && !hasVersionMismatch) {
      iconSpan.textContent = '✓';
    } else if (hasVersionMismatch) {
      iconSpan.textContent = '⚠';
    } else {
      iconSpan.textContent = '✗';
    }
    
    dependencyIcon.appendChild(iconSpan);
    
    // Create dependency info
    var dependencyInfo = document.createElement('div');
    dependencyInfo.className = 'dependency-info';
    
    var dependencyName = document.createElement('div');
    dependencyName.className = 'dependency-name';
    dependencyName.textContent = dependency.name;
    
    var dependencyVersion = document.createElement('div');
    dependencyVersion.className = 'dependency-version';
    
    if (dependency.versionConstraint) {
      dependencyVersion.textContent = 'Required: ' + dependency.versionConstraint;
      
      if (isInstalled) {
        var installed = this.state.installedTentacles[dependency.id];
        dependencyVersion.textContent += ' (Installed: ' + installed.version + ')';
      }
    } else {
      dependencyVersion.textContent = 'Any version';
    }
    
    var dependencyDescription = document.createElement('div');
    dependencyDescription.className = 'dependency-description';
    dependencyDescription.textContent = dependency.description || '';
    
    dependencyInfo.appendChild(dependencyName);
    dependencyInfo.appendChild(dependencyVersion);
    dependencyInfo.appendChild(dependencyDescription);
    
    // Create dependency actions
    var dependencyActions = document.createElement('div');
    dependencyActions.className = 'dependency-item-actions';
    
    if (!isInstalled) {
      var installButton = document.createElement('button');
      installButton.className = 'dependency-item-install-button';
      installButton.dataset.dependencyId = dependency.id;
      installButton.textContent = 'Install';
      
      installButton.addEventListener('click', function(event) {
        var dependencyId = this.dataset.dependencyId;
        self._handleDependencyInstallButtonClick(dependencyId);
      });
      
      dependencyActions.appendChild(installButton);
    } else if (hasVersionMismatch) {
      var updateButton = document.createElement('button');
      updateButton.className = 'dependency-item-update-button';
      updateButton.dataset.dependencyId = dependency.id;
      updateButton.textContent = 'Update';
      
      updateButton.addEventListener('click', function(event) {
        var dependencyId = this.dataset.dependencyId;
        self._handleDependencyUpdateButtonClick(dependencyId);
      });
      
      dependencyActions.appendChild(updateButton);
    } else {
      var viewButton = document.createElement('button');
      viewButton.className = 'dependency-item-view-button';
      viewButton.dataset.dependencyId = dependency.id;
      viewButton.textContent = 'View';
      
      viewButton.addEventListener('click', function(event) {
        var dependencyId = this.dataset.dependencyId;
        self._handleDependencyViewButtonClick(dependencyId);
      });
      
      dependencyActions.appendChild(viewButton);
    }
    
    // Add elements to dependency item
    dependencyItem.appendChild(dependencyIcon);
    dependencyItem.appendChild(dependencyInfo);
    dependencyItem.appendChild(dependencyActions);
    
    // Add dependency item to list
    dependenciesList.appendChild(dependencyItem);
  }
  
  // Update install button state
  var installButton = this.container.querySelector('.dependency-install-button');
  if (installButton) {
    var hasMissingDependencies = dependenciesList.querySelectorAll('.dependency-item.not-installed').length > 0;
    var hasVersionMismatches = dependenciesList.querySelectorAll('.dependency-item.version-mismatch').length > 0;
    
    installButton.disabled = !hasMissingDependencies && !hasVersionMismatches;
  }
  
  // Update view graph button state
  var viewGraphButton = this.container.querySelector('.dependency-view-graph-button');
  if (viewGraphButton) {
    viewGraphButton.disabled = false;
  }
  
  this.logger.info("Dependencies rendered for tentacle " + tentacleId);
};

/**
 * Render reverse dependencies for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Array} reverseDependencies - Reverse dependencies
 * @private
 */
TentacleDependencyManager.prototype._renderReverseDependencies = function(tentacleId, reverseDependencies) {
  var self = this;
  
  this.logger.info("Rendering reverse dependencies for tentacle: " + tentacleId);
  
  var reverseDependenciesList = this.container.querySelector('.reverse-dependencies-list');
  
  if (!reverseDependenciesList) {
    this.logger.error("Reverse dependencies list container not found");
    return;
  }
  
  // Clear existing content
  reverseDependenciesList.innerHTML = '';
  
  if (reverseDependencies.length === 0) {
    // Create empty state
    var emptyState = document.createElement('div');
    emptyState.className = 'dependency-empty-state';
    
    var emptyStateMessage = document.createElement('p');
    emptyStateMessage.textContent = 'No tentacles depend on this one.';
    
    emptyState.appendChild(emptyStateMessage);
    reverseDependenciesList.appendChild(emptyState);
    
    this.logger.info("No reverse dependencies to render for tentacle " + tentacleId);
    return;
  }
  
  // Create reverse dependency items
  for (var i = 0; i < reverseDependencies.length; i++) {
    var reverseDependency = reverseDependencies[i];
    
    // Create reverse dependency item
    var reverseDependencyItem = document.createElement('div');
    reverseDependencyItem.className = 'dependency-item reverse-dependency-item';
    reverseDependencyItem.dataset.dependencyId = reverseDependency.id;
    
    // Check if reverse dependency is installed
    var isInstalled = !!this.state.installedTentacles[reverseDependency.id];
    
    if (isInstalled) {
      reverseDependencyItem.classList.add('installed');
    } else {
      reverseDependencyItem.classList.add('not-installed');
    }
    
    // Create reverse dependency icon
    var reverseDependencyIcon = document.createElement('div');
    reverseDependencyIcon.className = 'dependency-icon';
    
    var iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = isInstalled ? '✓' : '✗';
    
    reverseDependencyIcon.appendChild(iconSpan);
    
    // Create reverse dependency info
    var reverseDependencyInfo = document.createElement('div');
    reverseDependencyInfo.className = 'dependency-info';
    
    var reverseDependencyName = document.createElement('div');
    reverseDependencyName.className = 'dependency-name';
    reverseDependencyName.textContent = reverseDependency.name;
    
    var reverseDependencyVersion = document.createElement('div');
    reverseDependencyVersion.className = 'dependency-version';
    
    if (reverseDependency.versionConstraint) {
      reverseDependencyVersion.textContent = 'Requires: ' + reverseDependency.versionConstraint;
    } else {
      reverseDependencyVersion.textContent = 'Any version';
    }
    
    var reverseDependencyDescription = document.createElement('div');
    reverseDependencyDescription.className = 'dependency-description';
    reverseDependencyDescription.textContent = reverseDependency.description || '';
    
    reverseDependencyInfo.appendChild(reverseDependencyName);
    reverseDependencyInfo.appendChild(reverseDependencyVersion);
    reverseDependencyInfo.appendChild(reverseDependencyDescription);
    
    // Create reverse dependency actions
    var reverseDependencyActions = document.createElement('div');
    reverseDependencyActions.className = 'dependency-item-actions';
    
    var viewButton = document.createElement('button');
    viewButton.className = 'dependency-item-view-button';
    viewButton.dataset.dependencyId = reverseDependency.id;
    viewButton.textContent = 'View';
    
    viewButton.addEventListener('click', function(event) {
      var dependencyId = this.dataset.dependencyId;
      self._handleDependencyViewButtonClick(dependencyId);
    });
    
    reverseDependencyActions.appendChild(viewButton);
    
    // Add elements to reverse dependency item
    reverseDependencyItem.appendChild(reverseDependencyIcon);
    reverseDependencyItem.appendChild(reverseDependencyInfo);
    reverseDependencyItem.appendChild(reverseDependencyActions);
    
    // Add reverse dependency item to list
    reverseDependenciesList.appendChild(reverseDependencyItem);
  }
  
  this.logger.info("Reverse dependencies rendered for tentacle " + tentacleId);
};

/**
 * Render conflicts for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Array} conflicts - Conflicts
 * @private
 */
TentacleDependencyManager.prototype._renderConflicts = function(tentacleId, conflicts) {
  var self = this;
  
  this.logger.info("Rendering conflicts for tentacle: " + tentacleId);
  
  var conflictsList = this.container.querySelector('.conflicts-list');
  
  if (!conflictsList) {
    this.logger.error("Conflicts list container not found");
    return;
  }
  
  // Clear existing content
  conflictsList.innerHTML = '';
  
  if (conflicts.length === 0) {
    // Create empty state
    var emptyState = document.createElement('div');
    emptyState.className = 'dependency-empty-state';
    
    var emptyStateMessage = document.createElement('p');
    emptyStateMessage.textContent = 'No conflicts detected.';
    
    emptyState.appendChild(emptyStateMessage);
    conflictsList.appendChild(emptyState);
    
    this.logger.info("No conflicts to render for tentacle " + tentacleId);
    return;
  }
  
  // Create conflict items
  for (var i = 0; i < conflicts.length; i++) {
    var conflict = conflicts[i];
    
    // Create conflict item
    var conflictItem = document.createElement('div');
    conflictItem.className = 'conflict-item';
    
    // Create conflict icon
    var conflictIcon = document.createElement('div');
    conflictIcon.className = 'conflict-icon';
    
    var iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = '⚠';
    
    conflictIcon.appendChild(iconSpan);
    
    // Create conflict info
    var conflictInfo = document.createElement('div');
    conflictInfo.className = 'conflict-info';
    
    var conflictTitle = document.createElement('div');
    conflictTitle.className = 'conflict-title';
    conflictTitle.textContent = conflict.title;
    
    var conflictDescription = document.createElement('div');
    conflictDescription.className = 'conflict-description';
    conflictDescription.textContent = conflict.description;
    
    conflictInfo.appendChild(conflictTitle);
    conflictInfo.appendChild(conflictDescription);
    
    // Create conflict actions
    var conflictActions = document.createElement('div');
    conflictActions.className = 'conflict-actions';
    
    if (conflict.resolvable) {
      var resolveButton = document.createElement('button');
      resolveButton.className = 'conflict-resolve-button';
      resolveButton.dataset.conflictId = conflict.id;
      resolveButton.textContent = 'Resolve';
      
      resolveButton.addEventListener('click', function(event) {
        var conflictId = this.dataset.conflictId;
        self._handleConflictResolveButtonClick(tentacleId, conflictId);
      });
      
      conflictActions.appendChild(resolveButton);
    }
    
    // Add elements to conflict item
    conflictItem.appendChild(conflictIcon);
    conflictItem.appendChild(conflictInfo);
    conflictItem.appendChild(conflictActions);
    
    // Add conflict item to list
    conflictsList.appendChild(conflictItem);
  }
  
  this.logger.info("Conflicts rendered for tentacle " + tentacleId);
};

/**
 * Build dependency graph for a tentacle
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} dependencies - Dependencies
 * @private
 */
TentacleDependencyManager.prototype._buildDependencyGraph = function(tentacleId, dependencies) {
  this.logger.info("Building dependency graph for tentacle: " + tentacleId);
  
  // Create graph
  var graph = {
    rootId: tentacleId,
    nodes: {},
    edges: []
  };
  
  // Add root node
  graph.nodes[tentacleId] = {
    id: tentacleId,
    name: this.state.installedTentacles[tentacleId] ? this.state.installedTentacles[tentacleId].name : tentacleId,
    level: 0,
    installed: !!this.state.installedTentacles[tentacleId]
  };
  
  // Process all dependencies
  var allDependencies = dependencies.all || {};
  
  for (var id in allDependencies) {
    if (allDependencies.hasOwnProperty(id)) {
      var dependency = allDependencies[id];
      
      // Add node if not already added
      if (!graph.nodes[id]) {
        graph.nodes[id] = {
          id: id,
          name: dependency.name,
          level: dependency.level,
          installed: !!this.state.installedTentacles[id]
        };
      }
      
      // Add edges
      if (dependency.dependsOn && dependency.dependsOn.length > 0) {
        for (var i = 0; i < dependency.dependsOn.length; i++) {
          var targetId = dependency.dependsOn[i];
          
          graph.edges.push({
            source: id,
            target: targetId,
            versionConstraint: dependency.versionConstraints ? dependency.versionConstraints[targetId] : null
          });
        }
      }
    }
  }
  
  // Update state
  this.state.dependencyGraph = graph;
  
  this.logger.info("Dependency graph built for tentacle " + tentacleId);
  return graph;
};

/**
 * Check for conflicts in dependencies
 * @param {string} tentacleId - Tentacle ID
 * @param {Object} dependencies - Dependencies
 * @private
 */
TentacleDependencyManager.prototype._checkForConflicts = function(tentacleId, dependencies) {
  this.logger.info("Checking for conflicts in dependencies for tentacle: " + tentacleId);
  
  var conflicts = [];
  
  // Check for version conflicts
  var allDependencies = dependencies.all || {};
  var versionConflicts = {};
  
  for (var id in allDependencies) {
    if (allDependencies.hasOwnProperty(id)) {
      var dependency = allDependencies[id];
      
      if (dependency.versionConflicts && dependency.versionConflicts.length > 0) {
        for (var i = 0; i < dependency.versionConflicts.length; i++) {
          var conflict = dependency.versionConflicts[i];
          
          var conflictKey = conflict.id1 + '-' + conflict.id2;
          if (!versionConflicts[conflictKey]) {
            versionConflicts[conflictKey] = true;
            
            conflicts.push({
              id: 'version-conflict-' + conflictKey,
              type: 'version-conflict',
              title: 'Version Conflict',
              description: 'Tentacle "' + conflict.name1 + '" requires version ' + conflict.version1 + 
                          ' of "' + conflict.targetName + '", but tentacle "' + conflict.name2 + 
                          '" requires version ' + conflict.version2 + '.',
              resolvable: true,
              data: conflict
            });
          }
        }
      }
    }
  }
  
  // Check for circular dependencies
  if (dependencies.circular && dependencies.circular.length > 0) {
    for (var j = 0; j < dependencies.circular.length; j++) {
      var circularPath = dependencies.circular[j];
      
      conflicts.push({
        id: 'circular-dependency-' + j,
        type: 'circular-dependency',
        title: 'Circular Dependency',
        description: 'Circular dependency detected: ' + circularPath.join(' → ') + '.',
        resolvable: false,
        data: {
          path: circularPath
        }
      });
    }
  }
  
  // Update state
  this.state.conflicts[tentacleId] = conflicts;
  
  // Render conflicts if container is available
  if (this.container && process.env.NODE_ENV !== 'test') {
    this._renderConflicts(tentacleId, conflicts);
  }
  
  this.logger.info("Found " + conflicts.length + " conflicts for tentacle " + tentacleId);
  return conflicts;
};

/**
 * Install a dependency
 * @param {Object} dependency - Dependency
 * @returns {Promise<Object>} - Promise resolving to installation result
 * @private
 */
TentacleDependencyManager.prototype._installDependency = function(dependency) {
  var self = this;
  
  this.logger.info("Installing dependency: " + dependency.id);
  
  return new Promise(function(resolve, reject) {
    try {
      // Install dependency using marketplace core
      self.marketplaceCore.installTentacle(dependency.id, {
        version: dependency.versionConstraint
      })
        .then(function(result) {
          self.logger.info("Dependency " + dependency.id + " installed successfully");
          resolve({
            success: true,
            dependency: dependency
          });
        })
        .catch(function(error) {
          self.logger.error("Failed to install dependency " + dependency.id, error);
          resolve({
            success: false,
            dependency: dependency,
            error: error.message
          });
        });
    } catch (error) {
      self.logger.error("Failed to install dependency " + dependency.id, error);
      resolve({
        success: false,
        dependency: dependency,
        error: error.message
      });
    }
  });
};

/**
 * Check if a version satisfies a version constraint
 * @param {string} version - Version
 * @param {string} constraint - Version constraint
 * @returns {boolean} - Whether the version satisfies the constraint
 * @private
 */
TentacleDependencyManager.prototype._satisfiesVersionConstraint = function(version, constraint) {
  this.logger.info("Checking if version " + version + " satisfies constraint " + constraint);
  
  // Parse version
  var parsedVersion = this._parseVersion(version);
  
  if (!parsedVersion) {
    this.logger.error("Failed to parse version: " + version);
    return false;
  }
  
  // Handle hyphen range: 1.2.3 - 2.3.4
  var hyphenRangeMatch = constraint.match(/^([^\s]+)\s*-\s*([^\s]+)$/);
  if (hyphenRangeMatch) {
    var lowerVersion = this._parseVersion(hyphenRangeMatch[1]);
    var upperVersion = this._parseVersion(hyphenRangeMatch[2]);
    
    if (!lowerVersion || !upperVersion) {
      this.logger.error("Failed to parse range versions: " + constraint);
      return false;
    }
    
    return this._compareVersions(parsedVersion, lowerVersion) >= 0 && 
           this._compareVersions(parsedVersion, upperVersion) <= 0;
  }
  
  // Handle multiple constraints: >=1.2.3 <2.0.0
  if (constraint.indexOf(' ') !== -1) {
    var constraints = constraint.split(/\s+/);
    for (var i = 0; i < constraints.length; i++) {
      if (!this._satisfiesVersionConstraint(version, constraints[i])) {
        return false;
      }
    }
    return true;
  }
  
  // Handle exact version: 1.2.3
  if (/^\d+(\.\d+)*$/.test(constraint)) {
    var parsedConstraint = this._parseVersion(constraint);
    return parsedConstraint && this._compareVersions(parsedVersion, parsedConstraint) === 0;
  }
  
  // Handle range: >=1.2.3
  var rangeMatch = constraint.match(/^([<>=~^]+)(.+)$/);
  if (rangeMatch) {
    var operator = rangeMatch[1];
    var constraintVersion = this._parseVersion(rangeMatch[2]);
    
    if (!constraintVersion) {
      this.logger.error("Failed to parse constraint version: " + rangeMatch[2]);
      return false;
    }
    
    var comparison = this._compareVersions(parsedVersion, constraintVersion);
    
    switch (operator) {
      case '=':
        return comparison === 0;
      case '>':
        return comparison > 0;
      case '>=':
        return comparison >= 0;
      case '<':
        return comparison < 0;
      case '<=':
        return comparison <= 0;
      case '~':
        // Compatible with minor version (patch can be greater)
        return parsedVersion.major === constraintVersion.major && 
               parsedVersion.minor === constraintVersion.minor && 
               parsedVersion.patch >= constraintVersion.patch;
      case '^':
        // Compatible with major version (minor and patch can be greater)
        return parsedVersion.major === constraintVersion.major && 
               (parsedVersion.minor > constraintVersion.minor || 
                (parsedVersion.minor === constraintVersion.minor && 
                 parsedVersion.patch >= constraintVersion.patch));
      default:
        this.logger.error("Unsupported operator: " + operator);
        return false;
    }
  }
  
  this.logger.error("Unsupported constraint format: " + constraint);
  return false;
};

/**
 * Parse a version string
 * @param {string} version - Version string
 * @returns {Object} - Parsed version
 * @private
 */
TentacleDependencyManager.prototype._parseVersion = function(version) {
  var match = version.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/);
  
  if (!match) {
    return null;
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: match[2] ? parseInt(match[2], 10) : 0,
    patch: match[3] ? parseInt(match[3], 10) : 0,
    prerelease: match[4] || '',
    build: match[5] || ''
  };
};

/**
 * Compare two versions
 * @param {Object} version1 - First version
 * @param {Object} version2 - Second version
 * @returns {number} - Comparison result (-1, 0, 1)
 * @private
 */
TentacleDependencyManager.prototype._compareVersions = function(version1, version2) {
  // Compare major version
  if (version1.major !== version2.major) {
    return version1.major > version2.major ? 1 : -1;
  }
  
  // Compare minor version
  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? 1 : -1;
  }
  
  // Compare patch version
  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? 1 : -1;
  }
  
  // Compare prerelease
  if (version1.prerelease !== version2.prerelease) {
    // No prerelease is greater than any prerelease
    if (!version1.prerelease) {
      return 1;
    }
    if (!version2.prerelease) {
      return -1;
    }
    
    // Compare prerelease versions
    return version1.prerelease > version2.prerelease ? 1 : -1;
  }
  
  // Versions are equal
  return 0;
};

/**
 * Handle tentacle selected event
 * @param {Object} event - Tentacle selected event
 * @private
 */
TentacleDependencyManager.prototype._handleTentacleSelected = function(event) {
  var self = this;
  
  this.logger.info("Tentacle selected: " + event.tentacleId);
  
  // Update state
  this.state.selectedTentacle = event.tentacleId;
  
  // Load dependencies
  this.loadDependencies(event.tentacleId)
    .catch(function(error) {
      self.logger.error("Failed to load dependencies for tentacle " + event.tentacleId, error);
    });
  
  // Load reverse dependencies
  this.loadReverseDependencies(event.tentacleId)
    .catch(function(error) {
      self.logger.error("Failed to load reverse dependencies for tentacle " + event.tentacleId, error);
    });
};

/**
 * Handle tentacle installed event
 * @param {Object} event - Tentacle installed event
 * @private
 */
TentacleDependencyManager.prototype._handleTentacleInstalled = function(event) {
  var self = this;
  
  this.logger.info("Tentacle installed: " + event.tentacleId);
  
  // Reload installed tentacles
  this.loadInstalledTentacles()
    .then(function() {
      // Reload dependencies if tentacle is selected
      if (self.state.selectedTentacle) {
        return self.loadDependencies(self.state.selectedTentacle);
      }
    })
    .catch(function(error) {
      self.logger.error("Failed to reload data after tentacle installation", error);
    });
};

/**
 * Handle tentacle uninstalled event
 * @param {Object} event - Tentacle uninstalled event
 * @private
 */
TentacleDependencyManager.prototype._handleTentacleUninstalled = function(event) {
  var self = this;
  
  this.logger.info("Tentacle uninstalled: " + event.tentacleId);
  
  // Reload installed tentacles
  this.loadInstalledTentacles()
    .then(function() {
      // Reload dependencies if tentacle is selected
      if (self.state.selectedTentacle) {
        return self.loadDependencies(self.state.selectedTentacle);
      }
    })
    .catch(function(error) {
      self.logger.error("Failed to reload data after tentacle uninstallation", error);
    });
};

/**
 * Handle tentacle updated event
 * @param {Object} event - Tentacle updated event
 * @private
 */
TentacleDependencyManager.prototype._handleTentacleUpdated = function(event) {
  var self = this;
  
  this.logger.info("Tentacle updated: " + event.tentacleId);
  
  // Reload installed tentacles
  this.loadInstalledTentacles()
    .then(function() {
      // Reload dependencies if tentacle is selected
      if (self.state.selectedTentacle) {
        return self.loadDependencies(self.state.selectedTentacle);
      }
    })
    .catch(function(error) {
      self.logger.error("Failed to reload data after tentacle update", error);
    });
};

/**
 * Handle install button click
 * @param {Event} event - Click event
 * @private
 */
TentacleDependencyManager.prototype._handleInstallButtonClick = function(event) {
  var self = this;
  
  this.logger.info("Install button clicked");
  
  if (!this.state.selectedTentacle) {
    this.logger.warn("No tentacle selected");
    return;
  }
  
  // Install missing dependencies
  this.installMissingDependencies(this.state.selectedTentacle)
    .then(function(result) {
      // Show result notification
      if (result.success) {
        self._showNotification('success', 'All dependencies installed successfully.');
      } else {
        self._showNotification('error', 'Failed to install some dependencies. Please check the logs for details.');
      }
    })
    .catch(function(error) {
      self.logger.error("Failed to install missing dependencies", error);
      self._showNotification('error', 'Failed to install dependencies: ' + error.message);
    });
};

/**
 * Handle view graph button click
 * @param {Event} event - Click event
 * @private
 */
TentacleDependencyManager.prototype._handleViewGraphButtonClick = function(event) {
  var self = this;
  
  this.logger.info("View graph button clicked");
  
  if (!this.state.selectedTentacle) {
    this.logger.warn("No tentacle selected");
    return;
  }
  
  // Get dependency graph
  var graph = this.getDependencyGraph(this.state.selectedTentacle);
  
  if (!graph) {
    this.logger.warn("No dependency graph available");
    return;
  }
  
  // Emit view graph requested event
  this.events.emit('dependency-graph:view-requested', {
    tentacleId: this.state.selectedTentacle,
    graph: graph
  });
};

/**
 * Handle dependency install button click
 * @param {string} dependencyId - Dependency ID
 * @private
 */
TentacleDependencyManager.prototype._handleDependencyInstallButtonClick = function(dependencyId) {
  var self = this;
  
  this.logger.info("Dependency install button clicked for: " + dependencyId);
  
  // Install dependency
  this._installDependency({
    id: dependencyId
  })
    .then(function(result) {
      if (result.success) {
        // Reload installed tentacles
        return self.loadInstalledTentacles()
          .then(function() {
            // Reload dependencies if tentacle is selected
            if (self.state.selectedTentacle) {
              return self.loadDependencies(self.state.selectedTentacle);
            }
          })
          .then(function() {
            self._showNotification('success', 'Dependency installed successfully.');
          });
      } else {
        self._showNotification('error', 'Failed to install dependency: ' + result.error);
      }
    })
    .catch(function(error) {
      self.logger.error("Failed to install dependency", error);
      self._showNotification('error', 'Failed to install dependency: ' + error.message);
    });
};

/**
 * Handle dependency update button click
 * @param {string} dependencyId - Dependency ID
 * @private
 */
TentacleDependencyManager.prototype._handleDependencyUpdateButtonClick = function(dependencyId) {
  var self = this;
  
  this.logger.info("Dependency update button clicked for: " + dependencyId);
  
  // Get dependency version constraint
  var versionConstraint = null;
  
  if (this.state.selectedTentacle && this.state.dependencies[this.state.selectedTentacle]) {
    var dependencies = this.state.dependencies[this.state.selectedTentacle].direct || [];
    
    for (var i = 0; i < dependencies.length; i++) {
      if (dependencies[i].id === dependencyId) {
        versionConstraint = dependencies[i].versionConstraint;
        break;
      }
    }
  }
  
  // Update dependency
  this.marketplaceCore.updateTentacle(dependencyId, {
    version: versionConstraint
  })
    .then(function(result) {
      // Reload installed tentacles
      return self.loadInstalledTentacles()
        .then(function() {
          // Reload dependencies if tentacle is selected
          if (self.state.selectedTentacle) {
            return self.loadDependencies(self.state.selectedTentacle);
          }
        })
        .then(function() {
          self._showNotification('success', 'Dependency updated successfully.');
        });
    })
    .catch(function(error) {
      self.logger.error("Failed to update dependency", error);
      self._showNotification('error', 'Failed to update dependency: ' + error.message);
    });
};

/**
 * Handle dependency view button click
 * @param {string} dependencyId - Dependency ID
 * @private
 */
TentacleDependencyManager.prototype._handleDependencyViewButtonClick = function(dependencyId) {
  this.logger.info("Dependency view button clicked for: " + dependencyId);
  
  // Emit tentacle view requested event
  this.events.emit('tentacle:view-requested', {
    tentacleId: dependencyId
  });
};

/**
 * Handle conflict resolve button click
 * @param {string} tentacleId - Tentacle ID
 * @param {string} conflictId - Conflict ID
 * @private
 */
TentacleDependencyManager.prototype._handleConflictResolveButtonClick = function(tentacleId, conflictId) {
  var self = this;
  
  this.logger.info("Conflict resolve button clicked for: " + conflictId);
  
  // Find conflict
  var conflict = null;
  
  if (this.state.conflicts[tentacleId]) {
    for (var i = 0; i < this.state.conflicts[tentacleId].length; i++) {
      if (this.state.conflicts[tentacleId][i].id === conflictId) {
        conflict = this.state.conflicts[tentacleId][i];
        break;
      }
    }
  }
  
  if (!conflict) {
    this.logger.error("Conflict not found: " + conflictId);
    return;
  }
  
  // Emit conflict resolve requested event
  this.events.emit('conflict:resolve-requested', {
    tentacleId: tentacleId,
    conflict: conflict
  });
};

/**
 * Show a notification
 * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
 * @param {string} message - Notification message
 * @private
 */
TentacleDependencyManager.prototype._showNotification = function(type, message) {
  this.logger.info("Showing notification: " + type + " - " + message);
  
  // Emit notification event
  this.events.emit('notification', {
    type: type,
    message: message
  });
  
  // Create notification element if container is available
  if (this.container && process.env.NODE_ENV !== 'test') {
    var notificationContainer = document.querySelector('.notification-container');
    
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.className = 'notification-container';
      document.body.appendChild(notificationContainer);
    }
    
    var notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    
    var notificationMessage = document.createElement('div');
    notificationMessage.className = 'notification-message';
    notificationMessage.textContent = message;
    
    var closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.textContent = '×';
    
    closeButton.addEventListener('click', function() {
      notification.remove();
    });
    
    notification.appendChild(notificationMessage);
    notification.appendChild(closeButton);
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(function() {
      notification.remove();
    }, 5000);
  }
};

/**
 * Get the status of the TentacleDependencyManager
 * @returns {Object} - Status object
 */
TentacleDependencyManager.prototype.getStatus = function() {
  return {
    initialized: this.initialized,
    selectedTentacle: this.state.selectedTentacle,
    installedTentaclesCount: Object.keys(this.state.installedTentacles).length,
    isLoading: this.state.isLoading,
    error: this.state.error,
    autoInstallDependencies: this.config.autoInstallDependencies,
    showDependencyWarnings: this.config.showDependencyWarnings,
    enableVersionConstraints: this.config.enableVersionConstraints,
    checkForConflicts: this.config.checkForConflicts
  };
};

/**
 * Shutdown the TentacleDependencyManager
 * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
 */
TentacleDependencyManager.prototype.shutdown = function() {
  var self = this;
  
  if (!this.initialized) {
    this.logger.warn("TentacleDependencyManager not initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Shutting down TentacleDependencyManager");
  
  return new Promise(function(resolve, reject) {
    try {
      // Remove event listeners if container is available
      if (self.container && process.env.NODE_ENV !== 'test') {
        // Install button
        var installButton = self.container.querySelector('.dependency-install-button');
        if (installButton) {
          installButton.removeEventListener('click', self._handleInstallButtonClick);
        }
        
        // View graph button
        var viewGraphButton = self.container.querySelector('.dependency-view-graph-button');
        if (viewGraphButton) {
          viewGraphButton.removeEventListener('click', self._handleViewGraphButtonClick);
        }
      }
      
      self.initialized = false;
      self.logger.info("TentacleDependencyManager shutdown complete");
      resolve(true);
    } catch (error) {
      self.logger.error("Failed to shutdown TentacleDependencyManager", error);
      reject(error);
    }
  });
};

module.exports = { TentacleDependencyManager };
