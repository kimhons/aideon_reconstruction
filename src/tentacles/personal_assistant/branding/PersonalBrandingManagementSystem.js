/**
 * @fileoverview Personal Branding Management System for the Personal Assistant Tentacle.
 * Manages personal brand strategy, online presence, content creation, and reputation monitoring.
 * 
 * @module src/tentacles/personal_assistant/branding/PersonalBrandingManagementSystem
 */

const EventEmitter = require("events");

/**
 * Personal Branding Management System
 * @extends EventEmitter
 */
class PersonalBrandingManagementSystem extends EventEmitter {
  /**
   * Create a new Personal Branding Management System
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - System dependencies
   * @param {Object} dependencies.logger - Logger instance
   * @param {Object} dependencies.memoryTentacle - Memory Tentacle for persistent storage
   * @param {Object} dependencies.securityFramework - Security and Governance Framework
   * @param {Object} dependencies.modelIntegrationManager - Model Integration Manager
   * @param {Object} [dependencies.webTentacle] - Web Tentacle for online presence management
   * @param {Object} [dependencies.socialMediaManager] - Social Media Management System
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this.options = {
      defaultBrandVoice: "professional",
      contentReviewFrequency: "weekly",
      reputationScanFrequency: "daily",
      ...options
    };
    
    this.dependencies = dependencies;
    this.logger = dependencies.logger || console;
    
    // Data structures
    this.brandStrategy = null;
    this.brandAssets = new Map();
    this.contentCalendar = new Map();
    this.onlineProfiles = new Map();
    this.reputationAlerts = new Map();
    this.prOpportunities = new Map();
    
    this.logger.info("[PersonalBrandingManagementSystem] Personal Branding Management System initialized");
    
    // Initialize model integrations
    this.models = {};
    if (dependencies.modelIntegrationManager) {
      this._initializeModelIntegrations();
    }
  }
  
  /**
   * Initialize model integrations for personal branding tasks
   * @private
   */
  async _initializeModelIntegrations() {
    const modelTypes = [
      "brand_strategy_analysis",
      "content_generation",
      "content_optimization",
      "audience_analysis",
      "reputation_monitoring",
      "pr_opportunity_detection"
    ];
    
    for (const type of modelTypes) {
      try {
        this.models[type] = await this.dependencies.modelIntegrationManager.getModelIntegration(type);
        this.logger.info(`[PersonalBrandingManagementSystem] Model integration initialized for ${type}`);
      } catch (error) {
        this.logger.warn(`[PersonalBrandingManagementSystem] Failed to initialize model integration for ${type}`, { error: error.message });
      }
    }
  }
  
  /**
   * Get system status
   * @returns {Object} System status
   */
  getStatus() {
    return {
      hasBrandStrategy: !!this.brandStrategy,
      brandAssetCount: this.brandAssets.size,
      contentCalendarItemCount: this.contentCalendar.size,
      onlineProfileCount: this.onlineProfiles.size,
      activeReputationAlerts: this.reputationAlerts.size,
      activePrOpportunities: this.prOpportunities.size,
      modelIntegrations: Object.keys(this.models)
    };
  }
  
  // --- Brand Strategy Management ---
  
  /**
   * Create or update the personal brand strategy
   * @param {Object} strategyData - Brand strategy details
   * @param {string} strategyData.vision - Overall brand vision
   * @param {string} strategyData.mission - Brand mission statement
   * @param {Array<string>} strategyData.values - Core brand values
   * @param {Array<string>} strategyData.targetAudiences - Target audience segments
   * @param {Object} strategyData.positioning - Brand positioning details
   * @param {Object} strategyData.voice - Brand voice and tone guidelines
   * @returns {Promise<Object>} Created/updated brand strategy
   */
  async createOrUpdateBrandStrategy(strategyData) {
    this.logger.debug("[PersonalBrandingManagementSystem] Creating/updating brand strategy");
    
    const strategy = {
      id: "brand_strategy",
      vision: strategyData.vision,
      mission: strategyData.mission,
      values: strategyData.values || [],
      targetAudiences: strategyData.targetAudiences || [],
      positioning: strategyData.positioning || {},
      voice: strategyData.voice || { tone: this.options.defaultBrandVoice },
      goals: strategyData.goals || [],
      metrics: strategyData.metrics || [],
      created: this.brandStrategy ? this.brandStrategy.created : new Date(),
      updated: new Date()
    };
    
    // Store strategy
    this.brandStrategy = strategy;
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "brandStrategy", id: "brand_strategy", data: strategy });
    }
    
    // Analyze strategy with AI
    this._analyzeBrandStrategy();
    
    this.logger.info("[PersonalBrandingManagementSystem] Brand strategy created/updated successfully");
    return strategy;
  }
  
  /**
   * Get the current brand strategy
   * @returns {Promise<Object>} Brand strategy
   */
  async getBrandStrategy() {
    if (!this.brandStrategy) {
      if (this.dependencies.memoryTentacle) {
        const stored = await this.dependencies.memoryTentacle.getEntity({ type: "brandStrategy", id: "brand_strategy" });
        if (stored) {
          this.brandStrategy = stored.data;
        } else {
          throw new Error("No brand strategy has been defined yet");
        }
      } else {
        throw new Error("No brand strategy has been defined yet");
      }
    }
    return this.brandStrategy;
  }
  
  /**
   * Analyze brand strategy with AI to provide insights and recommendations
   * @private
   */
  async _analyzeBrandStrategy() {
    if (!this.brandStrategy || !this.models.brand_strategy_analysis) return;
    
    this.logger.debug("[PersonalBrandingManagementSystem] Analyzing brand strategy with AI");
    
    try {
      const analysisResult = await this.models.brand_strategy_analysis.analyze({
        strategy: this.brandStrategy
      });
      
      if (analysisResult && analysisResult.insights) {
        this.logger.info("[PersonalBrandingManagementSystem] Brand strategy analysis complete");
        this.emit("brandStrategyInsights", analysisResult.insights);
        
        // Store insights for later reference
        if (this.dependencies.memoryTentacle) {
          await this.dependencies.memoryTentacle.storeEntity({
            type: "brandAnalysis",
            id: `analysis_${Date.now()}`,
            data: {
              strategyId: "brand_strategy",
              timestamp: new Date(),
              insights: analysisResult.insights,
              recommendations: analysisResult.recommendations || []
            }
          });
        }
      }
    } catch (error) {
      this.logger.warn("[PersonalBrandingManagementSystem] Brand strategy analysis failed", { error: error.message });
    }
  }
  
  // --- Brand Assets Management ---
  
  /**
   * Add or update a brand asset (logo, colors, templates, etc.)
   * @param {Object} assetData - Asset details
   * @param {string} assetData.type - Asset type (e.g., "logo", "color_palette", "template")
   * @param {string} assetData.name - Asset name
   * @param {Object} assetData.content - Asset content (format depends on type)
   * @returns {Promise<Object>} Created/updated asset
   */
  async addOrUpdateBrandAsset(assetData) {
    this.logger.debug("[PersonalBrandingManagementSystem] Adding/updating brand asset", { type: assetData.type, name: assetData.name });
    
    const assetId = assetData.id || `asset_${assetData.type}_${Date.now()}`;
    const existingAsset = this.brandAssets.get(assetId);
    
    const asset = {
      id: assetId,
      type: assetData.type,
      name: assetData.name,
      content: assetData.content,
      description: assetData.description || (existingAsset ? existingAsset.description : ""),
      tags: assetData.tags || (existingAsset ? existingAsset.tags : []),
      created: existingAsset ? existingAsset.created : new Date(),
      updated: new Date()
    };
    
    // Store asset
    this.brandAssets.set(assetId, asset);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "brandAsset", id: assetId, data: asset });
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Brand asset added/updated successfully", { assetId });
    return asset;
  }
  
  /**
   * Get brand assets based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { type: "logo" })
   * @returns {Promise<Array<Object>>} Matching assets
   */
  async getBrandAssets(criteria = {}) {
    this.logger.debug("[PersonalBrandingManagementSystem] Getting brand assets", { criteria });
    let assets = Array.from(this.brandAssets.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      assets = assets.filter(asset => asset[key] === criteria[key]);
    });
    
    return assets;
  }
  
  // --- Content Calendar Management ---
  
  /**
   * Create a content calendar item
   * @param {Object} itemData - Content item details
   * @param {string} itemData.title - Content title
   * @param {string} itemData.type - Content type (e.g., "blog_post", "social_media", "newsletter")
   * @param {Date} itemData.scheduledDate - Scheduled publication date
   * @param {string} [itemData.status] - Status (e.g., "draft", "scheduled", "published")
   * @param {string} [itemData.content] - Content body or outline
   * @returns {Promise<Object>} Created content calendar item
   */
  async createContentItem(itemData) {
    this.logger.debug("[PersonalBrandingManagementSystem] Creating content calendar item", { title: itemData.title });
    
    const itemId = `content_${Date.now()}_${this._generateRandomId()}`;
    
    const contentItem = {
      id: itemId,
      title: itemData.title,
      type: itemData.type,
      scheduledDate: new Date(itemData.scheduledDate),
      status: itemData.status || "draft",
      content: itemData.content || "",
      keywords: itemData.keywords || [],
      channels: itemData.channels || [], // Where to publish
      targetAudience: itemData.targetAudience || [],
      metrics: {}, // For tracking performance
      created: new Date(),
      updated: new Date()
    };
    
    // Store content item
    this.contentCalendar.set(itemId, contentItem);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "contentItem", id: itemId, data: contentItem });
    }
    
    // If content is empty or just an outline, generate content with AI
    if (contentItem.status === "draft" && (!contentItem.content || contentItem.content.length < 100)) {
      this._generateContentWithAI(itemId);
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Content calendar item created successfully", { itemId });
    return contentItem;
  }
  
  /**
   * Update a content calendar item
   * @param {string} itemId - Content item ID
   * @param {Object} updates - Content item updates
   * @returns {Promise<Object>} Updated content item
   */
  async updateContentItem(itemId, updates) {
    this.logger.debug("[PersonalBrandingManagementSystem] Updating content calendar item", { itemId });
    
    const contentItem = this.contentCalendar.get(itemId);
    if (!contentItem) {
      throw new Error(`Content item not found: ${itemId}`);
    }
    
    const updatedItem = { ...contentItem };
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (!["id", "created"].includes(key)) {
        updatedItem[key] = updates[key];
      }
    });
    
    updatedItem.updated = new Date();
    
    // Store updated item
    this.contentCalendar.set(itemId, updatedItem);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "contentItem", id: itemId, data: updatedItem });
    }
    
    // If status changed to "scheduled" and content needs optimization
    if (updates.status === "scheduled" && this.models.content_optimization) {
      this._optimizeContentWithAI(itemId);
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Content calendar item updated successfully", { itemId });
    return updatedItem;
  }
  
  /**
   * Get content calendar items based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { status: "draft", type: "blog_post" })
   * @returns {Promise<Array<Object>>} Matching content items
   */
  async getContentItems(criteria = {}) {
    this.logger.debug("[PersonalBrandingManagementSystem] Getting content calendar items", { criteria });
    let items = Array.from(this.contentCalendar.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      if (key === "startDate") {
        items = items.filter(item => new Date(item.scheduledDate) >= new Date(criteria.startDate));
      } else if (key === "endDate") {
        items = items.filter(item => new Date(item.scheduledDate) <= new Date(criteria.endDate));
      } else {
        items = items.filter(item => item[key] === criteria[key]);
      }
    });
    
    // Sort by scheduled date
    items.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    
    return items;
  }
  
  /**
   * Generate content for personal branding based on provided parameters
   * @param {Object} params - Content generation parameters
   * @param {string} params.contentType - Type of content to generate (e.g., "bio", "post", "article")
   * @param {string} params.platform - Target platform (e.g., "linkedin", "twitter", "website")
   * @param {Array<string>} [params.keywords] - Keywords to include in content
   * @param {string} [params.tone] - Desired tone (defaults to brand voice)
   * @param {number} [params.length] - Approximate content length in words
   * @returns {Promise<Object>} Generated content and metadata
   */
  async generateContent(params) {
    this.logger.debug("[PersonalBrandingManagementSystem] Generating branding content", { contentType: params.contentType, platform: params.platform });
    
    if (!this.models.content_generation) {
      throw new Error("Content generation model not available");
    }
    
    try {
      // Get brand strategy for context
      let brandStrategy = null;
      try {
        brandStrategy = await this.getBrandStrategy();
      } catch (error) {
        this.logger.warn("[PersonalBrandingManagementSystem] Could not retrieve brand strategy for content generation");
      }
      
      const tone = params.tone || (brandStrategy ? brandStrategy.voice.tone : this.options.defaultBrandVoice);
      
      const generationResult = await this.models.content_generation.generate({
        contentType: params.contentType,
        platform: params.platform,
        keywords: params.keywords || [],
        tone: tone,
        length: params.length || 0,
        brandVoice: brandStrategy ? brandStrategy.voice : { tone: this.options.defaultBrandVoice },
        targetAudience: brandStrategy ? brandStrategy.targetAudiences : []
      });
      
      if (!generationResult || !generationResult.content) {
        throw new Error("Failed to generate content");
      }
      
      this.logger.info("[PersonalBrandingManagementSystem] Content generated successfully", { 
        contentType: params.contentType, 
        platform: params.platform 
      });
      
      return {
        content: generationResult.content,
        suggestedKeywords: generationResult.suggestedKeywords || params.keywords || [],
        metadata: {
          generatedAt: new Date(),
          contentType: params.contentType,
          platform: params.platform,
          tone: tone,
          wordCount: generationResult.content.split(/\s+/).length
        }
      };
    } catch (error) {
      this.logger.error("[PersonalBrandingManagementSystem] Content generation failed", { 
        error: error.message,
        contentType: params.contentType,
        platform: params.platform
      });
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }
  
  /**
   * Generate content with AI based on content item parameters
   * @param {string} itemId - Content item ID
   * @private
   */
  async _generateContentWithAI(itemId) {
    const contentItem = this.contentCalendar.get(itemId);
    if (!contentItem || !this.models.content_generation) return;
    
    this.logger.debug("[PersonalBrandingManagementSystem] Generating content with AI", { itemId });
    
    try {
      // Get brand strategy for context
      let brandStrategy = null;
      try {
        brandStrategy = await this.getBrandStrategy();
      } catch (error) {
        this.logger.warn("[PersonalBrandingManagementSystem] Could not retrieve brand strategy for content generation");
      }
      
      const generationResult = await this.models.content_generation.generate({
        title: contentItem.title,
        contentType: contentItem.type,
        keywords: contentItem.keywords,
        targetAudience: contentItem.targetAudience,
        brandVoice: brandStrategy ? brandStrategy.voice : { tone: this.options.defaultBrandVoice },
        outline: contentItem.content // Use existing content as outline if available
      });
      
      if (generationResult && generationResult.content) {
        this.logger.info("[PersonalBrandingManagementSystem] Content generated successfully with AI", { itemId });
        
        // Update content item with generated content
        await this.updateContentItem(itemId, {
          content: generationResult.content,
          keywords: generationResult.suggestedKeywords || contentItem.keywords
        });
        
        this.emit("contentGenerated", { itemId, title: contentItem.title });
      }
    } catch (error) {
      this.logger.warn("[PersonalBrandingManagementSystem] Content generation with AI failed", { itemId, error: error.message });
    }
  }
  
  /**
   * Optimize content with AI for better engagement
   * @param {string} itemId - Content item ID
   * @private
   */
  async _optimizeContentWithAI(itemId) {
    const contentItem = this.contentCalendar.get(itemId);
    if (!contentItem || !this.models.content_optimization || !contentItem.content) return;
    
    this.logger.debug("[PersonalBrandingManagementSystem] Optimizing content with AI", { itemId });
    
    try {
      const optimizationResult = await this.models.content_optimization.optimize({
        content: contentItem.content,
        contentType: contentItem.type,
        keywords: contentItem.keywords,
        targetAudience: contentItem.targetAudience,
        channels: contentItem.channels
      });
      
      if (optimizationResult && optimizationResult.optimizedContent) {
        this.logger.info("[PersonalBrandingManagementSystem] Content optimized successfully with AI", { itemId });
        
        // Update content item with optimized content
        await this.updateContentItem(itemId, {
          content: optimizationResult.optimizedContent,
          keywords: optimizationResult.suggestedKeywords || contentItem.keywords
        });
        
        this.emit("contentOptimized", { itemId, title: contentItem.title });
      }
    } catch (error) {
      this.logger.warn("[PersonalBrandingManagementSystem] Content optimization with AI failed", { itemId, error: error.message });
    }
  }
  
  // --- Online Presence Management ---
  
  /**
   * Add or update an online profile (website, social media, professional platform)
   * @param {Object} profileData - Profile details
   * @param {string} profileData.platform - Platform name (e.g., "linkedin", "twitter", "personal_website")
   * @param {string} profileData.url - Profile URL
   * @param {string} [profileData.username] - Username on the platform
   * @param {string} [profileData.bio] - Profile bio/description
   * @returns {Promise<Object>} Created/updated profile
   */
  async addOrUpdateOnlineProfile(profileData) {
    this.logger.debug("[PersonalBrandingManagementSystem] Adding/updating online profile", { platform: profileData.platform });
    
    const profileId = `profile_${profileData.platform.toLowerCase().replace(/\s+/g, "_")}`;
    const existingProfile = this.onlineProfiles.get(profileId);
    
    const profile = {
      id: profileId,
      platform: profileData.platform,
      url: profileData.url,
      username: profileData.username || (existingProfile ? existingProfile.username : null),
      bio: profileData.bio || (existingProfile ? existingProfile.bio : ""),
      metrics: profileData.metrics || (existingProfile ? existingProfile.metrics : {}),
      lastUpdated: new Date(),
      created: existingProfile ? existingProfile.created : new Date()
    };
    
    // Store profile
    this.onlineProfiles.set(profileId, profile);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "onlineProfile", id: profileId, data: profile });
    }
    
    // Connect to social media manager if available
    if (this.dependencies.socialMediaManager && ["twitter", "linkedin", "facebook", "instagram"].includes(profileData.platform.toLowerCase())) {
      try {
        await this.dependencies.socialMediaManager.connectProfile({
          platform: profileData.platform,
          url: profileData.url,
          username: profileData.username,
          profileId: profileId
        });
      } catch (error) {
        this.logger.warn("[PersonalBrandingManagementSystem] Failed to connect profile to social media manager", { 
          platform: profileData.platform, 
          error: error.message 
        });
      }
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Online profile added/updated successfully", { profileId });
    return profile;
  }
  
  /**
   * Get online profiles based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { platform: "linkedin" })
   * @returns {Promise<Array<Object>>} Matching profiles
   */
  async getOnlineProfiles(criteria = {}) {
    this.logger.debug("[PersonalBrandingManagementSystem] Getting online profiles", { criteria });
    let profiles = Array.from(this.onlineProfiles.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      profiles = profiles.filter(profile => profile[key] === criteria[key]);
    });
    
    return profiles;
  }
  
  /**
   * Update profile metrics (followers, engagement, etc.)
   * @param {string} profileId - Profile ID
   * @param {Object} metrics - Metrics data
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfileMetrics(profileId, metrics) {
    this.logger.debug("[PersonalBrandingManagementSystem] Updating profile metrics", { profileId });
    
    const profile = this.onlineProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Online profile not found: ${profileId}`);
    }
    
    const updatedProfile = { ...profile };
    updatedProfile.metrics = { ...profile.metrics, ...metrics };
    updatedProfile.lastUpdated = new Date();
    
    // Store updated profile
    this.onlineProfiles.set(profileId, updatedProfile);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "onlineProfile", id: profileId, data: updatedProfile });
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Profile metrics updated successfully", { profileId });
    return updatedProfile;
  }
  
  // --- Reputation Monitoring ---
  
  /**
   * Start monitoring for brand mentions and reputation issues
   * @param {Array<string>} keywords - Keywords to monitor (name, brand terms, etc.)
   * @returns {Promise<Object>} Monitoring status
   */
  async startReputationMonitoring(keywords) {
    this.logger.debug("[PersonalBrandingManagementSystem] Starting reputation monitoring", { keywordCount: keywords.length });
    
    // Store monitoring configuration
    const monitoringConfig = {
      id: "reputation_monitoring",
      keywords: keywords,
      frequency: this.options.reputationScanFrequency,
      lastScan: null,
      isActive: true,
      created: new Date()
    };
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "monitoringConfig", id: "reputation_monitoring", data: monitoringConfig });
    }
    
    // Schedule initial scan
    this._scanForReputationIssues(keywords);
    
    this.logger.info("[PersonalBrandingManagementSystem] Reputation monitoring started successfully");
    return { status: "active", keywords };
  }
  
  /**
   * Scan for reputation issues and brand mentions
   * @param {Array<string>} keywords - Keywords to monitor
   * @private
   */
  async _scanForReputationIssues(keywords) {
    if (!this.models.reputation_monitoring || !keywords || keywords.length === 0) return;
    
    this.logger.debug("[PersonalBrandingManagementSystem] Scanning for reputation issues");
    
    try {
      const scanResult = await this.models.reputation_monitoring.scan({ keywords });
      
      if (scanResult && scanResult.mentions) {
        this.logger.info("[PersonalBrandingManagementSystem] Reputation scan complete", { 
          mentionCount: scanResult.mentions.length,
          alertCount: scanResult.alerts ? scanResult.alerts.length : 0
        });
        
        // Process mentions
        for (const mention of scanResult.mentions) {
          const mentionId = `mention_${Date.now()}_${this._generateRandomId()}`;
          
          // Store mention
          if (this.dependencies.memoryTentacle) {
            await this.dependencies.memoryTentacle.storeEntity({ 
              type: "brandMention", 
              id: mentionId, 
              data: {
                ...mention,
                id: mentionId,
                discovered: new Date(),
                processed: false
              }
            });
          }
        }
        
        // Process alerts
        if (scanResult.alerts) {
          for (const alert of scanResult.alerts) {
            const alertId = `alert_${Date.now()}_${this._generateRandomId()}`;
            
            // Store alert
            this.reputationAlerts.set(alertId, {
              ...alert,
              id: alertId,
              discovered: new Date(),
              status: "new"
            });
            
            if (this.dependencies.memoryTentacle) {
              await this.dependencies.memoryTentacle.storeEntity({ 
                type: "reputationAlert", 
                id: alertId, 
                data: this.reputationAlerts.get(alertId)
              });
            }
            
            // Emit alert event
            this.emit("reputationAlert", this.reputationAlerts.get(alertId));
          }
        }
        
        // Update last scan timestamp
        if (this.dependencies.memoryTentacle) {
          await this.dependencies.memoryTentacle.updateEntity({ 
            type: "monitoringConfig", 
            id: "reputation_monitoring", 
            data: { lastScan: new Date() }
          });
        }
      }
    } catch (error) {
      this.logger.warn("[PersonalBrandingManagementSystem] Reputation scan failed", { error: error.message });
    }
  }
  
  /**
   * Get active reputation alerts
   * @param {Object} criteria - Filter criteria (e.g., { status: "new" })
   * @returns {Promise<Array<Object>>} Matching alerts
   */
  async getReputationAlerts(criteria = {}) {
    this.logger.debug("[PersonalBrandingManagementSystem] Getting reputation alerts", { criteria });
    let alerts = Array.from(this.reputationAlerts.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      alerts = alerts.filter(alert => alert[key] === criteria[key]);
    });
    
    // Sort by discovery date (newest first)
    alerts.sort((a, b) => new Date(b.discovered) - new Date(a.discovered));
    
    return alerts;
  }
  
  /**
   * Update reputation alert status
   * @param {string} alertId - Alert ID
   * @param {string} status - New status (e.g., "in_progress", "resolved", "dismissed")
   * @returns {Promise<Object>} Updated alert
   */
  async updateAlertStatus(alertId, status) {
    this.logger.debug("[PersonalBrandingManagementSystem] Updating alert status", { alertId, status });
    
    const alert = this.reputationAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Reputation alert not found: ${alertId}`);
    }
    
    const updatedAlert = { ...alert, status, updated: new Date() };
    
    // Store updated alert
    this.reputationAlerts.set(alertId, updatedAlert);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "reputationAlert", id: alertId, data: updatedAlert });
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Alert status updated successfully", { alertId, status });
    return updatedAlert;
  }
  
  // --- PR Opportunity Management ---
  
  /**
   * Add a PR opportunity
   * @param {Object} opportunityData - Opportunity details
   * @param {string} opportunityData.title - Opportunity title
   * @param {string} opportunityData.description - Opportunity description
   * @param {string} opportunityData.source - Source of the opportunity
   * @param {Date} [opportunityData.deadline] - Submission deadline
   * @returns {Promise<Object>} Created PR opportunity
   */
  async addPrOpportunity(opportunityData) {
    this.logger.debug("[PersonalBrandingManagementSystem] Adding PR opportunity", { title: opportunityData.title });
    
    const opportunityId = `pr_opp_${Date.now()}_${this._generateRandomId()}`;
    
    const opportunity = {
      id: opportunityId,
      title: opportunityData.title,
      description: opportunityData.description,
      source: opportunityData.source,
      deadline: opportunityData.deadline ? new Date(opportunityData.deadline) : null,
      status: "new",
      created: new Date(),
      updated: new Date()
    };
    
    // Store opportunity
    this.prOpportunities.set(opportunityId, opportunity);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.storeEntity({ type: "prOpportunity", id: opportunityId, data: opportunity });
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] PR opportunity added successfully", { opportunityId });
    return opportunity;
  }
  
  /**
   * Get PR opportunities based on criteria
   * @param {Object} criteria - Filter criteria (e.g., { status: "new" })
   * @returns {Promise<Array<Object>>} Matching opportunities
   */
  async getPrOpportunities(criteria = {}) {
    this.logger.debug("[PersonalBrandingManagementSystem] Getting PR opportunities", { criteria });
    let opportunities = Array.from(this.prOpportunities.values());
    
    // Apply filters
    Object.keys(criteria).forEach(key => {
      opportunities = opportunities.filter(opp => opp[key] === criteria[key]);
    });
    
    // Sort by deadline (soonest first) or creation date if no deadline
    opportunities.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline) - new Date(b.deadline);
      } else if (a.deadline) {
        return -1; // a has deadline, b doesn't
      } else if (b.deadline) {
        return 1; // b has deadline, a doesn't
      } else {
        return new Date(b.created) - new Date(a.created); // newest first if no deadlines
      }
    });
    
    return opportunities;
  }
  
  /**
   * Update PR opportunity status
   * @param {string} opportunityId - Opportunity ID
   * @param {string} status - New status (e.g., "in_progress", "submitted", "accepted", "rejected")
   * @returns {Promise<Object>} Updated opportunity
   */
  async updateOpportunityStatus(opportunityId, status) {
    this.logger.debug("[PersonalBrandingManagementSystem] Updating opportunity status", { opportunityId, status });
    
    const opportunity = this.prOpportunities.get(opportunityId);
    if (!opportunity) {
      throw new Error(`PR opportunity not found: ${opportunityId}`);
    }
    
    const updatedOpportunity = { ...opportunity, status, updated: new Date() };
    
    // Store updated opportunity
    this.prOpportunities.set(opportunityId, updatedOpportunity);
    
    // Store in memory tentacle
    if (this.dependencies.memoryTentacle) {
      await this.dependencies.memoryTentacle.updateEntity({ type: "prOpportunity", id: opportunityId, data: updatedOpportunity });
    }
    
    this.logger.info("[PersonalBrandingManagementSystem] Opportunity status updated successfully", { opportunityId, status });
    return updatedOpportunity;
  }
  
  /**
   * Detect PR opportunities using AI
   * @returns {Promise<Array<Object>>} Detected opportunities
   */
  async detectPrOpportunities() {
    this.logger.debug("[PersonalBrandingManagementSystem] Detecting PR opportunities with AI");
    
    if (!this.models.pr_opportunity_detection) {
      this.logger.warn("[PersonalBrandingManagementSystem] PR opportunity detection model not available");
      return [];
    }
    
    try {
      // Get brand strategy for context
      let brandStrategy = null;
      try {
        brandStrategy = await this.getBrandStrategy();
      } catch (error) {
        this.logger.warn("[PersonalBrandingManagementSystem] Could not retrieve brand strategy for PR opportunity detection");
      }
      
      const detectionResult = await this.models.pr_opportunity_detection.detect({
        brandStrategy: brandStrategy,
        onlineProfiles: Array.from(this.onlineProfiles.values()),
        existingOpportunities: Array.from(this.prOpportunities.values())
      });
      
      if (detectionResult && detectionResult.opportunities && detectionResult.opportunities.length > 0) {
        this.logger.info("[PersonalBrandingManagementSystem] PR opportunities detected", { count: detectionResult.opportunities.length });
        
        // Add detected opportunities
        const addedOpportunities = [];
        for (const oppData of detectionResult.opportunities) {
          const opportunity = await this.addPrOpportunity({
            title: oppData.title,
            description: oppData.description,
            source: oppData.source || "AI Detection",
            deadline: oppData.deadline
          });
          addedOpportunities.push(opportunity);
        }
        
        return addedOpportunities;
      }
      
      return [];
    } catch (error) {
      this.logger.error("[PersonalBrandingManagementSystem] PR opportunity detection failed", { error: error.message });
      return [];
    }
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

module.exports = PersonalBrandingManagementSystem;
