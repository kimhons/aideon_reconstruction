/**
 * @fileoverview Mock File System Tentacle for testing.
 * Provides mock implementations of file system functionality.
 * 
 * @module test/mocks/FileSystemTentacle
 */

/**
 * Mock File System Tentacle
 */
class MockFileSystemTentacle {
  /**
   * Create a new Mock File System Tentacle
   */
  constructor() {
    this.files = new Map();
    this.directories = new Set(['/home/user', '/home/user/documents', '/home/user/downloads']);
    this.operations = [];
  }
  
  /**
   * Read file
   * @param {string} path - File path
   * @param {Object} options - Read options
   * @returns {Promise<Object>} File content
   */
  async readFile(path, options = {}) {
    this._recordOperation('readFile', { path, options });
    
    if (!this.files.has(path)) {
      if (options.createIfNotExists) {
        await this.writeFile(path, '', { overwrite: true });
      } else {
        throw new Error(`File not found: ${path}`);
      }
    }
    
    const file = this.files.get(path);
    return {
      content: file.content,
      metadata: { ...file.metadata }
    };
  }
  
  /**
   * Write file
   * @param {string} path - File path
   * @param {string} content - File content
   * @param {Object} options - Write options
   * @returns {Promise<Object>} Result
   */
  async writeFile(path, content, options = {}) {
    this._recordOperation('writeFile', { path, contentLength: content.length, options });
    
    const exists = this.files.has(path);
    if (exists && !options.overwrite) {
      throw new Error(`File already exists: ${path}`);
    }
    
    // Ensure directory exists
    const directory = path.substring(0, path.lastIndexOf('/'));
    if (!this.directories.has(directory)) {
      await this.createDirectory(directory);
    }
    
    const file = {
      content,
      metadata: {
        path,
        size: content.length,
        created: exists ? this.files.get(path).metadata.created : new Date(),
        modified: new Date(),
        accessed: new Date()
      }
    };
    
    this.files.set(path, file);
    
    return {
      success: true,
      path,
      size: content.length
    };
  }
  
  /**
   * Delete file
   * @param {string} path - File path
   * @returns {Promise<Object>} Result
   */
  async deleteFile(path) {
    this._recordOperation('deleteFile', { path });
    
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    this.files.delete(path);
    
    return {
      success: true,
      path
    };
  }
  
  /**
   * Create directory
   * @param {string} path - Directory path
   * @returns {Promise<Object>} Result
   */
  async createDirectory(path) {
    this._recordOperation('createDirectory', { path });
    
    this.directories.add(path);
    
    return {
      success: true,
      path
    };
  }
  
  /**
   * List directory
   * @param {string} path - Directory path
   * @returns {Promise<Object>} Directory contents
   */
  async listDirectory(path) {
    this._recordOperation('listDirectory', { path });
    
    if (!this.directories.has(path)) {
      throw new Error(`Directory not found: ${path}`);
    }
    
    const files = [];
    const directories = [];
    
    // Find files in this directory
    for (const [filePath, file] of this.files.entries()) {
      const directory = filePath.substring(0, filePath.lastIndexOf('/'));
      if (directory === path) {
        files.push({
          name: filePath.substring(filePath.lastIndexOf('/') + 1),
          path: filePath,
          size: file.metadata.size,
          modified: file.metadata.modified
        });
      }
    }
    
    // Find subdirectories
    for (const dir of this.directories) {
      const parentDir = dir.substring(0, dir.lastIndexOf('/'));
      if (parentDir === path) {
        directories.push({
          name: dir.substring(dir.lastIndexOf('/') + 1),
          path: dir
        });
      }
    }
    
    return {
      path,
      files,
      directories
    };
  }
  
  /**
   * Move file
   * @param {string} sourcePath - Source path
   * @param {string} destinationPath - Destination path
   * @returns {Promise<Object>} Result
   */
  async moveFile(sourcePath, destinationPath) {
    this._recordOperation('moveFile', { sourcePath, destinationPath });
    
    if (!this.files.has(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    
    const file = this.files.get(sourcePath);
    await this.writeFile(destinationPath, file.content, { overwrite: true });
    await this.deleteFile(sourcePath);
    
    return {
      success: true,
      sourcePath,
      destinationPath
    };
  }
  
  /**
   * Copy file
   * @param {string} sourcePath - Source path
   * @param {string} destinationPath - Destination path
   * @returns {Promise<Object>} Result
   */
  async copyFile(sourcePath, destinationPath) {
    this._recordOperation('copyFile', { sourcePath, destinationPath });
    
    if (!this.files.has(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    
    const file = this.files.get(sourcePath);
    await this.writeFile(destinationPath, file.content, { overwrite: true });
    
    return {
      success: true,
      sourcePath,
      destinationPath
    };
  }
  
  /**
   * Get file metadata
   * @param {string} path - File path
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(path) {
    this._recordOperation('getFileMetadata', { path });
    
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    
    const file = this.files.get(path);
    return { ...file.metadata };
  }
  
  /**
   * Record operation
   * @param {string} type - Operation type
   * @param {Object} details - Operation details
   * @private
   */
  _recordOperation(type, details) {
    this.operations.push({
      type,
      details,
      timestamp: new Date()
    });
  }
  
  /**
   * Get status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    return {
      fileCount: this.files.size,
      directoryCount: this.directories.size,
      operationCount: this.operations.length,
      status: 'operational'
    };
  }
}

module.exports = MockFileSystemTentacle;
