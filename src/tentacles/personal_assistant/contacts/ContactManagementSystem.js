/**
 * @fileoverview Contact Management System for the Personal Assistant Tentacle.
 * Manages contacts, relationships, and integrates with communication systems.
 * 
 * @module src/tentacles/personal_assistant/contacts/ContactManagementSystem
 */

const EventEmitter = require('events');

/**
 * Contact Management System
 * @extends EventEmitter
 */
class ContactManagementSystem extends EventEmitter {
  /**
   * Create a new Contact Management System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.webTentacle - Web Tentacle for social network integration
   * @param {Object} dependencies.securityFramework - Security and Governance Framework for privacy controls
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager for AI capabilities
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      contactSyncFrequency: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      privacyLevel: 'standard',
      ...options
    };
    
    this.dependencies = dependencies;
    
    // Initialize data structures
    this.contacts = new Map();
    this.groups = new Map();
    this.externalSources = new Map();
    this.relationshipGraph = new Map();
    
    this.logger = dependencies.logger || console;
    this.logger.info('[ContactManagementSystem] Contact Management System initialized');
    
    // Initialize model integration if available
    this.modelIntegration = null;
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegration();
    }
  }
  
  /**
   * Initialize model integration for contact intelligence
   * @private
   */
  async _initializeModelIntegration() {
    try {
      this.modelIntegration = await this.dependencies.modelIntegrationManager.getModelIntegration('contact_intelligence');
      this.logger.info('[ContactManagementSystem] Model integration initialized successfully');
    } catch (error) {
      this.logger.warn('[ContactManagementSystem] Failed to initialize model integration', { error: error.message });
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      contactCount: this.contacts.size,
      groupCount: this.groups.size,
      externalSourceCount: this.externalSources.size,
      modelIntegrationAvailable: !!this.modelIntegration
    };
  }
  
  /**
   * Create a new contact
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} Created contact
   */
  async createContact(contactData) {
    this.logger.debug('[ContactManagementSystem] Creating contact', { 
      name: contactData.name ? contactData.name.full : 'Unnamed Contact' 
    });
    
    const contactId = contactData.id || `contact_${Date.now()}_${this._generateRandomId()}`;
    
    const contact = {
      id: contactId,
      name: contactData.name || { full: 'Unnamed Contact' },
      emails: contactData.emails || [],
      phones: contactData.phones || [],
      addresses: contactData.addresses || [],
      organizations: contactData.organizations || [],
      relationships: contactData.relationships || [],
      websites: contactData.websites || [],
      socialProfiles: contactData.socialProfiles || [],
      dates: contactData.dates || [],
      notes: contactData.notes || '',
      tags: contactData.tags || [],
      groups: contactData.groups || [],
      communicationPreferences: contactData.communicationPreferences || {},
      lastContact: contactData.lastContact || null,
      contactFrequency: contactData.contactFrequency || { frequency: 'occasional' },
      source: contactData.source || 'manual',
      externalIds: contactData.externalIds || {},
      created: new Date(),
      updated: new Date(),
      avatar: contactData.avatar || null,
      privacy: contactData.privacy || this.options.privacyLevel
    };
    
    // Store contact
    this.contacts.set(contactId, contact);
    
    // Update relationship graph
    if (contact.relationships && contact.relationships.length > 0) {
      this._updateRelationshipGraph(contact);
    }
    
    // Add to groups
    if (contact.groups && contact.groups.length > 0) {
      for (const groupId of contact.groups) {
        await this._addContactToGroup(contactId, groupId);
      }
    }
    
    // Store in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({
        type: 'contact',
        id: contactId,
        data: contact
      });
    }
    
    // Apply privacy controls
    if (this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: 'contact',
        entityId: contactId,
        privacyLevel: contact.privacy
      });
    }
    
    this.logger.info('[ContactManagementSystem] Contact created successfully', { contactId });
    return contact;
  }
  
  /**
   * Get a contact by ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object>} Contact
   * @throws {Error} If contact not found
   */
  async getContact(contactId) {
    this.logger.debug('[ContactManagementSystem] Getting contact', { contactId });
    
    const contact = this.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    
    return contact;
  }
  
  /**
   * Update a contact
   * @param {string} contactId - Contact ID
   * @param {Object} updates - Contact updates
   * @returns {Promise<Object>} Updated contact
   * @throws {Error} If contact not found
   */
  async updateContact(contactId, updates) {
    this.logger.debug('[ContactManagementSystem] Updating contact', { contactId });
    
    const contact = this.contacts.get(contactId);
    if (!contact) {
      this.logger.error('[ContactManagementSystem] Failed to update contact', { 
        contactId, 
        error: `Contact not found: ${contactId}` 
      });
      throw new Error(`Contact not found: ${contactId}`);
    }
    
    const updatedContact = { ...contact };
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'created') {
        updatedContact[key] = updates[key];
      }
    });
    
    // Update timestamp
    updatedContact.updated = new Date();
    
    // Store updated contact
    this.contacts.set(contactId, updatedContact);
    
    // Update relationship graph if relationships changed
    if (updates.relationships) {
      this._updateRelationshipGraph(updatedContact);
    }
    
    // Update groups if changed
    if (updates.groups) {
      // Remove from old groups
      for (const groupId of contact.groups || []) {
        if (!updates.groups.includes(groupId)) {
          await this._removeContactFromGroup(contactId, groupId);
        }
      }
      
      // Add to new groups
      for (const groupId of updates.groups) {
        if (!contact.groups || !contact.groups.includes(groupId)) {
          await this._addContactToGroup(contactId, groupId);
        }
      }
    }
    
    // Update in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({
        type: 'contact',
        id: contactId,
        data: updatedContact
      });
    }
    
    // Update privacy controls if changed
    if (updates.privacy && this.dependencies.securityFramework) {
      await this.dependencies.securityFramework.applyPrivacyControls({
        entityType: 'contact',
        entityId: contactId,
        privacyLevel: updatedContact.privacy
      });
    }
    
    // Sync with external sources if applicable
    if (updatedContact.externalIds && Object.keys(updatedContact.externalIds).length > 0) {
      await this._syncContactToExternalSources(updatedContact);
    }
    
    this.logger.info('[ContactManagementSystem] Contact updated successfully', { contactId });
    return updatedContact;
  }
  
  /**
   * Delete a contact
   * @param {string} contactId - Contact ID
   * @returns {Promise<boolean>} Success
   * @throws {Error} If contact not found
   */
  async deleteContact(contactId) {
    this.logger.debug('[ContactManagementSystem] Deleting contact', { contactId });
    
    const contact = this.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    
    // Remove from groups
    if (contact.groups && contact.groups.length > 0) {
      for (const groupId of contact.groups) {
        await this._removeContactFromGroup(contactId, groupId);
      }
    }
    
    // Remove from relationship graph
    this._removeFromRelationshipGraph(contactId);
    
    // Remove contact
    this.contacts.delete(contactId);
    
    // Remove from memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.deleteEntity({
        type: 'contact',
        id: contactId
      });
    }
    
    this.logger.info('[ContactManagementSystem] Contact deleted successfully', { contactId });
    return true;
  }
  
  /**
   * Search contacts
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array<Object>>} Matching contacts
   */
  async searchContacts(criteria = {}) {
    this.logger.debug('[ContactManagementSystem] Searching contacts', { criteria });
    
    let results = Array.from(this.contacts.values());
    
    // Filter by query
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      results = results.filter(contact => {
        // Search in name
        if (contact.name && contact.name.full && 
            contact.name.full.toLowerCase().includes(query)) {
          return true;
        }
        
        // Search in emails
        if (contact.emails && contact.emails.some(email => 
            email.address.toLowerCase().includes(query))) {
          return true;
        }
        
        // Search in phones
        if (contact.phones && contact.phones.some(phone => 
            phone.number.includes(query))) {
          return true;
        }
        
        // Search in organizations
        if (contact.organizations && contact.organizations.some(org => 
            org.name.toLowerCase().includes(query))) {
          return true;
        }
        
        // Search in notes
        if (contact.notes && contact.notes.toLowerCase().includes(query)) {
          return true;
        }
        
        return false;
      });
    }
    
    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(contact => 
        criteria.tags.every(tag => contact.tags.includes(tag))
      );
    }
    
    // Filter by groups
    if (criteria.groups && criteria.groups.length > 0) {
      results = results.filter(contact => 
        criteria.groups.some(groupId => contact.groups.includes(groupId))
      );
    }
    
    // Filter by source
    if (criteria.source) {
      results = results.filter(contact => contact.source === criteria.source);
    }
    
    // Apply pagination
    if (criteria.offset || criteria.limit) {
      const offset = criteria.offset || 0;
      const limit = criteria.limit || results.length;
      results = results.slice(offset, offset + limit);
    }
    
    this.logger.info('[ContactManagementSystem] Contact search completed', { resultCount: results.length });
    return results;
  }
  
  /**
   * Create a contact group
   * @param {Object} groupData - Group data
   * @returns {Promise<Object>} Created group
   */
  async createGroup(groupData) {
    const groupId = groupData.id || `group_${Date.now()}_${this._generateRandomId()}`;
    
    const group = {
      id: groupId,
      name: groupData.name || 'Untitled Group',
      description: groupData.description || '',
      color: groupData.color || '#3498db',
      contactIds: [],
      created: new Date(),
      updated: new Date()
    };
    
    // Store group
    this.groups.set(groupId, group);
    
    // Store in memory tentacle if available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({
        type: 'contactGroup',
        id: groupId,
        data: group
      });
    }
    
    this.logger.info('[ContactManagementSystem] Group created successfully', { groupId });
    return group;
  }
  
  /**
   * Add contact to group
   * @param {string} contactId - Contact ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _addContactToGroup(contactId, groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      // Create group if it doesn't exist
      await this.createGroup({ id: groupId, name: groupId });
      return this._addContactToGroup(contactId, groupId);
    }
    
    // Check if contact is already in group
    if (!group.contactIds.includes(contactId)) {
      group.contactIds.push(contactId);
      group.updated = new Date();
      
      // Update in memory tentacle if available
      if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.updateEntity({
          type: 'contactGroup',
          id: groupId,
          data: group
        });
      }
    }
    
    return true;
  }
  
  /**
   * Remove contact from group
   * @param {string} contactId - Contact ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _removeContactFromGroup(contactId, groupId) {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }
    
    // Remove contact from group
    const index = group.contactIds.indexOf(contactId);
    if (index !== -1) {
      group.contactIds.splice(index, 1);
      group.updated = new Date();
      
      // Update in memory tentacle if available
      if (this.dependencies.memoryTentacle) {
        await this.dependencies.memoryTentacle.updateEntity({
          type: 'contactGroup',
          id: groupId,
          data: group
        });
      }
    }
    
    return true;
  }
  
  /**
   * Get contacts in group
   * @param {string} groupId - Group ID
   * @returns {Promise<Array<Object>>} Contacts in group
   * @throws {Error} If group not found
   */
  async getContactsInGroup(groupId) {
    this.logger.debug('[ContactManagementSystem] Getting contacts in group', { groupId });
    
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Contact group not found: ${groupId}`);
    }
    
    const contacts = [];
    for (const contactId of group.contactIds) {
      const contact = this.contacts.get(contactId);
      if (contact) {
        contacts.push(contact);
      }
    }
    
    this.logger.info('[ContactManagementSystem] Retrieved contacts in group', { 
      groupId, 
      contactCount: contacts.length 
    });
    return contacts;
  }
  
  /**
   * Connect to external contact source
   * @param {Object} connectionData - Connection data
   * @returns {Promise<Object>} Connection status
   */
  async connectExternalSource(connectionData) {
    this.logger.debug('[ContactManagementSystem] Connecting to external source', { 
      service: connectionData.service 
    });
    
    if (!this.dependencies.webTentacle) {
      throw new Error('Web Tentacle is required for external source integration');
    }
    
    const sourceId = `source_${connectionData.service}_${Date.now()}`;
    
    // Store connection data
    const source = {
      id: sourceId,
      service: connectionData.service,
      accountId: connectionData.accountId,
      displayName: connectionData.displayName,
      authData: connectionData.authData,
      status: 'connecting',
      lastSync: null,
      created: new Date()
    };
    
    this.externalSources.set(sourceId, source);
    
    try {
      // Attempt connection via Web Tentacle
      const result = await this.dependencies.webTentacle.connectContactService({
        service: connectionData.service,
        authData: connectionData.authData
      });
      
      // Update source status
      source.status = 'connected';
      source.serviceData = result.serviceData;
      
      this.logger.info('[ContactManagementSystem] Connected to external source successfully', { 
        service: connectionData.service 
      });
      
      // Schedule initial sync
      this._syncExternalSource(sourceId);
      
      return {
        status: 'success',
        sourceId,
        contactCount: result.contactCount
      };
    } catch (error) {
      // Update source status
      source.status = 'error';
      source.error = error.message;
      
      this.logger.error('[ContactManagementSystem] Failed to connect to external source', { 
        service: connectionData.service,
        error: error.message
      });
      
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Sync with external source
   * @param {string} sourceId - Source ID
   * @returns {Promise<Object>} Sync status
   * @private
   */
  async _syncExternalSource(sourceId) {
    const source = this.externalSources.get(sourceId);
    if (!source) {
      throw new Error(`External source not found: ${sourceId}`);
    }
    
    this.logger.debug('[ContactManagementSystem] Syncing with external source', { 
      service: source.service 
    });
    
    try {
      // Get contacts from external source
      const result = await this.dependencies.webTentacle.syncContacts({
        service: source.service,
        authData: source.authData,
        lastSync: source.lastSync
      });
      
      // Process new and updated contacts
      if (result.contacts && result.contacts.length > 0) {
        for (const contactData of result.contacts) {
          // Check if contact already exists
          const existingContact = Array.from(this.contacts.values()).find(contact => 
            contact.externalIds && contact.externalIds[source.service] === contactData.id
          );
          
          if (existingContact) {
            // Update existing contact
            await this.updateContact(existingContact.id, {
              name: contactData.name,
              emails: contactData.emails,
              phones: contactData.phones,
              addresses: contactData.addresses,
              organizations: contactData.organizations,
              websites: contactData.websites,
              socialProfiles: contactData.socialProfiles,
              avatar: contactData.avatar
            });
          } else {
            // Create new contact
            const externalIds = {};
            externalIds[source.service] = contactData.id;
            
            await this.createContact({
              name: contactData.name,
              emails: contactData.emails,
              phones: contactData.phones,
              addresses: contactData.addresses,
              organizations: contactData.organizations,
              websites: contactData.websites,
              socialProfiles: contactData.socialProfiles,
              source: source.service,
              externalIds: externalIds,
              avatar: contactData.avatar
            });
          }
        }
      }
      
      // Update source status
      source.status = 'connected';
      source.lastSync = new Date();
      source.error = null;
      
      this.logger.info('[ContactManagementSystem] External source sync completed', { 
        service: source.service,
        contactCount: result.contacts ? result.contacts.length : 0
      });
      
      return {
        status: 'success',
        contactCount: result.contacts ? result.contacts.length : 0
      };
    } catch (error) {
      // Update source status
      source.status = 'error';
      source.error = error.message;
      
      this.logger.error('[ContactManagementSystem] Failed to sync with external source', { 
        service: source.service,
        error: error.message
      });
      
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  /**
   * Sync contact to external sources
   * @param {Object} contact - Contact
   * @returns {Promise<boolean>} Success
   * @private
   */
  async _syncContactToExternalSources(contact) {
    if (!contact.externalIds || Object.keys(contact.externalIds).length === 0) {
      return false;
    }
    
    let success = true;
    
    for (const [service, externalId] of Object.entries(contact.externalIds)) {
      // Find source
      const source = Array.from(this.externalSources.values()).find(src => 
        src.service === service && src.status === 'connected'
      );
      
      if (!source) {
        continue;
      }
      
      this.logger.debug('[ContactManagementSystem] Syncing contact to external source', { 
        contactId: contact.id,
        service
      });
      
      try {
        // Prepare contact data
        const contactData = {
          id: externalId,
          name: contact.name,
          emails: contact.emails,
          phones: contact.phones,
          addresses: contact.addresses,
          organizations: contact.organizations,
          websites: contact.websites,
          socialProfiles: contact.socialProfiles
        };
        
        // Send to external source
        await this.dependencies.webTentacle.updateContact({
          service,
          authData: source.authData,
          contact: contactData
        });
        
        this.logger.info('[ContactManagementSystem] Contact synced to external source', { 
          contactId: contact.id,
          service
        });
      } catch (error) {
        this.logger.error('[ContactManagementSystem] Failed to sync contact to external source', { 
          contactId: contact.id,
          service,
          error: error.message
        });
        
        success = false;
      }
    }
    
    return success;
  }
  
  /**
   * Update relationship graph
   * @param {Object} contact - Contact
   * @private
   */
  _updateRelationshipGraph(contact) {
    // Remove existing relationships for this contact
    this._removeFromRelationshipGraph(contact.id);
    
    // Add new relationships
    if (contact.relationships && contact.relationships.length > 0) {
      for (const relationship of contact.relationships) {
        const targetId = relationship.contactId;
        const type = relationship.type;
        
        // Add relationship to graph
        if (!this.relationshipGraph.has(contact.id)) {
          this.relationshipGraph.set(contact.id, new Map());
        }
        
        this.relationshipGraph.get(contact.id).set(targetId, type);
        
        // Add reverse relationship if target exists
        if (this.contacts.has(targetId)) {
          if (!this.relationshipGraph.has(targetId)) {
            this.relationshipGraph.set(targetId, new Map());
          }
          
          // Determine reverse relationship type
          let reverseType = 'related';
          if (type === 'spouse') reverseType = 'spouse';
          else if (type === 'parent') reverseType = 'child';
          else if (type === 'child') reverseType = 'parent';
          else if (type === 'sibling') reverseType = 'sibling';
          else if (type === 'friend') reverseType = 'friend';
          else if (type === 'colleague') reverseType = 'colleague';
          
          this.relationshipGraph.get(targetId).set(contact.id, reverseType);
          
          // Update target contact's relationships array
          const targetContact = this.contacts.get(targetId);
          if (targetContact) {
            const existingRelationship = targetContact.relationships.find(rel => 
              rel.contactId === contact.id
            );
            
            if (existingRelationship) {
              existingRelationship.type = reverseType;
            } else {
              targetContact.relationships.push({
                contactId: contact.id,
                type: reverseType
              });
            }
          }
        }
      }
    }
  }
  
  /**
   * Remove contact from relationship graph
   * @param {string} contactId - Contact ID
   * @private
   */
  _removeFromRelationshipGraph(contactId) {
    // Remove relationships where this contact is the source
    this.relationshipGraph.delete(contactId);
    
    // Remove relationships where this contact is the target
    for (const [sourceId, relationships] of this.relationshipGraph.entries()) {
      relationships.delete(contactId);
      
      // Update source contact's relationships array
      const sourceContact = this.contacts.get(sourceId);
      if (sourceContact) {
        sourceContact.relationships = sourceContact.relationships.filter(rel => 
          rel.contactId !== contactId
        );
      }
    }
  }
  
  /**
   * Find related contacts
   * @param {string} contactId - Contact ID
   * @param {Object} options - Options
   * @param {number} options.depth - Relationship depth (default: 1)
   * @param {Array<string>} options.types - Relationship types to include
   * @returns {Promise<Array<Object>>} Related contacts with relationship info
   */
  async findRelatedContacts(contactId, options = {}) {
    this.logger.debug('[ContactManagementSystem] Finding related contacts', { contactId, options });
    
    const depth = options.depth || 1;
    const types = options.types || null;
    
    const visited = new Set();
    const result = [];
    
    // Helper function for recursive traversal
    const traverse = (id, currentDepth, path) => {
      if (currentDepth > depth || visited.has(id)) {
        return;
      }
      
      visited.add(id);
      
      // Get relationships for this contact
      const relationships = this.relationshipGraph.get(id);
      if (!relationships) {
        return;
      }
      
      for (const [targetId, type] of relationships.entries()) {
        // Skip if filtering by type and this type is not included
        if (types && !types.includes(type)) {
          continue;
        }
        
        // Skip if already visited
        if (visited.has(targetId)) {
          continue;
        }
        
        // Get target contact
        const contact = this.contacts.get(targetId);
        if (!contact) {
          continue;
        }
        
        // Add to result
        result.push({
          contact,
          relationship: {
            type,
            path: [...path, { id, type }]
          }
        });
        
        // Continue traversal if not at max depth
        if (currentDepth < depth) {
          traverse(targetId, currentDepth + 1, [...path, { id, type }]);
        }
      }
    };
    
    // Start traversal
    traverse(contactId, 1, []);
    
    this.logger.info('[ContactManagementSystem] Found related contacts', { 
      contactId, 
      relatedCount: result.length 
    });
    
    return result;
  }
  
  /**
   * Get contact suggestions
   * @param {string} contactId - Contact ID
   * @returns {Promise<Array<Object>>} Contact suggestions
   */
  async getContactSuggestions(contactId) {
    this.logger.debug('[ContactManagementSystem] Getting contact suggestions', { contactId });
    
    // Use model integration for intelligent suggestions if available
    if (this.modelIntegration) {
      try {
        const modelResult = await this.modelIntegration.generateContactSuggestions({
          contactId,
          allContacts: Array.from(this.contacts.values()),
          relationshipGraph: this._serializeRelationshipGraph()
        });
        
        if (modelResult && modelResult.suggestions) {
          this.logger.info('[ContactManagementSystem] Generated suggestions using model integration', { 
            contactId,
            suggestionCount: modelResult.suggestions.length 
          });
          return modelResult.suggestions;
        }
      } catch (error) {
        this.logger.warn('[ContactManagementSystem] Model integration failed, falling back to standard algorithm', { 
          error: error.message 
        });
      }
    }
    
    // Fall back to standard algorithm
    return this._generateContactSuggestionsStandard(contactId);
  }
  
  /**
   * Generate contact suggestions using standard algorithm
   * @param {string} contactId - Contact ID
   * @returns {Promise<Array<Object>>} Contact suggestions
   * @private
   */
  async _generateContactSuggestionsStandard(contactId) {
    const contact = this.contacts.get(contactId);
    if (!contact) {
      return [];
    }
    
    const suggestions = [];
    const seenIds = new Set([contactId]);
    
    // Find contacts with similar organizations
    if (contact.organizations && contact.organizations.length > 0) {
      for (const org of contact.organizations) {
        for (const [id, otherContact] of this.contacts.entries()) {
          if (seenIds.has(id)) {
            continue;
          }
          
          if (otherContact.organizations && otherContact.organizations.some(otherOrg => 
              otherOrg.name === org.name)) {
            suggestions.push({
              contact: otherContact,
              reason: `Works at ${org.name}`,
              score: 0.8
            });
            seenIds.add(id);
          }
        }
      }
    }
    
    // Find contacts with similar email domains
    if (contact.emails && contact.emails.length > 0) {
      for (const email of contact.emails) {
        const domain = email.address.split('@')[1];
        if (!domain) continue;
        
        for (const [id, otherContact] of this.contacts.entries()) {
          if (seenIds.has(id)) {
            continue;
          }
          
          if (otherContact.emails && otherContact.emails.some(otherEmail => 
              otherEmail.address.endsWith(`@${domain}`))) {
            suggestions.push({
              contact: otherContact,
              reason: `Same email domain (${domain})`,
              score: 0.7
            });
            seenIds.add(id);
          }
        }
      }
    }
    
    // Find second-degree connections
    const firstDegreeConnections = await this.findRelatedContacts(contactId, { depth: 1 });
    for (const { contact: firstDegree } of firstDegreeConnections) {
      const secondDegreeConnections = await this.findRelatedContacts(firstDegree.id, { depth: 1 });
      
      for (const { contact: secondDegree } of secondDegreeConnections) {
        if (seenIds.has(secondDegree.id) || secondDegree.id === contactId) {
          continue;
        }
        
        suggestions.push({
          contact: secondDegree,
          reason: `Connected through ${firstDegree.name.full}`,
          score: 0.6
        });
        seenIds.add(secondDegree.id);
      }
    }
    
    // Sort by score
    suggestions.sort((a, b) => b.score - a.score);
    
    this.logger.info('[ContactManagementSystem] Generated suggestions using standard algorithm', { 
      contactId,
      suggestionCount: suggestions.length 
    });
    
    return suggestions;
  }
  
  /**
   * Serialize relationship graph for model input
   * @returns {Object} Serialized graph
   * @private
   */
  _serializeRelationshipGraph() {
    const serialized = {};
    
    for (const [sourceId, relationships] of this.relationshipGraph.entries()) {
      serialized[sourceId] = {};
      
      for (const [targetId, type] of relationships.entries()) {
        serialized[sourceId][targetId] = type;
      }
    }
    
    return serialized;
  }
  
  /**
   * Log communication with contact
   * @param {string} contactId - Contact ID
   * @param {Object} communicationData - Communication data
   * @returns {Promise<Object>} Updated contact
   */
  async logCommunication(contactId, communicationData) {
    this.logger.debug('[ContactManagementSystem] Logging communication', { contactId });
    
    const contact = this.contacts.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    
    // Update last contact timestamp
    const updates = {
      lastContact: new Date()
    };
    
    // Add communication to history if memory tentacle is available
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({
        type: 'contactCommunication',
        id: `comm_${Date.now()}_${this._generateRandomId()}`,
        data: {
          contactId,
          timestamp: new Date(),
          channel: communicationData.channel,
          direction: communicationData.direction,
          summary: communicationData.summary,
          details: communicationData.details
        }
      });
    }
    
    // Update contact
    return this.updateContact(contactId, updates);
  }
  
  /**
   * Export contacts to vCard format
   * @param {Array<string>} contactIds - Contact IDs to export
   * @returns {Promise<string>} vCard data
   */
  async exportToVCard(contactIds) {
    this.logger.debug('[ContactManagementSystem] Exporting contacts to vCard', { 
      contactCount: contactIds.length 
    });
    
    let vcard = '';
    
    for (const contactId of contactIds) {
      const contact = this.contacts.get(contactId);
      if (!contact) continue;
      
      vcard += 'BEGIN:VCARD\r\n';
      vcard += 'VERSION:3.0\r\n';
      
      // Name
      if (contact.name) {
        if (contact.name.full) {
          vcard += `FN:${contact.name.full}\r\n`;
        }
        
        if (contact.name.first || contact.name.last) {
          vcard += `N:${contact.name.last || ''};${contact.name.first || ''};${contact.name.middle || ''};${contact.name.prefix || ''};${contact.name.suffix || ''}\r\n`;
        }
      }
      
      // Emails
      if (contact.emails) {
        for (const email of contact.emails) {
          vcard += `EMAIL;TYPE=${email.type || 'OTHER'}:${email.address}\r\n`;
        }
      }
      
      // Phones
      if (contact.phones) {
        for (const phone of contact.phones) {
          vcard += `TEL;TYPE=${phone.type || 'OTHER'}:${phone.number}\r\n`;
        }
      }
      
      // Addresses
      if (contact.addresses) {
        for (const address of contact.addresses) {
          vcard += `ADR;TYPE=${address.type || 'OTHER'}:;;${address.street || ''};${address.city || ''};${address.state || ''};${address.postalCode || ''};${address.country || ''}\r\n`;
        }
      }
      
      // Organizations
      if (contact.organizations && contact.organizations.length > 0) {
        const org = contact.organizations[0];
        vcard += `ORG:${org.name}\r\n`;
        if (org.title) {
          vcard += `TITLE:${org.title}\r\n`;
        }
      }
      
      // Websites
      if (contact.websites) {
        for (const website of contact.websites) {
          vcard += `URL:${website}\r\n`;
        }
      }
      
      // Notes
      if (contact.notes) {
        vcard += `NOTE:${contact.notes.replace(/\n/g, '\\n')}\r\n`;
      }
      
      // Birthday
      if (contact.dates) {
        const birthday = contact.dates.find(date => date.type === 'birthday');
        if (birthday && birthday.date) {
          const date = new Date(birthday.date);
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          vcard += `BDAY:${year}${month}${day}\r\n`;
        }
      }
      
      vcard += 'END:VCARD\r\n\r\n';
    }
    
    this.logger.info('[ContactManagementSystem] Contacts exported successfully', { 
      contactCount: contactIds.length 
    });
    
    return vcard;
  }
  
  /**
   * Import from vCard format
   * @param {string} vcardData - vCard data
   * @returns {Promise<Object>} Import results
   */
  async importFromVCard(vcardData) {
    this.logger.debug('[ContactManagementSystem] Importing from vCard');
    
    // Parse vCard data
    // This is a simplified parser and would need to be more robust in production
    const contacts = [];
    const vcards = vcardData.split('BEGIN:VCARD');
    
    for (let i = 1; i < vcards.length; i++) {
      const vcard = vcards[i];
      const lines = vcard.split(/\r?\n/);
      
      const contactData = {
        name: {},
        emails: [],
        phones: [],
        addresses: [],
        organizations: [],
        websites: [],
        dates: []
      };
      
      for (const line of lines) {
        if (line.startsWith('END:VCARD')) {
          continue;
        }
        
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0) continue;
        
        const value = valueParts.join(':');
        const keyParts = key.split(';');
        const baseKey = keyParts[0];
        
        // Parse type parameter
        let type = 'other';
        for (const part of keyParts) {
          if (part.startsWith('TYPE=')) {
            type = part.substring(5).toLowerCase();
            break;
          }
        }
        
        switch (baseKey) {
          case 'FN':
            contactData.name.full = value;
            break;
          case 'N':
            const nameParts = value.split(';');
            contactData.name.last = nameParts[0] || '';
            contactData.name.first = nameParts[1] || '';
            contactData.name.middle = nameParts[2] || '';
            contactData.name.prefix = nameParts[3] || '';
            contactData.name.suffix = nameParts[4] || '';
            break;
          case 'EMAIL':
            contactData.emails.push({
              type,
              address: value
            });
            break;
          case 'TEL':
            contactData.phones.push({
              type,
              number: value
            });
            break;
          case 'ADR':
            const addressParts = value.split(';');
            contactData.addresses.push({
              type,
              street: addressParts[2] || '',
              city: addressParts[3] || '',
              state: addressParts[4] || '',
              postalCode: addressParts[5] || '',
              country: addressParts[6] || ''
            });
            break;
          case 'ORG':
            contactData.organizations.push({
              name: value,
              title: ''
            });
            break;
          case 'TITLE':
            if (contactData.organizations.length > 0) {
              contactData.organizations[contactData.organizations.length - 1].title = value;
            }
            break;
          case 'URL':
            contactData.websites.push(value);
            break;
          case 'NOTE':
            contactData.notes = value.replace(/\\n/g, '\n');
            break;
          case 'BDAY':
            try {
              const year = parseInt(value.substring(0, 4), 10);
              const month = parseInt(value.substring(4, 6), 10) - 1;
              const day = parseInt(value.substring(6, 8), 10);
              
              contactData.dates.push({
                type: 'birthday',
                date: new Date(year, month, day)
              });
            } catch (error) {
              this.logger.warn('[ContactManagementSystem] Failed to parse birthday', { 
                value, 
                error: error.message 
              });
            }
            break;
        }
      }
      
      contacts.push(contactData);
    }
    
    // Import contacts
    const importedContacts = [];
    for (const contactData of contacts) {
      try {
        // Skip if no name or email
        if ((!contactData.name.full && !contactData.name.first && !contactData.name.last) && 
            contactData.emails.length === 0) {
          continue;
        }
        
        const contact = await this.createContact(contactData);
        importedContacts.push(contact);
      } catch (error) {
        this.logger.error('[ContactManagementSystem] Failed to import contact', { 
          name: contactData.name.full || `${contactData.name.first} ${contactData.name.last}`,
          error: error.message
        });
      }
    }
    
    this.logger.info('[ContactManagementSystem] Contact import completed', { 
      contactCount: importedContacts.length
    });
    
    return {
      importedCount: importedContacts.length,
      totalCount: contacts.length
    };
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

module.exports = ContactManagementSystem;
