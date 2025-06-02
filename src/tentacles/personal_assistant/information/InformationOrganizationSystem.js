/**
 * @fileoverview Information Organization System for the Personal Assistant Tentacle.
 * Manages notes, documents, knowledge integration, and search capabilities.
 * 
 * @module src/tentacles/personal_assistant/information/InformationOrganizationSystem
 */

const EventEmitter = require("events");

/**
 * Information Organization System
 * @extends EventEmitter
 */
class InformationOrganizationSystem extends EventEmitter {
  /**
   * Create a new Information Organization System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.securityFramework - Security and Governance Framework
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager
   * @param {Object} dependencies.fileSystemTentacle - File System Tentacle for document access
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      defaultNoteFormat: "markdown",
      maxSearchResults: 50,
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Data structures (can be backed by Memory Tentacle)
    this.notes = new Map();
    this.documents = new Map(); // Stores metadata about managed documents
    this.tags = new Map();
    this.categories = new Map();
    this.knowledgeLinks = new Map(); // Links between information items
    
    this.logger.info("[InformationOrganizationSystem] Information Organization System initialized");
    
    // Initialize model integrations
    this.models = {};
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegrations();
    }
  }
  
  /**
   * Initialize model integrations for information organization tasks
   * @private
   */
  async _initializeModelIntegrations() {
    const modelTypes = [
      "information_summarization",
      "information_tagging",
      "semantic_search",
      "relationship_discovery"
    ];
    
    for (const type of modelTypes) {
      try {
        this.models[type] = await this.dependencies.modelIntegrationManager.getModelIntegration(type);
        this.logger.info(`[InformationOrganizationSystem] Model integration initialized for ${type}`);
      } catch (error) {
        this.logger.warn(`[InformationOrganizationSystem] Failed to initialize model integration for ${type}`, { error: error.message });
      }
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      noteCount: this.notes.size,
      documentCount: this.documents.size,
      tagCount: this.tags.size,
      categoryCount: this.categories.size,
      modelIntegrations: Object.keys(this.models)
    };
  }
  
  // --- Note Management ---
  
  /**
   * Create a new note
   * @param {Object} noteData - Note details
   * @param {string} noteData.title - Note title
   * @param {string} noteData.content - Note content
   * @param {string} [noteData.format] - Content format (e.g., "markdown", "plaintext")
   * @param {Array<string>} [noteData.tags] - Tags associated with the note
   * @param {string} [noteData.category] - Category ID
   * @returns {Promise<Object>} Created note
   */
  async createNote(noteData) {
    this.logger.debug("[InformationOrganizationSystem] Creating note", { title: noteData.title });
    
    const noteId = `note_${Date.now()}_${this._generateRandomId()}`;
    const format = noteData.format || this.options.defaultNoteFormat;
    
    const note = {
      id: noteId,
      type: "note",
      title: noteData.title || "Untitled Note",
      content: noteData.content || "",
      format: format,
      tags: noteData.tags || [],
      category: noteData.category || null,
      created: new Date(),
      updated: new Date(),
      linkedDocuments: [], // IDs of linked documents
      relatedNotes: [] // IDs of related notes
    };
    
    // Apply privacy controls
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: "note",
        entityId: noteId,
        privacyLevel: noteData.privacy || "private" // Default to private
      });
    }
    
    // Store note
    this.notes.set(noteId, note);
    
    // Update tags and categories
    await this._updateTags(note.tags);
    if (note.category) {
      await this._updateCategory(note.category);
    }
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "note", id: noteId, data: note });
    }
    
    // Perform AI-based processing asynchronously
    this._processNoteWithAI(noteId);
    
    this.logger.info("[InformationOrganizationSystem] Note created successfully", { noteId });
    return note;
  }
  
  /**
   * Get a note by ID
   * @param {string} noteId - Note ID
   * @returns {Promise<Object>} Note
   * @throws {Error} If note not found
   */
  async getNote(noteId) {
    this.logger.debug("[InformationOrganizationSystem] Getting note", { noteId });
    const note = this.notes.get(noteId);
    if (!note) {
      // Try fetching from memory tentacle if not in local cache
      if (this.dependencies.memoryTentacle) {
        const storedNote = await this.dependencies.memoryTentacle.getEntity({ type: "note", id: noteId });
        if (storedNote) {
          this.notes.set(noteId, storedNote.data); // Cache locally
          return storedNote.data;
        }
      }
      throw new Error(`Note not found: ${noteId}`);
    }
    return note;
  }
  
  /**
   * Update a note
   * @param {string} noteId - Note ID
   * @param {Object} updates - Note updates
   * @returns {Promise<Object>} Updated note
   * @throws {Error} If note not found
   */
  async updateNote(noteId, updates) {
    this.logger.debug("[InformationOrganizationSystem] Updating note", { noteId });
    const note = await this.getNote(noteId); // Ensures note exists
    
    const updatedNote = { ...note };
    let contentChanged = false;
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (!["id", "type", "created"].includes(key)) {
        if (key === "content" && updatedNote[key] !== updates[key]) {
          contentChanged = true;
        }
        updatedNote[key] = updates[key];
      }
    });
    
    updatedNote.updated = new Date();
    
    // Store updated note
    this.notes.set(noteId, updatedNote);
    
    // Update tags and categories if changed
    if (updates.tags) {
      await this._updateTags(updatedNote.tags);
    }
    if (updates.category) {
      await this._updateCategory(updatedNote.category);
    }
    
    // Update in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "note", id: noteId, data: updatedNote });
    }
    
    // Re-process with AI if content changed
    if (contentChanged) {
      this._processNoteWithAI(noteId);
    }
    
    this.logger.info("[InformationOrganizationSystem] Note updated successfully", { noteId });
    return updatedNote;
  }
  
  /**
   * Delete a note
   * @param {string} noteId - Note ID
   * @returns {Promise<boolean>} Success
   * @throws {Error} If note not found
   */
  async deleteNote(noteId) {
    this.logger.debug("[InformationOrganizationSystem] Deleting note", { noteId });
    if (!this.notes.has(noteId)) {
      throw new Error(`Note not found: ${noteId}`);
    }
    
    // Remove note
    this.notes.delete(noteId);
    
    // Remove from memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.deleteEntity({ type: "note", id: noteId });
    }
    
    // Remove related links (optional, depends on desired behavior)
    this._removeKnowledgeLinks(noteId);
    
    this.logger.info("[InformationOrganizationSystem] Note deleted successfully", { noteId });
    return true;
  }
  
  /**
   * Process note with AI models (summarization, tagging, relationship discovery)
   * @param {string} noteId - Note ID
   * @private
   */
  async _processNoteWithAI(noteId) {
    this.logger.debug("[InformationOrganizationSystem] Processing note with AI", { noteId });
    const note = this.notes.get(noteId);
    if (!note) return;

    const updates = {};

    // Auto-tagging
    if (this.models.information_tagging) {
      try {
        const tagResult = await this.models.information_tagging.generateTags({ text: note.content, title: note.title });
        if (tagResult && tagResult.tags && tagResult.tags.length > 0) {
          const newTags = [...new Set([...note.tags, ...tagResult.tags])]; // Merge and deduplicate
          if (newTags.length > note.tags.length) {
             updates.tags = newTags;
             await this._updateTags(newTags);
          }
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] AI tagging failed", { noteId, error: error.message });
      }
    }

    // Relationship Discovery (e.g., find related notes/documents)
    if (this.models.relationship_discovery) {
      try {
        const relationshipResult = await this.models.relationship_discovery.findRelationships({
          itemId: noteId,
          itemType: "note",
          content: note.content,
          // Provide context of other notes/docs if needed by the model
        });
        if (relationshipResult && relationshipResult.relatedItems && relationshipResult.relatedItems.length > 0) {
          // Update knowledge links based on results
          await this._updateKnowledgeLinks(noteId, relationshipResult.relatedItems);
          // Potentially update note.relatedNotes or note.linkedDocuments based on types
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] AI relationship discovery failed", { noteId, error: error.message });
      }
    }
    
    // Update note if AI processing resulted in changes
    if (Object.keys(updates).length > 0) {
       await this.updateNote(noteId, updates);
    }
  }

  // --- Document Management ---
  
  /**
   * Add a document reference to the system
   * @param {Object} docData - Document metadata
   * @param {string} docData.filePath - Path to the document (requires FileSystemTentacle access)
   * @param {string} [docData.title] - Document title (if not inferred)
   * @param {Array<string>} [docData.tags] - Tags
   * @param {string} [docData.category] - Category ID
   * @returns {Promise<Object>} Created document reference
   */
  async addDocumentReference(docData) {
    this.logger.debug("[InformationOrganizationSystem] Adding document reference", { filePath: docData.filePath });
    
    if (!this.dependencies.fileSystemTentacle) {
      throw new Error("FileSystemTentacle dependency is required to manage documents.");
    }
    
    // Verify file existence and get metadata
    let fileMetadata;
    try {
      fileMetadata = await this.dependencies.fileSystemTentacle.getFileMetadata(docData.filePath);
    } catch (error) {
      this.logger.error("[InformationOrganizationSystem] Failed to access document file", { filePath: docData.filePath, error: error.message });
      throw new Error(`Failed to access document file: ${error.message}`);
    }
    
    const docId = `doc_${Date.now()}_${this._generateRandomId()}`;
    
    const documentRef = {
      id: docId,
      type: "document",
      filePath: docData.filePath,
      title: docData.title || fileMetadata.name,
      fileType: fileMetadata.type,
      size: fileMetadata.size,
      tags: docData.tags || [],
      category: docData.category || null,
      created: fileMetadata.created || new Date(),
      updated: fileMetadata.modified || new Date(),
      summary: null, // To be generated by AI
      linkedNotes: [] // IDs of linked notes
    };
    
    // Apply privacy controls
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: "document",
        entityId: docId,
        privacyLevel: docData.privacy || "private"
      });
    }
    
    // Store document reference
    this.documents.set(docId, documentRef);
    
    // Update tags and categories
    await this._updateTags(documentRef.tags);
    if (documentRef.category) {
      await this._updateCategory(documentRef.category);
    }
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "documentRef", id: docId, data: documentRef });
    }
    
    // Perform AI-based processing asynchronously
    this._processDocumentWithAI(docId);
    
    this.logger.info("[InformationOrganizationSystem] Document reference added successfully", { docId });
    return documentRef;
  }
  
  /**
   * Get document reference by ID
   * @param {string} docId - Document ID
   * @returns {Promise<Object>} Document reference
   * @throws {Error} If document reference not found
   */
  async getDocumentReference(docId) {
    this.logger.debug("[InformationOrganizationSystem] Getting document reference", { docId });
    const docRef = this.documents.get(docId);
    if (!docRef) {
       if (this.dependencies.memoryTentacle) {
         const storedDoc = await this.dependencies.memoryTentacle.getEntity({ type: "documentRef", id: docId });
         if (storedDoc) {
           this.documents.set(docId, storedDoc.data);
           return storedDoc.data;
         }
       }
      throw new Error(`Document reference not found: ${docId}`);
    }
    return docRef;
  }
  
  /**
   * Update document reference metadata
   * @param {string} docId - Document ID
   * @param {Object} updates - Metadata updates (cannot change filePath)
   * @returns {Promise<Object>} Updated document reference
   * @throws {Error} If document reference not found
   */
  async updateDocumentReference(docId, updates) {
    this.logger.debug("[InformationOrganizationSystem] Updating document reference", { docId });
    const docRef = await this.getDocumentReference(docId);
    
    const updatedDocRef = { ...docRef };
    
    // Apply updates (excluding filePath, id, type, created)
    Object.keys(updates).forEach(key => {
      if (!["id", "type", "created", "filePath", "fileType", "size"].includes(key)) {
        updatedDocRef[key] = updates[key];
      }
    });
    
    updatedDocRef.updated = new Date(); // Update metadata timestamp
    
    // Store updated reference
    this.documents.set(docId, updatedDocRef);
    
    // Update tags and categories if changed
    if (updates.tags) {
      await this._updateTags(updatedDocRef.tags);
    }
    if (updates.category) {
      await this._updateCategory(updatedDocRef.category);
    }
    
    // Update in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "documentRef", id: docId, data: updatedDocRef });
    }
    
    this.logger.info("[InformationOrganizationSystem] Document reference updated successfully", { docId });
    return updatedDocRef;
  }
  
  /**
   * Remove document reference (does not delete the actual file)
   * @param {string} docId - Document ID
   * @returns {Promise<boolean>} Success
   * @throws {Error} If document reference not found
   */
  async removeDocumentReference(docId) {
    this.logger.debug("[InformationOrganizationSystem] Removing document reference", { docId });
    if (!this.documents.has(docId)) {
      throw new Error(`Document reference not found: ${docId}`);
    }
    
    // Remove reference
    this.documents.delete(docId);
    
    // Remove from memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.deleteEntity({ type: "documentRef", id: docId });
    }
    
    // Remove related links
    this._removeKnowledgeLinks(docId);
    
    this.logger.info("[InformationOrganizationSystem] Document reference removed successfully", { docId });
    return true;
  }
  
  /**
   * Process document with AI models (summarization, tagging, relationship discovery)
   * @param {string} docId - Document ID
   * @private
   */
  async _processDocumentWithAI(docId) {
    this.logger.debug("[InformationOrganizationSystem] Processing document with AI", { docId });
    const docRef = this.documents.get(docId);
    if (!docRef) return;

    let documentContent = null;
    const updates = {};

    // Attempt to get document content (requires FileSystemTentacle capability)
    try {
      if (this.dependencies.fileSystemTentacle && this.dependencies.fileSystemTentacle.readFileContent) {
         // Limit content size for processing if necessary
         documentContent = await this.dependencies.fileSystemTentacle.readFileContent(docRef.filePath, { format: "text", maxLength: 50000 }); 
      }
    } catch (error) {
       this.logger.warn("[InformationOrganizationSystem] Could not read document content for AI processing", { docId, error: error.message });
    }

    // Summarization
    if (documentContent && this.models.information_summarization) {
      try {
        const summaryResult = await this.models.information_summarization.summarize({ text: documentContent });
        if (summaryResult && summaryResult.summary) {
          updates.summary = summaryResult.summary;
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] AI summarization failed for document", { docId, error: error.message });
      }
    }

    // Auto-tagging
    if (documentContent && this.models.information_tagging) {
      try {
        const tagResult = await this.models.information_tagging.generateTags({ text: documentContent, title: docRef.title });
        if (tagResult && tagResult.tags && tagResult.tags.length > 0) {
          const newTags = [...new Set([...docRef.tags, ...tagResult.tags])];
          if (newTags.length > docRef.tags.length) {
             updates.tags = newTags;
             await this._updateTags(newTags);
          }
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] AI tagging failed for document", { docId, error: error.message });
      }
    }

    // Relationship Discovery
    if (documentContent && this.models.relationship_discovery) {
      try {
        const relationshipResult = await this.models.relationship_discovery.findRelationships({
          itemId: docId,
          itemType: "document",
          content: documentContent,
        });
        if (relationshipResult && relationshipResult.relatedItems && relationshipResult.relatedItems.length > 0) {
          await this._updateKnowledgeLinks(docId, relationshipResult.relatedItems);
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] AI relationship discovery failed for document", { docId, error: error.message });
      }
    }
    
    // Update document reference if AI processing resulted in changes
    if (Object.keys(updates).length > 0) {
       await this.updateDocumentReference(docId, updates);
    }
  }

  // --- Tag and Category Management ---

  /** Update tag usage counts */
  async _updateTags(tags) {
    for (const tagName of tags) {
      const tag = this.tags.get(tagName) || { name: tagName, count: 0 };
      tag.count++;
      this.tags.set(tagName, tag);
      // Persist tag updates if needed
    }
  }

  /** Update category usage counts */
  async _updateCategory(categoryName) {
    const category = this.categories.get(categoryName) || { name: categoryName, count: 0 };
    category.count++;
    this.categories.set(categoryName, category);
    // Persist category updates if needed
  }

  // --- Knowledge Linking ---

  /** Update knowledge links based on AI discovery */
  async _updateKnowledgeLinks(sourceId, relatedItems) {
     // Remove existing links originating from sourceId
     this._removeKnowledgeLinks(sourceId);
     
     // Add new links
     for (const item of relatedItems) {
        const targetId = item.id;
        const relationshipType = item.relationship || "related";
        const score = item.score || 0.5;
        
        if (!this.knowledgeLinks.has(sourceId)) {
           this.knowledgeLinks.set(sourceId, new Map());
        }
        this.knowledgeLinks.get(sourceId).set(targetId, { type: relationshipType, score });
        
        // Add reverse link (optional)
        if (!this.knowledgeLinks.has(targetId)) {
           this.knowledgeLinks.set(targetId, new Map());
        }
        this.knowledgeLinks.get(targetId).set(sourceId, { type: relationshipType, score }); 
     }
     // Persist link updates if needed
     this.logger.debug("[InformationOrganizationSystem] Updated knowledge links", { sourceId, count: relatedItems.length });
  }

  /** Remove knowledge links related to an item */
  _removeKnowledgeLinks(itemId) {
     this.knowledgeLinks.delete(itemId);
     for (const links of this.knowledgeLinks.values()) {
        links.delete(itemId);
     }
     // Persist link updates if needed
  }

  // --- Search Functionality ---
  
  /**
   * Search for information items (notes, documents)
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.query - Search query
   * @param {string} [criteria.type] - Filter by type ("note", "document")
   * @param {Array<string>} [criteria.tags] - Filter by tags
   * @param {string} [criteria.category] - Filter by category
   * @param {boolean} [criteria.useSemanticSearch=false] - Use semantic search model if available
   * @returns {Promise<Array<Object>>} Search results
   */
  async search(criteria) {
    this.logger.debug("[InformationOrganizationSystem] Searching information", { criteria });
    
    // Use semantic search if requested and available
    if (criteria.useSemanticSearch && this.models.semantic_search) {
      try {
        const semanticResult = await this.models.semantic_search.search({
          query: criteria.query,
          // Provide context of notes/documents for the model
          corpus: this._getSearchCorpus(), 
          topK: this.options.maxSearchResults,
          filters: { 
             type: criteria.type,
             tags: criteria.tags,
             category: criteria.category
          }
        });
        
        if (semanticResult && semanticResult.results) {
          this.logger.info("[InformationOrganizationSystem] Semantic search successful", { resultCount: semanticResult.results.length });
          // Map model results back to actual note/document objects
          return this._mapSearchResults(semanticResult.results);
        }
      } catch (error) {
        this.logger.warn("[InformationOrganizationSystem] Semantic search failed, falling back to keyword search", { error: error.message });
      }
    }
    
    // Fallback to keyword search
    return this._keywordSearch(criteria);
  }
  
  /**
   * Perform keyword-based search
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array<Object>>} Search results
   * @private
   */
  async _keywordSearch(criteria) {
    const query = criteria.query.toLowerCase();
    let results = [];
    
    // Search notes
    if (!criteria.type || criteria.type === "note") {
      for (const note of this.notes.values()) {
        let score = 0;
        if (note.title.toLowerCase().includes(query)) score += 1.0;
        if (note.content.toLowerCase().includes(query)) score += 0.5;
        if (note.tags.some(tag => tag.toLowerCase().includes(query))) score += 0.8;
        
        if (score > 0) {
          // Apply filters
          if (criteria.tags && !criteria.tags.every(tag => note.tags.includes(tag))) continue;
          if (criteria.category && note.category !== criteria.category) continue;
          
          results.push({ item: note, score });
        }
      }
    }
    
    // Search documents
    if (!criteria.type || criteria.type === "document") {
      for (const docRef of this.documents.values()) {
        let score = 0;
        if (docRef.title.toLowerCase().includes(query)) score += 1.0;
        if (docRef.summary && docRef.summary.toLowerCase().includes(query)) score += 0.7;
        if (docRef.tags.some(tag => tag.toLowerCase().includes(query))) score += 0.8;
        if (docRef.filePath.toLowerCase().includes(query)) score += 0.2;
        
        if (score > 0) {
          // Apply filters
          if (criteria.tags && !criteria.tags.every(tag => docRef.tags.includes(tag))) continue;
          if (criteria.category && docRef.category !== criteria.category) continue;
          
          results.push({ item: docRef, score });
        }
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Limit results
    results = results.slice(0, this.options.maxSearchResults);
    
    this.logger.info("[InformationOrganizationSystem] Keyword search completed", { resultCount: results.length });
    return results.map(r => r.item); // Return only the items
  }

  /** Prepare corpus for semantic search */
  _getSearchCorpus() {
     const corpus = [];
     this.notes.forEach(note => corpus.push({ id: note.id, type: "note", text: `${note.title}\n${note.content}`, tags: note.tags, category: note.category }));
     this.documents.forEach(doc => corpus.push({ id: doc.id, type: "document", text: `${doc.title}\n${doc.summary || ""}`, tags: doc.tags, category: doc.category }));
     return corpus;
  }

  /** Map semantic search results to actual objects */
  _mapSearchResults(results) {
     return results.map(result => {
        if (result.type === "note") {
           return this.notes.get(result.id);
        } else if (result.type === "document") {
           return this.documents.get(result.id);
        }
        return null;
     }).filter(item => item !== null);
  }
  
  /**
   * Generate a random ID
   * @returns {string} Random ID
   * @private
   */
  _generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

module.exports = InformationOrganizationSystem;

