/**
 * @fileoverview Category Management System for the Aideon Tentacle Marketplace
 * This component manages the categorization of tentacles in the marketplace
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
 * CategoryManagementSystem class - Manages tentacle categories in the marketplace
 */
function CategoryManagementSystem(options) {
  options = options || {};
  
  this.options = options;
  this.container = options.container;
  this.marketplaceCore = options.marketplaceCore;
  this.config = options.config || {};
  this.logger = new Logger("CategoryManagementSystem");
  this.events = new EventEmitter();
  
  // Default configuration
  this.config.maxCategoryDepth = this.config.maxCategoryDepth || 3;
  this.config.maxSubcategoriesPerCategory = this.config.maxSubcategoriesPerCategory || 10;
  this.config.enableMultiCategoryAssignment = this.config.enableMultiCategoryAssignment !== false;
  this.config.enableCustomCategories = this.config.enableCustomCategories === true;
  this.config.enableCategoryFiltering = this.config.enableCategoryFiltering !== false;
  
  this.state = {
    categories: [],
    selectedCategory: null,
    expandedCategories: new Set(),
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
  
  this.logger.info("CategoryManagementSystem instance created");
}

/**
 * Initialize the CategoryManagementSystem
 * @returns {Promise<boolean>} - Promise resolving to true if initialization was successful
 */
CategoryManagementSystem.prototype.initialize = function() {
  var self = this;
  
  if (this.initialized) {
    this.logger.warn("CategoryManagementSystem already initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Initializing CategoryManagementSystem");
  
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
          // Load initial data
          return self.loadCategories();
        })
        .then(function() {
          // Set up event listeners
          self._setupEventListeners();
          
          // Set up UI layout
          if (process.env.NODE_ENV !== 'test') {
            self._setupUILayout();
          }
          
          self.initialized = true;
          self.logger.info("CategoryManagementSystem initialized successfully");
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to initialize CategoryManagementSystem", error);
          self.state.error = error.message;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to initialize CategoryManagementSystem", error);
      self.state.error = error.message;
      reject(error);
    }
  });
};

/**
 * Load categories
 * @returns {Promise<Array>} - Promise resolving to array of categories
 */
CategoryManagementSystem.prototype.loadCategories = function() {
  var self = this;
  
  this.logger.info("Loading categories");
  this.state.isLoading = true;
  
  return new Promise(function(resolve, reject) {
    try {
      // Get categories from marketplace core
      self.marketplaceCore.getCategories()
        .then(function(categories) {
          self.state.categories = categories;
          self.state.isLoading = false;
          
          // Emit categories loaded event
          self.events.emit('categories:loaded', {
            categories: categories
          });
          
          // Render categories if container is available
          if (self.container && process.env.NODE_ENV !== 'test') {
            self._renderCategories();
          }
          
          self.logger.info("Loaded " + categories.length + " categories");
          resolve(categories);
        })
        .catch(function(error) {
          self.logger.error("Failed to load categories", error);
          self.state.error = error.message;
          self.state.isLoading = false;
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to load categories", error);
      self.state.error = error.message;
      self.state.isLoading = false;
      reject(error);
    }
  });
};

/**
 * Get category by ID
 * @param {string} categoryId - Category ID
 * @returns {Object|null} - Category object or null if not found
 */
CategoryManagementSystem.prototype.getCategoryById = function(categoryId) {
  // Helper function to search categories recursively
  function findCategory(categories, id) {
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      
      if (category.id === id) {
        return category;
      }
      
      if (category.subcategories && category.subcategories.length > 0) {
        var subcategory = findCategory(category.subcategories, id);
        if (subcategory) {
          return subcategory;
        }
      }
    }
    
    return null;
  }
  
  return findCategory(this.state.categories, categoryId);
};

/**
 * Get tentacles by category
 * @param {string} categoryId - Category ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of tentacles to return
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.sortBy - Sort field
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc')
 * @param {boolean} options.includeSubcategories - Whether to include tentacles from subcategories
 * @returns {Promise<Array>} - Promise resolving to array of tentacles
 */
CategoryManagementSystem.prototype.getTentaclesByCategory = function(categoryId, options) {
  var self = this;
  options = options || {};
  
  this.logger.info("Getting tentacles for category: " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Get tentacles from marketplace core
      self.marketplaceCore.getTentaclesByCategory(categoryId, options)
        .then(function(tentacles) {
          // Emit tentacles loaded event
          self.events.emit('category:tentacles:loaded', {
            categoryId: categoryId,
            tentacles: tentacles,
            options: options
          });
          
          self.logger.info("Loaded " + tentacles.length + " tentacles for category " + categoryId);
          resolve(tentacles);
        })
        .catch(function(error) {
          self.logger.error("Failed to get tentacles for category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to get tentacles for category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Select category
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} - Promise resolving to selected category
 */
CategoryManagementSystem.prototype.selectCategory = function(categoryId) {
  var self = this;
  
  this.logger.info("Selecting category: " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Find category
      var category = self.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error("Category not found: " + categoryId);
      }
      
      // Update state
      self.state.selectedCategory = category;
      
      // Ensure category path is expanded
      self._expandCategoryPath(categoryId);
      
      // Get tentacles for category
      self.getTentaclesByCategory(categoryId, {
        includeSubcategories: true
      })
        .then(function(tentacles) {
          // Update UI
          if (process.env.NODE_ENV !== 'test') {
            self._updateCategoryUI();
          }
          
          // Emit category selected event
          self.events.emit('category:selected', {
            category: category,
            tentacles: tentacles
          });
          
          self.logger.info("Selected category: " + category.name);
          resolve(category);
        })
        .catch(function(error) {
          self.logger.error("Failed to select category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to select category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Toggle category expansion
 * @param {string} categoryId - Category ID
 * @returns {boolean} - Whether category is expanded after toggle
 */
CategoryManagementSystem.prototype.toggleCategoryExpansion = function(categoryId) {
  var self = this;
  
  this.logger.info("Toggling category expansion: " + categoryId);
  
  try {
    // Find category
    var category = this.getCategoryById(categoryId);
    
    if (!category) {
      throw new Error("Category not found: " + categoryId);
    }
    
    // Toggle expansion
    var isExpanded = this.state.expandedCategories.has(categoryId);
    
    if (isExpanded) {
      this.state.expandedCategories.delete(categoryId);
    } else {
      this.state.expandedCategories.add(categoryId);
    }
    
    // Update UI
    if (process.env.NODE_ENV !== 'test') {
      this._updateCategoryUI();
    }
    
    // Emit category expansion toggled event
    this.events.emit('category:expansion:toggled', {
      category: category,
      isExpanded: !isExpanded
    });
    
    this.logger.info("Category expansion toggled: " + category.name + ", expanded: " + !isExpanded);
    return !isExpanded;
  } catch (error) {
    this.logger.error("Failed to toggle category expansion for " + categoryId, error);
    throw error;
  }
};

/**
 * Create category
 * @param {Object} categoryData - Category data
 * @param {string} categoryData.name - Category name
 * @param {string} categoryData.description - Category description
 * @param {string} categoryData.parentId - Parent category ID (optional)
 * @returns {Promise<Object>} - Promise resolving to created category
 */
CategoryManagementSystem.prototype.createCategory = function(categoryData) {
  var self = this;
  
  this.logger.info("Creating category: " + categoryData.name);
  
  return new Promise(function(resolve, reject) {
    try {
      // Validate category data
      if (!categoryData.name) {
        throw new Error("Category name is required");
      }
      
      // Check if custom categories are enabled
      if (!self.config.enableCustomCategories) {
        throw new Error("Custom categories are not enabled");
      }
      
      // Check parent category if provided
      if (categoryData.parentId) {
        var parentCategory = self.getCategoryById(categoryData.parentId);
        
        if (!parentCategory) {
          throw new Error("Parent category not found: " + categoryData.parentId);
        }
        
        // Check category depth
        var depth = self._getCategoryDepth(parentCategory);
        
        if (depth >= self.config.maxCategoryDepth) {
          throw new Error("Maximum category depth (" + self.config.maxCategoryDepth + ") exceeded");
        }
        
        // Check subcategory count
        if (parentCategory.subcategories && parentCategory.subcategories.length >= self.config.maxSubcategoriesPerCategory) {
          throw new Error("Maximum subcategories per category (" + self.config.maxSubcategoriesPerCategory + ") exceeded");
        }
      }
      
      // Create category in marketplace core
      self.marketplaceCore.createCategory(categoryData)
        .then(function(category) {
          // Reload categories
          return self.loadCategories()
            .then(function() {
              // Emit category created event
              self.events.emit('category:created', {
                category: category
              });
              
              self.logger.info("Category created: " + category.name);
              resolve(category);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to create category " + categoryData.name, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to create category " + categoryData.name, error);
      reject(error);
    }
  });
};

/**
 * Update category
 * @param {string} categoryId - Category ID
 * @param {Object} categoryData - Category data
 * @param {string} categoryData.name - Category name
 * @param {string} categoryData.description - Category description
 * @returns {Promise<Object>} - Promise resolving to updated category
 */
CategoryManagementSystem.prototype.updateCategory = function(categoryId, categoryData) {
  var self = this;
  
  this.logger.info("Updating category: " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Find category
      var category = self.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error("Category not found: " + categoryId);
      }
      
      // Check if custom categories are enabled
      if (!self.config.enableCustomCategories) {
        throw new Error("Custom categories are not enabled");
      }
      
      // Update category in marketplace core
      self.marketplaceCore.updateCategory(categoryId, categoryData)
        .then(function(updatedCategory) {
          // Reload categories
          return self.loadCategories()
            .then(function() {
              // Emit category updated event
              self.events.emit('category:updated', {
                category: updatedCategory
              });
              
              self.logger.info("Category updated: " + updatedCategory.name);
              resolve(updatedCategory);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to update category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to update category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Delete category
 * @param {string} categoryId - Category ID
 * @returns {Promise<boolean>} - Promise resolving to true if deletion was successful
 */
CategoryManagementSystem.prototype.deleteCategory = function(categoryId) {
  var self = this;
  
  this.logger.info("Deleting category: " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Find category
      var category = self.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error("Category not found: " + categoryId);
      }
      
      // Check if custom categories are enabled
      if (!self.config.enableCustomCategories) {
        throw new Error("Custom categories are not enabled");
      }
      
      // Check if category has subcategories
      if (category.subcategories && category.subcategories.length > 0) {
        throw new Error("Cannot delete category with subcategories");
      }
      
      // Delete category in marketplace core
      self.marketplaceCore.deleteCategory(categoryId)
        .then(function() {
          // Reload categories
          return self.loadCategories()
            .then(function() {
              // Emit category deleted event
              self.events.emit('category:deleted', {
                categoryId: categoryId
              });
              
              self.logger.info("Category deleted: " + categoryId);
              resolve(true);
            });
        })
        .catch(function(error) {
          self.logger.error("Failed to delete category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to delete category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Assign tentacle to category
 * @param {string} tentacleId - Tentacle ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<boolean>} - Promise resolving to true if assignment was successful
 */
CategoryManagementSystem.prototype.assignTentacleToCategory = function(tentacleId, categoryId) {
  var self = this;
  
  this.logger.info("Assigning tentacle " + tentacleId + " to category " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Find category
      var category = self.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error("Category not found: " + categoryId);
      }
      
      // Assign tentacle to category in marketplace core
      self.marketplaceCore.assignTentacleToCategory(tentacleId, categoryId)
        .then(function() {
          // Emit tentacle assigned event
          self.events.emit('tentacle:assigned', {
            tentacleId: tentacleId,
            categoryId: categoryId
          });
          
          self.logger.info("Tentacle " + tentacleId + " assigned to category " + categoryId);
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to assign tentacle " + tentacleId + " to category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to assign tentacle " + tentacleId + " to category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Remove tentacle from category
 * @param {string} tentacleId - Tentacle ID
 * @param {string} categoryId - Category ID
 * @returns {Promise<boolean>} - Promise resolving to true if removal was successful
 */
CategoryManagementSystem.prototype.removeTentacleFromCategory = function(tentacleId, categoryId) {
  var self = this;
  
  this.logger.info("Removing tentacle " + tentacleId + " from category " + categoryId);
  
  return new Promise(function(resolve, reject) {
    try {
      // Find category
      var category = self.getCategoryById(categoryId);
      
      if (!category) {
        throw new Error("Category not found: " + categoryId);
      }
      
      // Remove tentacle from category in marketplace core
      self.marketplaceCore.removeTentacleFromCategory(tentacleId, categoryId)
        .then(function() {
          // Emit tentacle removed event
          self.events.emit('tentacle:removed', {
            tentacleId: tentacleId,
            categoryId: categoryId
          });
          
          self.logger.info("Tentacle " + tentacleId + " removed from category " + categoryId);
          resolve(true);
        })
        .catch(function(error) {
          self.logger.error("Failed to remove tentacle " + tentacleId + " from category " + categoryId, error);
          reject(error);
        });
    } catch (error) {
      self.logger.error("Failed to remove tentacle " + tentacleId + " from category " + categoryId, error);
      reject(error);
    }
  });
};

/**
 * Get category depth
 * @param {Object} category - Category object
 * @returns {number} - Category depth
 * @private
 */
CategoryManagementSystem.prototype._getCategoryDepth = function(category) {
  var self = this;
  
  // Helper function to find category path
  function findCategoryPath(categories, id, path) {
    path = path || [];
    
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      var newPath = path.concat([category]);
      
      if (category.id === id) {
        return newPath;
      }
      
      if (category.subcategories && category.subcategories.length > 0) {
        var subcategoryPath = findCategoryPath(category.subcategories, id, newPath);
        if (subcategoryPath) {
          return subcategoryPath;
        }
      }
    }
    
    return null;
  }
  
  var path = findCategoryPath(this.state.categories, category.id);
  return path ? path.length : 0;
};

/**
 * Expand category path
 * @param {string} categoryId - Category ID
 * @private
 */
CategoryManagementSystem.prototype._expandCategoryPath = function(categoryId) {
  var self = this;
  
  // Helper function to find category path
  function findCategoryPath(categories, id, path) {
    path = path || [];
    
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      var newPath = path.concat([category]);
      
      if (category.id === id) {
        return newPath;
      }
      
      if (category.subcategories && category.subcategories.length > 0) {
        var subcategoryPath = findCategoryPath(category.subcategories, id, newPath);
        if (subcategoryPath) {
          return subcategoryPath;
        }
      }
    }
    
    return null;
  }
  
  var path = findCategoryPath(this.state.categories, categoryId);
  
  if (path) {
    // Expand all categories in path except the last one
    for (var i = 0; i < path.length - 1; i++) {
      this.state.expandedCategories.add(path[i].id);
    }
  }
};

/**
 * Set up event listeners
 * @private
 */
CategoryManagementSystem.prototype._setupEventListeners = function() {
  var self = this;
  
  this.logger.info("Setting up event listeners");
  
  // Listen for marketplace core events
  if (this.marketplaceCore && this.marketplaceCore.events) {
    this.marketplaceCore.events.on("categories:updated", function(event) {
      self._handleCategoriesUpdated(event);
    });
    
    this.marketplaceCore.events.on("tentacle:category:updated", function(event) {
      self._handleTentacleCategoryUpdated(event);
    });
  }
  
  // Set up UI event listeners if container is available
  if (this.container && process.env.NODE_ENV !== 'test') {
    // Category click events
    var categoryItems = this.container.querySelectorAll('.category-item');
    for (var i = 0; i < categoryItems.length; i++) {
      var item = categoryItems[i];
      item.addEventListener('click', function(event) {
        event.stopPropagation();
        self._handleCategoryClick(this.dataset.categoryId);
      });
    }
    
    // Category expand/collapse events
    var categoryExpanders = this.container.querySelectorAll('.category-expander');
    for (var j = 0; j < categoryExpanders.length; j++) {
      var expander = categoryExpanders[j];
      expander.addEventListener('click', function(event) {
        event.stopPropagation();
        self._handleExpanderClick(this.dataset.categoryId);
      });
    }
    
    // Category create button
    var createButton = this.container.querySelector('.category-create-button');
    if (createButton) {
      createButton.addEventListener('click', function(event) {
        self._handleCreateButtonClick(event);
      });
    }
    
    // Category edit buttons
    var editButtons = this.container.querySelectorAll('.category-edit-button');
    for (var k = 0; k < editButtons.length; k++) {
      var editButton = editButtons[k];
      editButton.addEventListener('click', function(event) {
        event.stopPropagation();
        self._handleEditButtonClick(this.dataset.categoryId);
      });
    }
    
    // Category delete buttons
    var deleteButtons = this.container.querySelectorAll('.category-delete-button');
    for (var l = 0; l < deleteButtons.length; l++) {
      var deleteButton = deleteButtons[l];
      deleteButton.addEventListener('click', function(event) {
        event.stopPropagation();
        self._handleDeleteButtonClick(this.dataset.categoryId);
      });
    }
  }
  
  this.logger.info("Event listeners set up");
};

/**
 * Set up UI layout
 * @private
 */
CategoryManagementSystem.prototype._setupUILayout = function() {
  var self = this;
  
  this.logger.info("Setting up UI layout");
  
  // Create category management container
  var categoryContainer = document.createElement('div');
  categoryContainer.className = 'category-management-container';
  
  // Create category header
  var categoryHeader = document.createElement('div');
  categoryHeader.className = 'category-header';
  
  // Create category title
  var categoryTitle = document.createElement('h3');
  categoryTitle.className = 'category-title';
  categoryTitle.textContent = 'Categories';
  
  // Create category actions
  var categoryActions = document.createElement('div');
  categoryActions.className = 'category-actions';
  
  // Create category create button if custom categories are enabled
  if (this.config.enableCustomCategories) {
    var createButton = document.createElement('button');
    createButton.className = 'category-create-button';
    createButton.textContent = 'Create Category';
    createButton.setAttribute('aria-label', 'Create new category');
    
    categoryActions.appendChild(createButton);
  }
  
  // Add title and actions to header
  categoryHeader.appendChild(categoryTitle);
  categoryHeader.appendChild(categoryActions);
  
  // Create category list container
  var categoryList = document.createElement('div');
  categoryList.className = 'category-list';
  
  // Add header and list to container
  categoryContainer.appendChild(categoryHeader);
  categoryContainer.appendChild(categoryList);
  
  // Add container to main container
  this.container.appendChild(categoryContainer);
  
  this.logger.info("UI layout set up");
};

/**
 * Render categories
 * @private
 */
CategoryManagementSystem.prototype._renderCategories = function() {
  var self = this;
  
  this.logger.info("Rendering categories");
  
  var categoryList = this.container.querySelector('.category-list');
  
  if (!categoryList) {
    this.logger.error("Category list container not found");
    return;
  }
  
  // Clear existing content
  categoryList.innerHTML = '';
  
  // Render categories recursively
  function renderCategoryTree(categories, parentElement, level) {
    level = level || 0;
    
    // Create category list
    var categoryListElement = document.createElement('ul');
    categoryListElement.className = 'category-list-level-' + level;
    
    // Add categories to list
    for (var i = 0; i < categories.length; i++) {
      var category = categories[i];
      
      // Create category item
      var categoryItem = document.createElement('li');
      categoryItem.className = 'category-item';
      categoryItem.dataset.categoryId = category.id;
      
      if (self.state.selectedCategory && self.state.selectedCategory.id === category.id) {
        categoryItem.classList.add('selected');
      }
      
      // Create category content
      var categoryContent = document.createElement('div');
      categoryContent.className = 'category-content';
      
      // Create expander if category has subcategories
      if (category.subcategories && category.subcategories.length > 0) {
        var expander = document.createElement('span');
        expander.className = 'category-expander';
        expander.dataset.categoryId = category.id;
        
        if (self.state.expandedCategories.has(category.id)) {
          expander.classList.add('expanded');
          expander.textContent = '▼';
        } else {
          expander.textContent = '►';
        }
        
        categoryContent.appendChild(expander);
      } else {
        // Add spacer for alignment
        var spacer = document.createElement('span');
        spacer.className = 'category-spacer';
        categoryContent.appendChild(spacer);
      }
      
      // Create category name
      var categoryName = document.createElement('span');
      categoryName.className = 'category-name';
      categoryName.textContent = category.name;
      
      // Create category count
      var categoryCount = document.createElement('span');
      categoryCount.className = 'category-count';
      categoryCount.textContent = category.tentacleCount || 0;
      
      // Create category actions if custom categories are enabled
      if (self.config.enableCustomCategories) {
        var categoryActions = document.createElement('div');
        categoryActions.className = 'category-item-actions';
        
        // Create edit button
        var editButton = document.createElement('button');
        editButton.className = 'category-edit-button';
        editButton.dataset.categoryId = category.id;
        editButton.textContent = 'Edit';
        editButton.setAttribute('aria-label', 'Edit category ' + category.name);
        
        // Create delete button
        var deleteButton = document.createElement('button');
        deleteButton.className = 'category-delete-button';
        deleteButton.dataset.categoryId = category.id;
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', 'Delete category ' + category.name);
        
        // Add buttons to actions
        categoryActions.appendChild(editButton);
        categoryActions.appendChild(deleteButton);
        
        // Add actions to content
        categoryContent.appendChild(categoryActions);
      }
      
      // Add name and count to content
      categoryContent.appendChild(categoryName);
      categoryContent.appendChild(categoryCount);
      
      // Add content to item
      categoryItem.appendChild(categoryContent);
      
      // Add subcategories if expanded
      if (category.subcategories && category.subcategories.length > 0 && self.state.expandedCategories.has(category.id)) {
        renderCategoryTree(category.subcategories, categoryItem, level + 1);
      }
      
      // Add item to list
      categoryListElement.appendChild(categoryItem);
    }
    
    // Add list to parent element
    parentElement.appendChild(categoryListElement);
  }
  
  // Render top-level categories
  renderCategoryTree(this.state.categories, categoryList);
  
  this.logger.info("Categories rendered");
};

/**
 * Update category UI
 * @private
 */
CategoryManagementSystem.prototype._updateCategoryUI = function() {
  var self = this;
  
  this.logger.info("Updating category UI");
  
  // Update selected category
  var categoryItems = this.container.querySelectorAll('.category-item');
  for (var i = 0; i < categoryItems.length; i++) {
    var item = categoryItems[i];
    if (this.state.selectedCategory && item.dataset.categoryId === this.state.selectedCategory.id) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  }
  
  // Update expanded categories
  var expanders = this.container.querySelectorAll('.category-expander');
  for (var j = 0; j < expanders.length; j++) {
    var expander = expanders[j];
    if (this.state.expandedCategories.has(expander.dataset.categoryId)) {
      expander.classList.add('expanded');
      expander.textContent = '▼';
      
      // Find parent category item
      var categoryItem = expander.closest('.category-item');
      
      // Find category
      var category = this.getCategoryById(expander.dataset.categoryId);
      
      // Check if subcategories are already rendered
      var subcategoryList = categoryItem.querySelector('.category-list-level-' + (parseInt(categoryItem.closest('[class^="category-list-level-"]').className.match(/category-list-level-(\d+)/)[1]) + 1));
      
      if (!subcategoryList && category && category.subcategories && category.subcategories.length > 0) {
        // Render subcategories
        var level = parseInt(categoryItem.closest('[class^="category-list-level-"]').className.match(/category-list-level-(\d+)/)[1]) + 1;
        
        // Create subcategory list
        var subcategoryListElement = document.createElement('ul');
        subcategoryListElement.className = 'category-list-level-' + level;
        
        // Add subcategories to list
        for (var k = 0; k < category.subcategories.length; k++) {
          var subcategory = category.subcategories[k];
          
          // Create subcategory item
          var subcategoryItem = document.createElement('li');
          subcategoryItem.className = 'category-item';
          subcategoryItem.dataset.categoryId = subcategory.id;
          
          if (this.state.selectedCategory && this.state.selectedCategory.id === subcategory.id) {
            subcategoryItem.classList.add('selected');
          }
          
          // Create subcategory content
          var subcategoryContent = document.createElement('div');
          subcategoryContent.className = 'category-content';
          
          // Create expander if subcategory has subcategories
          if (subcategory.subcategories && subcategory.subcategories.length > 0) {
            var subcategoryExpander = document.createElement('span');
            subcategoryExpander.className = 'category-expander';
            subcategoryExpander.dataset.categoryId = subcategory.id;
            
            if (this.state.expandedCategories.has(subcategory.id)) {
              subcategoryExpander.classList.add('expanded');
              subcategoryExpander.textContent = '▼';
            } else {
              subcategoryExpander.textContent = '►';
            }
            
            subcategoryContent.appendChild(subcategoryExpander);
          } else {
            // Add spacer for alignment
            var spacer = document.createElement('span');
            spacer.className = 'category-spacer';
            subcategoryContent.appendChild(spacer);
          }
          
          // Create subcategory name
          var subcategoryName = document.createElement('span');
          subcategoryName.className = 'category-name';
          subcategoryName.textContent = subcategory.name;
          
          // Create subcategory count
          var subcategoryCount = document.createElement('span');
          subcategoryCount.className = 'category-count';
          subcategoryCount.textContent = subcategory.tentacleCount || 0;
          
          // Create subcategory actions if custom categories are enabled
          if (this.config.enableCustomCategories) {
            var subcategoryActions = document.createElement('div');
            subcategoryActions.className = 'category-item-actions';
            
            // Create edit button
            var editButton = document.createElement('button');
            editButton.className = 'category-edit-button';
            editButton.dataset.categoryId = subcategory.id;
            editButton.textContent = 'Edit';
            editButton.setAttribute('aria-label', 'Edit category ' + subcategory.name);
            
            // Create delete button
            var deleteButton = document.createElement('button');
            deleteButton.className = 'category-delete-button';
            deleteButton.dataset.categoryId = subcategory.id;
            deleteButton.textContent = 'Delete';
            deleteButton.setAttribute('aria-label', 'Delete category ' + subcategory.name);
            
            // Add buttons to actions
            subcategoryActions.appendChild(editButton);
            subcategoryActions.appendChild(deleteButton);
            
            // Add actions to content
            subcategoryContent.appendChild(subcategoryActions);
          }
          
          // Add name and count to content
          subcategoryContent.appendChild(subcategoryName);
          subcategoryContent.appendChild(subcategoryCount);
          
          // Add content to item
          subcategoryItem.appendChild(subcategoryContent);
          
          // Add item to list
          subcategoryListElement.appendChild(subcategoryItem);
        }
        
        // Add list to parent item
        categoryItem.appendChild(subcategoryListElement);
      }
    } else {
      expander.classList.remove('expanded');
      expander.textContent = '►';
      
      // Find parent category item
      var categoryItem = expander.closest('.category-item');
      
      // Remove subcategory list if exists
      var subcategoryList = categoryItem.querySelector('[class^="category-list-level-"]');
      if (subcategoryList) {
        categoryItem.removeChild(subcategoryList);
      }
    }
  }
  
  this.logger.info("Category UI updated");
};

/**
 * Handle categories updated event
 * @param {Object} event - Categories updated event
 * @private
 */
CategoryManagementSystem.prototype._handleCategoriesUpdated = function(event) {
  var self = this;
  
  this.logger.info("Categories updated");
  
  // Reload categories
  this.loadCategories().catch(function(error) {
    self.logger.error("Failed to reload categories", error);
  });
};

/**
 * Handle tentacle category updated event
 * @param {Object} event - Tentacle category updated event
 * @private
 */
CategoryManagementSystem.prototype._handleTentacleCategoryUpdated = function(event) {
  var self = this;
  
  this.logger.info("Tentacle category updated");
  
  // Reload categories
  this.loadCategories().catch(function(error) {
    self.logger.error("Failed to reload categories", error);
  });
};

/**
 * Handle category click
 * @param {string} categoryId - Category ID
 * @private
 */
CategoryManagementSystem.prototype._handleCategoryClick = function(categoryId) {
  var self = this;
  
  this.logger.info("Category clicked: " + categoryId);
  
  // Select category
  this.selectCategory(categoryId).catch(function(error) {
    self.logger.error("Failed to select category " + categoryId, error);
  });
};

/**
 * Handle expander click
 * @param {string} categoryId - Category ID
 * @private
 */
CategoryManagementSystem.prototype._handleExpanderClick = function(categoryId) {
  var self = this;
  
  this.logger.info("Expander clicked: " + categoryId);
  
  // Toggle category expansion
  try {
    this.toggleCategoryExpansion(categoryId);
  } catch (error) {
    this.logger.error("Failed to toggle category expansion for " + categoryId, error);
  }
};

/**
 * Handle create button click
 * @param {Event} event - Click event
 * @private
 */
CategoryManagementSystem.prototype._handleCreateButtonClick = function(event) {
  this.logger.info("Create button clicked");
  
  // Emit create category event
  this.events.emit('category:create:requested', {});
};

/**
 * Handle edit button click
 * @param {string} categoryId - Category ID
 * @private
 */
CategoryManagementSystem.prototype._handleEditButtonClick = function(categoryId) {
  this.logger.info("Edit button clicked: " + categoryId);
  
  // Find category
  var category = this.getCategoryById(categoryId);
  
  if (!category) {
    this.logger.error("Category not found: " + categoryId);
    return;
  }
  
  // Emit edit category event
  this.events.emit('category:edit:requested', {
    category: category
  });
};

/**
 * Handle delete button click
 * @param {string} categoryId - Category ID
 * @private
 */
CategoryManagementSystem.prototype._handleDeleteButtonClick = function(categoryId) {
  this.logger.info("Delete button clicked: " + categoryId);
  
  // Find category
  var category = this.getCategoryById(categoryId);
  
  if (!category) {
    this.logger.error("Category not found: " + categoryId);
    return;
  }
  
  // Emit delete category event
  this.events.emit('category:delete:requested', {
    category: category
  });
};

/**
 * Get the status of the CategoryManagementSystem
 * @returns {Object} - Status object
 */
CategoryManagementSystem.prototype.getStatus = function() {
  return {
    initialized: this.initialized,
    categoryCount: this.state.categories.length,
    selectedCategory: this.state.selectedCategory ? this.state.selectedCategory.id : null,
    expandedCategoryCount: this.state.expandedCategories.size,
    isLoading: this.state.isLoading,
    error: this.state.error,
    enableCustomCategories: this.config.enableCustomCategories,
    enableMultiCategoryAssignment: this.config.enableMultiCategoryAssignment
  };
};

/**
 * Shutdown the CategoryManagementSystem
 * @returns {Promise<boolean>} - Promise resolving to true if shutdown was successful
 */
CategoryManagementSystem.prototype.shutdown = function() {
  var self = this;
  
  if (!this.initialized) {
    this.logger.warn("CategoryManagementSystem not initialized");
    return Promise.resolve(true);
  }
  
  this.logger.info("Shutting down CategoryManagementSystem");
  
  return new Promise(function(resolve, reject) {
    try {
      // Remove event listeners if container is available
      if (self.container && process.env.NODE_ENV !== 'test') {
        // Category click events
        var categoryItems = self.container.querySelectorAll('.category-item');
        for (var i = 0; i < categoryItems.length; i++) {
          var item = categoryItems[i];
          item.removeEventListener('click', self._handleCategoryClick);
        }
        
        // Category expand/collapse events
        var categoryExpanders = self.container.querySelectorAll('.category-expander');
        for (var j = 0; j < categoryExpanders.length; j++) {
          var expander = categoryExpanders[j];
          expander.removeEventListener('click', self._handleExpanderClick);
        }
        
        // Category create button
        var createButton = self.container.querySelector('.category-create-button');
        if (createButton) {
          createButton.removeEventListener('click', self._handleCreateButtonClick);
        }
        
        // Category edit buttons
        var editButtons = self.container.querySelectorAll('.category-edit-button');
        for (var k = 0; k < editButtons.length; k++) {
          var editButton = editButtons[k];
          editButton.removeEventListener('click', self._handleEditButtonClick);
        }
        
        // Category delete buttons
        var deleteButtons = self.container.querySelectorAll('.category-delete-button');
        for (var l = 0; l < deleteButtons.length; l++) {
          var deleteButton = deleteButtons[l];
          deleteButton.removeEventListener('click', self._handleDeleteButtonClick);
        }
      }
      
      self.initialized = false;
      self.logger.info("CategoryManagementSystem shutdown complete");
      resolve(true);
    } catch (error) {
      self.logger.error("Failed to shutdown CategoryManagementSystem", error);
      reject(error);
    }
  });
};

module.exports = { CategoryManagementSystem };
