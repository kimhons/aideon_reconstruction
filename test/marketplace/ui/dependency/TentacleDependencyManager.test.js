/**
 * @fileoverview Tests for the TentacleDependencyManager component
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

// Import dependencies
var TentacleDependencyManager = require('../../../../src/marketplace/ui/dependency/TentacleDependencyManager').TentacleDependencyManager;

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
  getInstalledTentacles: jest.fn(),
  getTentacleDependencies: jest.fn(),
  getTentacleReverseDependencies: jest.fn(),
  installTentacle: jest.fn(),
  updateTentacle: jest.fn(),
  getCurrentUser: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  }
};

// Test data
var mockInstalledTentacles = [
  {
    id: 'tentacle1',
    name: 'Tentacle 1',
    description: 'Description for Tentacle 1',
    version: '1.0.0'
  },
  {
    id: 'tentacle2',
    name: 'Tentacle 2',
    description: 'Description for Tentacle 2',
    version: '2.0.0'
  },
  {
    id: 'dependency1',
    name: 'Dependency 1',
    description: 'Description for Dependency 1',
    version: '1.0.0'
  }
];

var mockDependencies = {
  direct: [
    {
      id: 'dependency1',
      name: 'Dependency 1',
      description: 'Description for Dependency 1',
      versionConstraint: '>=1.0.0'
    },
    {
      id: 'dependency2',
      name: 'Dependency 2',
      description: 'Description for Dependency 2',
      versionConstraint: '>=2.0.0'
    }
  ],
  transitive: [
    {
      id: 'dependency3',
      name: 'Dependency 3',
      description: 'Description for Dependency 3',
      versionConstraint: '>=1.0.0',
      requiredBy: ['dependency1']
    }
  ],
  all: {
    'dependency1': {
      id: 'dependency1',
      name: 'Dependency 1',
      description: 'Description for Dependency 1',
      level: 1,
      dependsOn: ['dependency3']
    },
    'dependency2': {
      id: 'dependency2',
      name: 'Dependency 2',
      description: 'Description for Dependency 2',
      level: 1,
      dependsOn: []
    },
    'dependency3': {
      id: 'dependency3',
      name: 'Dependency 3',
      description: 'Description for Dependency 3',
      level: 2,
      dependsOn: []
    }
  },
  circular: []
};

var mockReverseDependencies = [
  {
    id: 'tentacle3',
    name: 'Tentacle 3',
    description: 'Description for Tentacle 3',
    versionConstraint: '>=1.0.0'
  }
];

var mockDependencyStatus = {
  satisfied: false,
  missingDependencies: [
    {
      id: 'dependency2',
      name: 'Dependency 2',
      description: 'Description for Dependency 2',
      versionConstraint: '>=2.0.0'
    }
  ],
  versionMismatches: []
};

var mockInstallationResult = {
  success: true,
  installed: [
    {
      id: 'dependency2',
      name: 'Dependency 2',
      description: 'Description for Dependency 2',
      versionConstraint: '>=2.0.0'
    }
  ],
  failed: []
};

describe('TentacleDependencyManager', function() {
  var tentacleDependencyManager;
  var mockContainer;
  
  beforeEach(function() {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock container
    mockContainer = {
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue({
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        disabled: false
      }),
      querySelectorAll: jest.fn().mockReturnValue([])
    };
    
    // Mock marketplace core responses
    mockMarketplaceCore.getInstalledTentacles.mockResolvedValue(mockInstalledTentacles);
    mockMarketplaceCore.getTentacleDependencies.mockResolvedValue(mockDependencies);
    mockMarketplaceCore.getTentacleReverseDependencies.mockResolvedValue(mockReverseDependencies);
    mockMarketplaceCore.installTentacle.mockResolvedValue(true);
    mockMarketplaceCore.updateTentacle.mockResolvedValue(true);
    mockMarketplaceCore.getCurrentUser.mockResolvedValue({ id: 'user1', name: 'User 1' });
    
    // Create instance
    tentacleDependencyManager = new TentacleDependencyManager({
      container: mockContainer,
      marketplaceCore: mockMarketplaceCore,
      config: {
        autoInstallDependencies: false,
        showDependencyWarnings: true,
        enableVersionConstraints: true,
        checkForConflicts: true,
        maxDependencyDepth: 5
      }
    });
  });
  
  describe('initialization', function() {
    test('should initialize successfully', function() {
      return expect(tentacleDependencyManager.initialize()).resolves.toBe(true);
    });
    
    test('should load installed tentacles during initialization', function() {
      return tentacleDependencyManager.initialize().then(function() {
        expect(mockMarketplaceCore.getInstalledTentacles).toHaveBeenCalled();
        expect(tentacleDependencyManager.state.installedTentacles).toHaveProperty('tentacle1');
        expect(tentacleDependencyManager.state.installedTentacles).toHaveProperty('tentacle2');
        expect(tentacleDependencyManager.state.installedTentacles).toHaveProperty('dependency1');
      });
    });
    
    test('should set up event listeners during initialization', function() {
      return tentacleDependencyManager.initialize().then(function() {
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('tentacle:selected', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('tentacle:installed', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('tentacle:uninstalled', expect.any(Function));
        expect(mockMarketplaceCore.events.on).toHaveBeenCalledWith('tentacle:updated', expect.any(Function));
      });
    });
    
    test('should fail initialization if marketplaceCore is missing', function() {
      tentacleDependencyManager = new TentacleDependencyManager({
        container: mockContainer
      });
      
      return expect(tentacleDependencyManager.initialize()).rejects.toThrow();
    });
  });
  
  describe('dependency operations', function() {
    beforeEach(function() {
      return tentacleDependencyManager.initialize();
    });
    
    test('should load dependencies for a tentacle', function() {
      return tentacleDependencyManager.loadDependencies('tentacle1').then(function(dependencies) {
        expect(mockMarketplaceCore.getTentacleDependencies).toHaveBeenCalledWith('tentacle1', expect.any(Object));
        expect(dependencies).toEqual(mockDependencies);
        expect(tentacleDependencyManager.state.dependencies['tentacle1']).toEqual(mockDependencies);
        expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
          'dependencies:loaded',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            dependencies: mockDependencies
          })
        );
      });
    });
    
    test('should load reverse dependencies for a tentacle', function() {
      return tentacleDependencyManager.loadReverseDependencies('tentacle1').then(function(reverseDependencies) {
        expect(mockMarketplaceCore.getTentacleReverseDependencies).toHaveBeenCalledWith('tentacle1');
        expect(reverseDependencies).toEqual(mockReverseDependencies);
        expect(tentacleDependencyManager.state.reverseDependencies['tentacle1']).toEqual(mockReverseDependencies);
        expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
          'reverse-dependencies:loaded',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            reverseDependencies: mockReverseDependencies
          })
        );
      });
    });
    
    test('should check if dependencies are satisfied', function() {
      // Mock checkDependenciesSatisfied implementation
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      tentacleDependencyManager._satisfiesVersionConstraint = jest.fn().mockReturnValue(false);
      
      return tentacleDependencyManager.checkDependenciesSatisfied('tentacle1').then(function(status) {
        expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
          'dependencies:checked',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            result: expect.any(Object)
          })
        );
        expect(status.satisfied).toBe(false);
        expect(status.missingDependencies.length).toBeGreaterThan(0);
      });
    });
    
    test('should install missing dependencies', function() {
      // Mock dependencies
      tentacleDependencyManager.checkDependenciesSatisfied = jest.fn().mockResolvedValue(mockDependencyStatus);
      tentacleDependencyManager._installDependency = jest.fn().mockResolvedValue({
        success: true,
        dependency: mockDependencyStatus.missingDependencies[0]
      });
      tentacleDependencyManager.loadInstalledTentacles = jest.fn().mockResolvedValue(mockInstalledTentacles);
      
      return tentacleDependencyManager.installMissingDependencies('tentacle1').then(function(result) {
        expect(tentacleDependencyManager.checkDependenciesSatisfied).toHaveBeenCalledWith('tentacle1');
        expect(tentacleDependencyManager._installDependency).toHaveBeenCalledWith(
          mockDependencyStatus.missingDependencies[0]
        );
        expect(tentacleDependencyManager.loadInstalledTentacles).toHaveBeenCalled();
        expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
          'dependencies:installed',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            result: expect.any(Object)
          })
        );
        expect(result.success).toBe(true);
        expect(result.installed.length).toBeGreaterThan(0);
      });
    });
    
    test('should build dependency graph', function() {
      // Load dependencies first
      return tentacleDependencyManager.loadDependencies('tentacle1').then(function() {
        var graph = tentacleDependencyManager.getDependencyGraph('tentacle1');
        
        expect(graph).toBeDefined();
        expect(graph.rootId).toBe('tentacle1');
        expect(graph.nodes).toBeDefined();
        expect(graph.edges).toBeDefined();
        expect(Object.keys(graph.nodes).length).toBeGreaterThan(0);
      });
    });
    
    test('should check if a tentacle can be safely uninstalled', function() {
      return tentacleDependencyManager.checkCanUninstall('tentacle1').then(function(result) {
        expect(mockMarketplaceCore.getTentacleReverseDependencies).toHaveBeenCalledWith('tentacle1');
        expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
          'can-uninstall:checked',
          expect.objectContaining({
            tentacleId: 'tentacle1',
            result: expect.any(Object)
          })
        );
        expect(result.canUninstall).toBe(false);
        expect(result.dependentTentacles).toEqual(mockReverseDependencies);
      });
    });
  });
  
  describe('version constraint checking', function() {
    beforeEach(function() {
      return tentacleDependencyManager.initialize();
    });
    
    test('should correctly check exact version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.0', '1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.1', '1.0.0')).toBe(false);
    });
    
    test('should correctly check greater than version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('2.0.0', '>1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.0', '>1.0.0')).toBe(false);
    });
    
    test('should correctly check greater than or equal version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('2.0.0', '>=1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.0', '>=1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('0.9.0', '>=1.0.0')).toBe(false);
    });
    
    test('should correctly check less than version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('0.9.0', '<1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.0', '<1.0.0')).toBe(false);
    });
    
    test('should correctly check less than or equal version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('0.9.0', '<=1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.0', '<=1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.1.0', '<=1.0.0')).toBe(false);
    });
    
    test('should correctly check tilde version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.0.1', '~1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.1.0', '~1.0.0')).toBe(false);
    });
    
    test('should correctly check caret version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.1.0', '^1.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('2.0.0', '^1.0.0')).toBe(false);
    });
    
    test('should correctly check range version constraint', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.5.0', '1.0.0 - 2.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('2.5.0', '1.0.0 - 2.0.0')).toBe(false);
    });
    
    test('should correctly check multiple version constraints', function() {
      expect(tentacleDependencyManager._satisfiesVersionConstraint('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(tentacleDependencyManager._satisfiesVersionConstraint('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
    });
  });
  
  describe('event handling', function() {
    beforeEach(function() {
      return tentacleDependencyManager.initialize();
    });
    
    test('should handle tentacle selected event', function() {
      // Get the tentacle selected handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'tentacle:selected') {
          handler = call[1];
        }
      });
      
      // Mock loadDependencies and loadReverseDependencies
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      tentacleDependencyManager.loadReverseDependencies = jest.fn().mockResolvedValue(mockReverseDependencies);
      
      // Call the handler
      handler({ tentacleId: 'tentacle1' });
      
      // Verify that dependencies and reverse dependencies are loaded
      expect(tentacleDependencyManager.loadDependencies).toHaveBeenCalledWith('tentacle1');
      expect(tentacleDependencyManager.loadReverseDependencies).toHaveBeenCalledWith('tentacle1');
      expect(tentacleDependencyManager.state.selectedTentacle).toBe('tentacle1');
    });
    
    test('should handle tentacle installed event', function() {
      // Get the tentacle installed handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'tentacle:installed') {
          handler = call[1];
        }
      });
      
      // Mock loadInstalledTentacles and loadDependencies
      tentacleDependencyManager.loadInstalledTentacles = jest.fn().mockResolvedValue(mockInstalledTentacles);
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'dependency2' });
      
      // Verify that installed tentacles are reloaded
      expect(tentacleDependencyManager.loadInstalledTentacles).toHaveBeenCalled();
    });
    
    test('should handle tentacle uninstalled event', function() {
      // Get the tentacle uninstalled handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'tentacle:uninstalled') {
          handler = call[1];
        }
      });
      
      // Mock loadInstalledTentacles and loadDependencies
      tentacleDependencyManager.loadInstalledTentacles = jest.fn().mockResolvedValue(mockInstalledTentacles);
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'dependency1' });
      
      // Verify that installed tentacles are reloaded
      expect(tentacleDependencyManager.loadInstalledTentacles).toHaveBeenCalled();
    });
    
    test('should handle tentacle updated event', function() {
      // Get the tentacle updated handler
      var handler;
      mockMarketplaceCore.events.on.mock.calls.forEach(function(call) {
        if (call[0] === 'tentacle:updated') {
          handler = call[1];
        }
      });
      
      // Mock loadInstalledTentacles and loadDependencies
      tentacleDependencyManager.loadInstalledTentacles = jest.fn().mockResolvedValue(mockInstalledTentacles);
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      handler({ tentacleId: 'dependency1' });
      
      // Verify that installed tentacles are reloaded
      expect(tentacleDependencyManager.loadInstalledTentacles).toHaveBeenCalled();
    });
  });
  
  describe('UI interactions', function() {
    beforeEach(function() {
      return tentacleDependencyManager.initialize();
    });
    
    test('should handle install button click', function() {
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Mock installMissingDependencies
      tentacleDependencyManager.installMissingDependencies = jest.fn().mockResolvedValue(mockInstallationResult);
      tentacleDependencyManager._showNotification = jest.fn();
      
      // Call the handler
      tentacleDependencyManager._handleInstallButtonClick();
      
      // Verify that missing dependencies are installed
      expect(tentacleDependencyManager.installMissingDependencies).toHaveBeenCalledWith('tentacle1');
    });
    
    test('should handle view graph button click', function() {
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Mock getDependencyGraph
      var mockGraph = { rootId: 'tentacle1', nodes: {}, edges: [] };
      tentacleDependencyManager.getDependencyGraph = jest.fn().mockReturnValue(mockGraph);
      
      // Call the handler
      tentacleDependencyManager._handleViewGraphButtonClick();
      
      // Verify that view graph event is emitted
      expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
        'dependency-graph:view-requested',
        expect.objectContaining({
          tentacleId: 'tentacle1',
          graph: mockGraph
        })
      );
    });
    
    test('should handle dependency install button click', function() {
      // Mock _installDependency, loadInstalledTentacles, and loadDependencies
      tentacleDependencyManager._installDependency = jest.fn().mockResolvedValue({
        success: true,
        dependency: { id: 'dependency2' }
      });
      tentacleDependencyManager.loadInstalledTentacles = jest.fn().mockResolvedValue(mockInstalledTentacles);
      tentacleDependencyManager.loadDependencies = jest.fn().mockResolvedValue(mockDependencies);
      tentacleDependencyManager._showNotification = jest.fn();
      
      // Set selected tentacle
      tentacleDependencyManager.state.selectedTentacle = 'tentacle1';
      
      // Call the handler
      tentacleDependencyManager._handleDependencyInstallButtonClick('dependency2');
      
      // Verify that dependency is installed
      expect(tentacleDependencyManager._installDependency).toHaveBeenCalledWith({
        id: 'dependency2'
      });
    });
    
    test('should handle dependency view button click', function() {
      // Call the handler
      tentacleDependencyManager._handleDependencyViewButtonClick('dependency1');
      
      // Verify that view event is emitted
      expect(tentacleDependencyManager.events.emit).toHaveBeenCalledWith(
        'tentacle:view-requested',
        expect.objectContaining({
          tentacleId: 'dependency1'
        })
      );
    });
  });
  
  describe('shutdown', function() {
    beforeEach(function() {
      return tentacleDependencyManager.initialize();
    });
    
    test('should shutdown successfully', function() {
      return expect(tentacleDependencyManager.shutdown()).resolves.toBe(true);
    });
    
    test('should set initialized to false after shutdown', function() {
      return tentacleDependencyManager.shutdown().then(function() {
        expect(tentacleDependencyManager.initialized).toBe(false);
      });
    });
  });
});
