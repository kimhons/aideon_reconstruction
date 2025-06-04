/**
 * @fileoverview Mock Memory Tentacle for testing.
 * Provides mock implementations of memory functionality.
 * 
 * @module test/mocks/MemoryTentacle
 */

/**
 * Mock Memory Tentacle
 */
class MockMemoryTentacle {
  /**
   * Create a new Mock Memory Tentacle
   */
  constructor() {
    this.memories = new Map();
    this.nextId = 1;
  }
  
  /**
   * Store memory
   * @param {Object} data - Memory data
   * @returns {Promise<Object>} Stored memory
   */
  async storeMemory(data) {
    const id = `memory_${this.nextId++}`;
    const memory = {
      id,
      ...data,
      timestamp: data.timestamp || new Date(),
      lastAccessed: new Date()
    };
    
    this.memories.set(id, memory);
    return memory;
  }
  
  /**
   * Retrieve memory
   * @param {string} id - Memory ID
   * @returns {Promise<Object>} Retrieved memory
   */
  async retrieveMemory(id) {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new Error(`Memory not found: ${id}`);
    }
    
    memory.lastAccessed = new Date();
    return memory;
  }
  
  /**
   * Search memories
   * @param {Object} query - Search query
   * @returns {Promise<Array<Object>>} Matching memories
   */
  async searchMemories(query) {
    const results = [];
    
    for (const memory of this.memories.values()) {
      let match = true;
      
      if (query.type && memory.type !== query.type) {
        match = false;
      }
      
      if (query.tags && Array.isArray(query.tags)) {
        if (!memory.tags || !Array.isArray(memory.tags)) {
          match = false;
        } else {
          const hasAllTags = query.tags.every(tag => memory.tags.includes(tag));
          if (!hasAllTags) {
            match = false;
          }
        }
      }
      
      if (query.text && memory.content) {
        const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
        if (!content.includes(query.text)) {
          match = false;
        }
      }
      
      if (match) {
        results.push({ ...memory, lastAccessed: new Date() });
      }
    }
    
    return results;
  }
  
  /**
   * Update memory
   * @param {string} id - Memory ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated memory
   */
  async updateMemory(id, data) {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new Error(`Memory not found: ${id}`);
    }
    
    const updatedMemory = {
      ...memory,
      ...data,
      lastModified: new Date(),
      lastAccessed: new Date()
    };
    
    this.memories.set(id, updatedMemory);
    return updatedMemory;
  }
  
  /**
   * Delete memory
   * @param {string} id - Memory ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteMemory(id) {
    const exists = this.memories.has(id);
    if (!exists) {
      throw new Error(`Memory not found: ${id}`);
    }
    
    this.memories.delete(id);
    return true;
  }
  
  /**
   * Get status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    return {
      memoryCount: this.memories.size,
      status: 'operational'
    };
  }
}

module.exports = MockMemoryTentacle;
