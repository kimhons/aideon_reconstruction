
  /**
   * Add item to working memory
   * @async
   * @param {Object} item - Item to add
   * @param {number} priority - Priority of the item (0-1)
   * @returns {Promise<Object>} Added item
   */
  async addToWorkingMemory(item, priority = 0.5) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    // Ensure item has priority property set
    const itemWithPriority = {
      ...item,
      priority: priority
    };
    
    return this.workingMemory.addItem(itemWithPriority);
  }

  /**
   * Get item from working memory
   * @async
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Retrieved item
   */
  async getFromWorkingMemory(itemId) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    return this.workingMemory.getItem(itemId);
  }

  /**
   * Remove item from working memory
   * @async
   * @param {string} itemId - Item ID
   * @returns {Promise<boolean>} Removal success
   */
  async removeFromWorkingMemory(itemId) {
    if (!this.workingMemory) {
      throw new Error('Working memory manager not initialized');
    }
    
    return this.workingMemory.removeItem(itemId);
  }
