/**
 * @fileoverview Tests for the CategoryManagementSystem component
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies
var CategoryManagementSystem = require('../../../../src/marketplace/ui/category/CategoryManagementSystem').CategoryManagementSystem;

// Create mock modules
jest.mock('../../../../core/logging/Logger', () => ({
  Logger: function() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../core/events/EventEmitter', () => ({
  EventEmitter: function() {
    return {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../test/mocks/Logger', () => ({
  Logger: function() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }
}), { virtual: true });

jest.mock('../../../../test/mocks/EventEmitter', () => ({
  EventEmitter: function() {
    return {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    };
  }
}), { virtual: true });

// Mock marketplace core
var mockMarketplaceCore = {
  initialized: true,
  initialize: jest.fn().mockResolvedValue(true),
  getCategories: jest.fn(),
  getTentaclesByCategory: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  assignTentacleToCategory: jest.fn(),
  removeTentacleFromCategory: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }
};

// Test data
var mockCategories = [
  {
    id: 'cat1',
    name: 'Category 1',
    description: 'Description for Category 1',
    tentacleCount: 5,
    subcategories: [
      {
        id: 'cat1-1',
        name: 'Subcategory 1-1',
        description: 'Description for Subcategory 1-1',
        tentacleCount: 2,
        subcategories: []
      },
      {
        id: 'cat1-2',
        name: 'Subcategory 1-2',
        description: 'Description for Subcategory 1-2',
        tentacleCount: 3,
        subcategories: []
      }
    ]
  },
  {
    id: 'cat2',
    name: 'Category 2',
    description: 'Description for Category 2',
    tentacleCount: 3,
    subcategories: []
  }
];

var mockTentacles = [
  {
    id: 'tentacle1',
    name: 'Tentacle 1',
    description: 'Description for Tentacle 1',
    categories: ['cat1']
  },
  {
    id: 'tentacle2',
    name: 'Tentacle 2',
    description: 'Description for Tentacle 2',
    categories: ['cat1', 'cat2']
  }
];

describe('CategoryManagementSystem', function() {
  var categoryManagementSystem;
  var mockContainer;
  
  beforeEach(function() {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock container
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue({
        innerHTML: '',
        appendChild: jest.fn()
      }),
      querySelectorAll: jest.fn().mockReturnValue([])
    };
    
    // Mock marketplace core responses
    mockMarketplaceCore.getCategories.mockResolvedValue(mockCategories);
    mockMarketplaceCore.getTentaclesByCategory.mockResolvedValue(mockTentacles);
    mockMarketplaceCore.createCategory.mockResolvedValue(mockCategories[0]);
    mockMarketplaceCore.updateCategory.mockResolvedValue(mockCategories[0]);
    mockMarketplaceCore.deleteCategory.mockResolvedValue(true);
    mockMarketplaceCore.assignTentacleToCategory.mockResolvedValue(true);
    mockMarketplaceCore.removeTentacleFromCategory.mockResolvedValue(true);
    
    // Create instance
    categoryManagementSystem = new CategoryManagementSystem({
      container: mockContainer,
      marketplaceCore: mockMarketplaceCore,
      config: {
        enableCustomCategories: true,
        enableMultiCategoryAssignment: true
      }
    });
  });
  
  describe('initialization', function() {
    test('should initialize successfully', function() {
      return expect(categoryManagementSystem.initialize()).resolves.toBe(true);
    });
    
    test('should load categories during initialization', function() {
      return categoryManagementSystem.initialize().then(function() {
        expect(mockMarketplaceCore.getCategories).toHaveBeenCalled();
      });
    });
    
    test('should fail initialization if marketplaceCore is missing', function() {
      categoryManagementSystem = new CategoryManagementSystem({
        container: mockContainer
      });
      
      return expect(categoryManagementSystem.initialize()).rejects.toThrow();
    });
  });
  
  describe('category operations', function() {
    beforeEach(function() {
      return categoryManagementSystem.initialize();
    });
    
    test('should get category by ID', function() {
      var category = categoryManagementSystem.getCategoryById('cat1');
      expect(category).toEqual(mockCategories[0]);
    });
    
    test('should get subcategory by ID', function() {
      var category = categoryManagementSystem.getCategoryById('cat1-1');
      expect(category).toEqual(mockCategories[0].subcategories[0]);
    });
    
    test('should return null for non-existent category ID', function() {
      var category = categoryManagementSystem.getCategoryById('non-existent');
      expect(category).toBeNull();
    });
    
    test('should select category', function() {
      return categoryManagementSystem.selectCategory('cat1').then(function(category) {
        expect(category).toEqual(mockCategories[0]);
        expect(categoryManagementSystem.state.selectedCategory).toEqual(mockCategories[0]);
        expect(mockMarketplaceCore.getTentaclesByCategory).toHaveBeenCalledWith('cat1', expect.any(Object));
      });
    });
    
    test('should toggle category expansion', function() {
      var isExpanded = categoryManagementSystem.toggleCategoryExpansion('cat1');
      expect(isExpanded).toBe(true);
      expect(categoryManagementSystem.state.expandedCategories.has('cat1')).toBe(true);
      
      isExpanded = categoryManagementSystem.toggleCategoryExpansion('cat1');
      expect(isExpanded).toBe(false);
      expect(categoryManagementSystem.state.expandedCategories.has('cat1')).toBe(false);
    });
    
    test('should create category', function() {
      var categoryData = {
        name: 'New Category',
        description: 'Description for New Category'
      };
      
      return categoryManagementSystem.createCategory(categoryData).then(function(category) {
        expect(mockMarketplaceCore.createCategory).toHaveBeenCalledWith(categoryData);
        expect(mockMarketplaceCore.getCategories).toHaveBeenCalled();
      });
    });
    
    test('should update category', function() {
      var categoryData = {
        name: 'Updated Category',
        description: 'Updated description'
      };
      
      return categoryManagementSystem.updateCategory('cat1', categoryData).then(function(category) {
        expect(mockMarketplaceCore.updateCategory).toHaveBeenCalledWith('cat1', categoryData);
        expect(mockMarketplaceCore.getCategories).toHaveBeenCalled();
      });
    });
    
    test('should delete category', function() {
      return categoryManagementSystem.deleteCategory('cat2').then(function(result) {
        expect(mockMarketplaceCore.deleteCategory).toHaveBeenCalledWith('cat2');
        expect(mockMarketplaceCore.getCategories).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
    
    test('should assign tentacle to category', function() {
      return categoryManagementSystem.assignTentacleToCategory('tentacle1', 'cat2').then(function(result) {
        expect(mockMarketplaceCore.assignTentacleToCategory).toHaveBeenCalledWith('tentacle1', 'cat2');
        expect(result).toBe(true);
      });
    });
    
    test('should remove tentacle from category', function() {
      return categoryManagementSystem.removeTentacleFromCategory('tentacle1', 'cat1').then(function(result) {
        expect(mockMarketplaceCore.removeTentacleFromCategory).toHaveBeenCalledWith('tentacle1', 'cat1');
        expect(result).toBe(true);
      });
    });
  });
  
  describe('error handling', function() {
    beforeEach(function() {
      return categoryManagementSystem.initialize();
    });
    
    test('should handle error when selecting non-existent category', function() {
      return expect(categoryManagementSystem.selectCategory('non-existent')).rejects.toThrow();
    });
    
    test('should handle error when toggling expansion of non-existent category', function() {
      expect(function() {
        categoryManagementSystem.toggleCategoryExpansion('non-existent');
      }).toThrow();
    });
    
    test('should handle error when creating category with missing name', function() {
      return expect(categoryManagementSystem.createCategory({})).rejects.toThrow();
    });
    
    test('should handle error when updating non-existent category', function() {
      return expect(categoryManagementSystem.updateCategory('non-existent', { name: 'Updated' })).rejects.toThrow();
    });
    
    test('should handle error when deleting non-existent category', function() {
      return expect(categoryManagementSystem.deleteCategory('non-existent')).rejects.toThrow();
    });
  });
  
  describe('event handling', function() {
    beforeEach(function() {
      return categoryManagementSystem.initialize();
    });
    
    test('should emit events when category is selected', function() {
      return categoryManagementSystem.selectCategory('cat1').then(function() {
        expect(categoryManagementSystem.events.emit).toHaveBeenCalledWith(
          'category:selected',
          expect.objectContaining({
            category: expect.any(Object),
            tentacles: expect.any(Array)
          })
        );
      });
    });
    
    test('should emit events when category expansion is toggled', function() {
      categoryManagementSystem.toggleCategoryExpansion('cat1');
      
      expect(categoryManagementSystem.events.emit).toHaveBeenCalledWith(
        'category:expansion:toggled',
        expect.objectContaining({
          category: expect.any(Object),
          isExpanded: expect.any(Boolean)
        })
      );
    });
    
    test('should emit events when category is created', function() {
      return categoryManagementSystem.createCategory({
        name: 'New Category',
        description: 'Description for New Category'
      }).then(function() {
        expect(categoryManagementSystem.events.emit).toHaveBeenCalledWith(
          'category:created',
          expect.objectContaining({
            category: expect.any(Object)
          })
        );
      });
    });
    
    test('should emit events when category is updated', function() {
      return categoryManagementSystem.updateCategory('cat1', {
        name: 'Updated Category',
        description: 'Updated description'
      }).then(function() {
        expect(categoryManagementSystem.events.emit).toHaveBeenCalledWith(
          'category:updated',
          expect.objectContaining({
            category: expect.any(Object)
          })
        );
      });
    });
    
    test('should emit events when category is deleted', function() {
      return categoryManagementSystem.deleteCategory('cat2').then(function() {
        expect(categoryManagementSystem.events.emit).toHaveBeenCalledWith(
          'category:deleted',
          expect.objectContaining({
            categoryId: 'cat2'
          })
        );
      });
    });
  });
  
  describe('shutdown', function() {
    beforeEach(function() {
      return categoryManagementSystem.initialize();
    });
    
    test('should shutdown successfully', function() {
      return expect(categoryManagementSystem.shutdown()).resolves.toBe(true);
    });
    
    test('should set initialized to false after shutdown', function() {
      return categoryManagementSystem.shutdown().then(function() {
        expect(categoryManagementSystem.initialized).toBe(false);
      });
    });
  });
});
