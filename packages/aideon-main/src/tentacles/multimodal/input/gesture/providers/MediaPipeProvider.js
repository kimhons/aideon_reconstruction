/**
 * @fileoverview MediaPipeProvider implements gesture recognition using Google's MediaPipe library.
 * It focuses on hand tracking and pose estimation to detect various gestures.
 * 
 * This provider leverages MediaPipe's pre-trained models for high accuracy and performance,
 * especially on devices with hardware acceleration.
 * 
 * @author Aideon AI Team
 * @version 1.0.0
 */

const { EventEmitter } = require("events");
const path = require("path");
const { EnhancedAsyncLock } = require("../../utils/EnhancedAsyncLock");
const { EnhancedCancellationToken } = require("../../utils/EnhancedCancellationToken");

// Dynamically import MediaPipe based on environment
let FilesetResolver, HandLandmarker, PoseLandmarker;

/**
 * @typedef {Object} MediaPipeConfig
 * @property {string} modelPath - Base path for MediaPipe model assets
 * @property {string} handModelAssetPath - Path to the hand landmarker model file
 * @property {string} poseModelAssetPath - Path to the pose landmarker model file
 * @property {number} numHands - Maximum number of hands to detect
 * @property {number} minHandDetectionConfidence - Minimum confidence for hand detection
 * @property {number} minHandPresenceConfidence - Minimum confidence for hand presence
 * @property {number} minTrackingConfidence - Minimum confidence for tracking
 * @property {string} delegate - Processing delegate ("CPU", "GPU")
 */

/**
 * MediaPipeProvider implements gesture recognition using MediaPipe.
 */
class MediaPipeProvider extends EventEmitter {
  /**
   * Creates a new MediaPipeProvider instance.
   * 
   * @param {Object} options - Configuration options
   * @param {MediaPipeConfig} options.config - MediaPipe configuration
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.resourceManager - Resource manager for allocation
   */
  constructor(options = {}) {
    super();
    
    this.config = {
      modelPath: options.modelPath || "./node_modules/@mediapipe/tasks-vision/wasm",
      handModelAssetPath: options.handModelAssetPath || "hand_landmarker.task",
      poseModelAssetPath: options.poseModelAssetPath || "pose_landmarker_lite.task",
      numHands: options.numHands || 2,
      minHandDetectionConfidence: options.minHandDetectionConfidence || 0.5,
      minHandPresenceConfidence: options.minHandPresenceConfidence || 0.5,
      minTrackingConfidence: options.minTrackingConfidence || 0.5,
      delegate: options.delegate || "GPU", // Default to GPU if available
      enablePoseDetection: options.enablePoseDetection || false,
      ...(options.config || {})
    };
    
    this.logger = options.logger || console;
    this.resourceManager = options.resourceManager;
    
    // Initialize state
    this.isInitialized = false;
    this.handLandmarker = null;
    this.poseLandmarker = null;
    this.lastFrameTime = -1;
    
    // Gesture detection history for temporal analysis
    this.gestureHistory = new Map(); // Maps handId to array of recent gesture detections
    this.historyMaxLength = 30; // Store ~1 second of history at 30fps
    
    // Create locks
    this.initLock = new EnhancedAsyncLock();
    this.processLock = new EnhancedAsyncLock();
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
    this.detectGestures = this.detectGestures.bind(this);
    this.deriveGesturesFromLandmarks = this.deriveGesturesFromLandmarks.bind(this);
    this.detectHandGestures = this.detectHandGestures.bind(this);
    this.detectPoseGestures = this.detectPoseGestures.bind(this);
    this.updateGestureHistory = this.updateGestureHistory.bind(this);
    this.detectDynamicGestures = this.detectDynamicGestures.bind(this);
  }
  
  /**
   * Initializes the MediaPipeProvider and loads models.
   * 
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize() {
    return await this.initLock.acquire(async () => {
      try {
        if (this.isInitialized) {
          this.logger.info("MediaPipeProvider already initialized");
          return true;
        }
        
        this.logger.info("Initializing MediaPipeProvider");
        
        // Dynamically import MediaPipe tasks vision library
        try {
          const vision = await import("@mediapipe/tasks-vision");
          FilesetResolver = vision.FilesetResolver;
          HandLandmarker = vision.HandLandmarker;
          PoseLandmarker = vision.PoseLandmarker;
        } catch (err) {
          this.logger.error("Failed to import @mediapipe/tasks-vision. Please ensure it's installed.", err);
          throw new Error("MediaPipe library not found");
        }
        
        // Create FilesetResolver
        const visionFilesetResolver = await FilesetResolver.forVisionTasks(this.config.modelPath);
        
        // Create Hand Landmarker
        this.handLandmarker = await HandLandmarker.createFromOptions(visionFilesetResolver, {
          baseOptions: {
            modelAssetPath: this.config.handModelAssetPath,
            delegate: this.config.delegate,
          },
          runningMode: "VIDEO", // Use VIDEO mode for continuous processing
          numHands: this.config.numHands,
          minHandDetectionConfidence: this.config.minHandDetectionConfidence,
          minHandPresenceConfidence: this.config.minHandPresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
        this.logger.info("MediaPipe Hand Landmarker initialized");
        
        // Create Pose Landmarker if enabled
        if (this.config.enablePoseDetection) {
          this.poseLandmarker = await PoseLandmarker.createFromOptions(visionFilesetResolver, {
            baseOptions: {
              modelAssetPath: this.config.poseModelAssetPath,
              delegate: this.config.delegate,
            },
            runningMode: "VIDEO",
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false
          });
          this.logger.info("MediaPipe Pose Landmarker initialized");
        }
        
        this.isInitialized = true;
        this.emit("initialized");
        this.logger.info("MediaPipeProvider initialized successfully");
        return true;
      } catch (error) {
        this.logger.error("Failed to initialize MediaPipeProvider", error);
        this.emit("error", error);
        // Clean up partially initialized resources
        await this.shutdown(); 
        return false;
      }
    });
  }
  
  /**
   * Shuts down the MediaPipeProvider and releases resources.
   * 
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    return await this.initLock.acquire(async () => {
      try {
        if (!this.isInitialized && !this.handLandmarker && !this.poseLandmarker) {
          this.logger.info("MediaPipeProvider not initialized or already shut down");
          return true;
        }
        
        this.logger.info("Shutting down MediaPipeProvider");
        
        // Close landmarkers
        if (this.handLandmarker) {
          await this.handLandmarker.close();
          this.handLandmarker = null;
          this.logger.info("Closed Hand Landmarker");
        }
        if (this.poseLandmarker) {
          await this.poseLandmarker.close();
          this.poseLandmarker = null;
          this.logger.info("Closed Pose Landmarker");
        }
        
        // Clear gesture history
        this.gestureHistory.clear();
        
        this.isInitialized = false;
        this.emit("shutdown");
        this.logger.info("MediaPipeProvider shut down successfully");
        return true;
      } catch (error) {
        this.logger.error("Failed to shut down MediaPipeProvider", error);
        this.emit("error", error);
        return false;
      }
    });
  }
  
  /**
   * Detects gestures in a video frame using MediaPipe.
   * 
   * @param {Object} frameData - Frame data object
   * @param {ImageData|HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} frameData.frame - Input frame
   * @param {number} frameData.timestamp - Timestamp of the frame in milliseconds
   * @returns {Promise<Object>} - Detection results including landmarks and derived gestures
   */
  async detectGestures(frameData) {
    return await this.processLock.acquire(async () => {
      try {
        if (!this.isInitialized || !this.handLandmarker) {
          throw new Error("MediaPipeProvider not initialized or Hand Landmarker unavailable");
        }
        
        const frame = frameData.frame;
        let timestamp = frameData.timestamp;
        
        // Ensure timestamp is increasing for VIDEO mode
        if (timestamp <= this.lastFrameTime) {
          timestamp = this.lastFrameTime + 1;
        }
        this.lastFrameTime = timestamp;
        
        // Detect hand landmarks
        const handResults = this.handLandmarker.detectForVideo(frame, timestamp);
        
        // Detect pose landmarks if enabled
        let poseResults = null;
        if (this.poseLandmarker && this.config.enablePoseDetection) {
          poseResults = this.poseLandmarker.detectForVideo(frame, timestamp);
        }
        
        // Derive gestures from landmarks
        const derivedGestures = this.deriveGesturesFromLandmarks(handResults, poseResults, timestamp);
        
        const result = {
          provider: "mediapipe",
          timestamp: Date.now(),
          handLandmarks: handResults.landmarks || [],
          handedness: handResults.handedness || [],
          poseLandmarks: poseResults ? poseResults.landmarks : [],
          gestures: derivedGestures
        };
        
        this.emit("gesturesDetected", result);
        return result;
        
      } catch (error) {
        // Handle specific MediaPipe errors if necessary
        this.logger.error("Error detecting gestures with MediaPipe", error);
        this.emit("error", error);
        // Return an empty result
        return {
          provider: "mediapipe",
          timestamp: Date.now(),
          handLandmarks: [],
          handedness: [],
          gestures: [],
          error: error.message
        };
      }
    });
  }
  
  /**
   * Derives specific gestures from detected landmarks.
   * 
   * @private
   * @param {Object} handResults - Results from HandLandmarker
   * @param {Object} poseResults - Results from PoseLandmarker (optional)
   * @param {number} timestamp - Current frame timestamp
   * @returns {Array<Object>} - List of derived gestures with confidence scores
   */
  deriveGesturesFromLandmarks(handResults, poseResults, timestamp) {
    let gestures = [];
    
    // Detect hand gestures
    if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
      const handGestures = this.detectHandGestures(handResults, timestamp);
      gestures = gestures.concat(handGestures);
    }
    
    // Detect pose gestures if available
    if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
      const poseGestures = this.detectPoseGestures(poseResults, timestamp);
      gestures = gestures.concat(poseGestures);
    }
    
    // Detect dynamic gestures that span multiple frames
    const dynamicGestures = this.detectDynamicGestures(timestamp);
    gestures = gestures.concat(dynamicGestures);
    
    return gestures;
  }
  
  /**
   * Detects hand gestures from hand landmarks.
   * 
   * @private
   * @param {Object} handResults - Results from HandLandmarker
   * @param {number} timestamp - Current frame timestamp
   * @returns {Array<Object>} - List of detected hand gestures
   */
  detectHandGestures(handResults, timestamp) {
    const gestures = [];
    
    // Process each detected hand
    for (let i = 0; i < handResults.landmarks.length; i++) {
      const landmarks = handResults.landmarks[i];
      const handedness = handResults.handedness[i] && handResults.handedness[i][0] 
        ? handResults.handedness[i][0].categoryName 
        : "Unknown";
      const handConfidence = handResults.handedness[i] && handResults.handedness[i][0]
        ? handResults.handedness[i][0].score
        : 0.5;
      
      // Generate a unique ID for this hand to track across frames
      const handId = `${handedness}-${i}`;
      
      // Skip if we don't have enough landmarks
      if (landmarks.length < 21) {
        continue;
      }
      
      // Extract key landmarks for gesture detection
      const wrist = landmarks[0];
      const thumbCmc = landmarks[1];
      const thumbMcp = landmarks[2];
      const thumbIp = landmarks[3];
      const thumbTip = landmarks[4];
      
      const indexMcp = landmarks[5];
      const indexPip = landmarks[6];
      const indexDip = landmarks[7];
      const indexTip = landmarks[8];
      
      const middleMcp = landmarks[9];
      const middlePip = landmarks[10];
      const middleDip = landmarks[11];
      const middleTip = landmarks[12];
      
      const ringMcp = landmarks[13];
      const ringPip = landmarks[14];
      const ringDip = landmarks[15];
      const ringTip = landmarks[16];
      
      const pinkyMcp = landmarks[17];
      const pinkyPip = landmarks[18];
      const pinkyDip = landmarks[19];
      const pinkyTip = landmarks[20];
      
      // Calculate palm center
      const palmCenter = {
        x: (indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 4,
        y: (indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 4,
        z: (indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 4
      };
      
      // Calculate finger extensions (whether fingers are extended or curled)
      const thumbExtended = this.isFingerExtended(wrist, thumbMcp, thumbIp, thumbTip);
      const indexExtended = this.isFingerExtended(wrist, indexMcp, indexPip, indexTip);
      const middleExtended = this.isFingerExtended(wrist, middleMcp, middlePip, middleTip);
      const ringExtended = this.isFingerExtended(wrist, ringMcp, ringPip, ringTip);
      const pinkyExtended = this.isFingerExtended(wrist, pinkyMcp, pinkyPip, pinkyTip);
      
      // Calculate distances between fingertips
      const thumbIndexDistance = this.calculateDistance(thumbTip, indexTip);
      const thumbMiddleDistance = this.calculateDistance(thumbTip, middleTip);
      const indexMiddleDistance = this.calculateDistance(indexTip, middleTip);
      const middleRingDistance = this.calculateDistance(middleTip, ringTip);
      const ringPinkyDistance = this.calculateDistance(ringTip, pinkyTip);
      
      // Calculate angles between fingers
      const thumbIndexAngle = this.calculateAngle(wrist, thumbTip, indexTip);
      const indexMiddleAngle = this.calculateAngle(wrist, indexTip, middleTip);
      const middleRingAngle = this.calculateAngle(wrist, middleTip, ringTip);
      const ringPinkyAngle = this.calculateAngle(wrist, ringTip, pinkyTip);
      
      // Detect Open Palm gesture
      if (indexExtended && middleExtended && ringExtended && pinkyExtended && 
          thumbExtended && thumbIndexDistance > 0.1) {
        gestures.push({
          name: "Open Palm",
          hand: handedness,
          confidence: this.calculateConfidence(0.9, handConfidence, [
            indexExtended, middleExtended, ringExtended, pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Closed Fist gesture
      if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        gestures.push({
          name: "Closed Fist",
          hand: handedness,
          confidence: this.calculateConfidence(0.9, handConfidence, [
            !indexExtended, !middleExtended, !ringExtended, !pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Pointing gesture (index finger extended, others curled)
      if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
        gestures.push({
          name: "Pointing",
          hand: handedness,
          confidence: this.calculateConfidence(0.9, handConfidence, [
            indexExtended, !middleExtended, !ringExtended, !pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            direction: this.calculatePointingDirection(wrist, indexTip),
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Pinch gesture (thumb and index finger close together)
      if (thumbIndexDistance < 0.05) {
        gestures.push({
          name: "Pinch",
          hand: handedness,
          confidence: this.calculateConfidence(0.85, handConfidence, [
            thumbIndexDistance < 0.05
          ]),
          timestamp,
          handId,
          details: {
            distance: thumbIndexDistance,
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Victory/Peace sign (index and middle fingers extended in V shape)
      if (indexExtended && middleExtended && !ringExtended && !pinkyExtended && 
          indexMiddleDistance > 0.1) {
        gestures.push({
          name: "Victory",
          hand: handedness,
          confidence: this.calculateConfidence(0.85, handConfidence, [
            indexExtended, middleExtended, !ringExtended, !pinkyExtended, indexMiddleDistance > 0.1
          ]),
          timestamp,
          handId,
          details: {
            angle: indexMiddleAngle,
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Thumbs Up gesture
      if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended &&
          this.isThumbUp(wrist, thumbTip, palmCenter)) {
        gestures.push({
          name: "Thumbs Up",
          hand: handedness,
          confidence: this.calculateConfidence(0.8, handConfidence, [
            thumbExtended, !indexExtended, !middleExtended, !ringExtended, !pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Thumbs Down gesture
      if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended &&
          this.isThumbDown(wrist, thumbTip, palmCenter)) {
        gestures.push({
          name: "Thumbs Down",
          hand: handedness,
          confidence: this.calculateConfidence(0.8, handConfidence, [
            thumbExtended, !indexExtended, !middleExtended, !ringExtended, !pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect OK sign (thumb and index finger forming a circle)
      if (this.isOkSign(thumbTip, indexTip, indexMcp)) {
        gestures.push({
          name: "OK Sign",
          hand: handedness,
          confidence: this.calculateConfidence(0.8, handConfidence, [
            thumbIndexDistance < 0.08
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Detect Rock & Roll sign (index and pinky extended, others curled)
      if (indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
        gestures.push({
          name: "Rock Sign",
          hand: handedness,
          confidence: this.calculateConfidence(0.85, handConfidence, [
            indexExtended, !middleExtended, !ringExtended, pinkyExtended
          ]),
          timestamp,
          handId,
          details: {
            fingersExtended: [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended]
          }
        });
      }
      
      // Update gesture history for this hand
      this.updateGestureHistory(handId, gestures.filter(g => g.handId === handId), timestamp);
    }
    
    return gestures;
  }
  
  /**
   * Detects pose gestures from pose landmarks.
   * 
   * @private
   * @param {Object} poseResults - Results from PoseLandmarker
   * @param {number} timestamp - Current frame timestamp
   * @returns {Array<Object>} - List of detected pose gestures
   */
  detectPoseGestures(poseResults, timestamp) {
    const gestures = [];
    
    // Skip if pose detection is not enabled or no poses detected
    if (!this.config.enablePoseDetection || !poseResults.landmarks || poseResults.landmarks.length === 0) {
      return gestures;
    }
    
    // Process each detected pose
    for (let i = 0; i < poseResults.landmarks.length; i++) {
      const landmarks = poseResults.landmarks[i];
      
      // Skip if we don't have enough landmarks
      if (landmarks.length < 33) {
        continue;
      }
      
      // Extract key landmarks for pose detection
      // MediaPipe Pose model provides 33 landmarks
      const nose = landmarks[0];
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13];
      const rightElbow = landmarks[14];
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      
      // Calculate shoulder width for normalization
      const shoulderWidth = this.calculateDistance(leftShoulder, rightShoulder);
      
      // Detect Arms Raised gesture
      if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
        const leftArmRaised = (leftShoulder.y - leftWrist.y) / shoulderWidth > 0.5;
        const rightArmRaised = (rightShoulder.y - rightWrist.y) / shoulderWidth > 0.5;
        
        if (leftArmRaised && rightArmRaised) {
          gestures.push({
            name: "Arms Raised",
            confidence: 0.8,
            timestamp,
            poseId: `pose-${i}`,
            details: {
              leftArmHeight: (leftShoulder.y - leftWrist.y) / shoulderWidth,
              rightArmHeight: (rightShoulder.y - rightWrist.y) / shoulderWidth
            }
          });
        }
      }
      
      // Detect T-Pose gesture
      const leftArmExtended = Math.abs(leftWrist.y - leftShoulder.y) / shoulderWidth < 0.3 &&
                             (leftWrist.x - leftShoulder.x) / shoulderWidth > 0.7;
      const rightArmExtended = Math.abs(rightWrist.y - rightShoulder.y) / shoulderWidth < 0.3 &&
                              (rightShoulder.x - rightWrist.x) / shoulderWidth > 0.7;
      
      if (leftArmExtended && rightArmExtended) {
        gestures.push({
          name: "T-Pose",
          confidence: 0.8,
          timestamp,
          poseId: `pose-${i}`,
          details: {
            leftArmExtension: (leftWrist.x - leftShoulder.x) / shoulderWidth,
            rightArmExtension: (rightShoulder.x - rightWrist.x) / shoulderWidth
          }
        });
      }
    }
    
    return gestures;
  }
  
  /**
   * Detects dynamic gestures that span multiple frames.
   * 
   * @private
   * @param {number} timestamp - Current frame timestamp
   * @returns {Array<Object>} - List of detected dynamic gestures
   */
  detectDynamicGestures(timestamp) {
    const gestures = [];
    
    // Process each hand's gesture history
    for (const [handId, history] of this.gestureHistory.entries()) {
      // Skip if we don't have enough history
      if (history.length < 10) {
        continue;
      }
      
      // Get the most recent gestures
      const recentHistory = history.slice(-15);
      
      // Extract hand information from the most recent gesture
      const handedness = recentHistory[recentHistory.length - 1].hand;
      
      // Detect Wave gesture (alternating Open Palm and Closed Fist)
      let waveDetected = false;
      let waveTransitions = 0;
      let lastGesture = null;
      
      for (const gesture of recentHistory) {
        if ((gesture.name === "Open Palm" || gesture.name === "Closed Fist") && 
            lastGesture && gesture.name !== lastGesture) {
          waveTransitions++;
        }
        lastGesture = gesture.name;
      }
      
      if (waveTransitions >= 3) {
        waveDetected = true;
      }
      
      if (waveDetected) {
        gestures.push({
          name: "Wave",
          hand: handedness,
          confidence: 0.7 + (Math.min(waveTransitions, 6) / 20), // Higher confidence with more transitions
          timestamp,
          handId,
          isDynamic: true,
          details: {
            transitions: waveTransitions
          }
        });
      }
      
      // Detect Swipe gesture (consistent movement in one direction)
      const xPositions = recentHistory.map(g => g.details?.position?.x).filter(x => x !== undefined);
      const yPositions = recentHistory.map(g => g.details?.position?.y).filter(y => y !== undefined);
      
      if (xPositions.length >= 10 && yPositions.length >= 10) {
        // Calculate movement in x and y directions
        const xDiff = xPositions[xPositions.length - 1] - xPositions[0];
        const yDiff = yPositions[yPositions.length - 1] - yPositions[0];
        
        // Check if movement is primarily in one direction and significant enough
        const movementMagnitude = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
        
        if (movementMagnitude > 0.3) { // Significant movement threshold
          let swipeDirection = "";
          
          // Determine swipe direction
          if (Math.abs(xDiff) > Math.abs(yDiff) * 2) {
            // Horizontal swipe
            swipeDirection = xDiff > 0 ? "Right" : "Left";
          } else if (Math.abs(yDiff) > Math.abs(xDiff) * 2) {
            // Vertical swipe
            swipeDirection = yDiff > 0 ? "Down" : "Up";
          }
          
          if (swipeDirection) {
            gestures.push({
              name: `Swipe ${swipeDirection}`,
              hand: handedness,
              confidence: 0.7 + (Math.min(movementMagnitude, 0.6) / 2), // Higher confidence with more movement
              timestamp,
              handId,
              isDynamic: true,
              details: {
                direction: swipeDirection,
                magnitude: movementMagnitude
              }
            });
          }
        }
      }
    }
    
    return gestures;
  }
  
  /**
   * Updates the gesture history for a specific hand.
   * 
   * @private
   * @param {string} handId - Unique identifier for the hand
   * @param {Array<Object>} gestures - Detected gestures for this hand
   * @param {number} timestamp - Current frame timestamp
   */
  updateGestureHistory(handId, gestures, timestamp) {
    // Initialize history array if it doesn't exist
    if (!this.gestureHistory.has(handId)) {
      this.gestureHistory.set(handId, []);
    }
    
    const history = this.gestureHistory.get(handId);
    
    // Add position information to gestures for tracking movement
    const enrichedGestures = gestures.map(gesture => {
      // Find the corresponding hand landmarks
      const handLandmarks = this.handLandmarker.lastHandLandmarks;
      if (handLandmarks && handLandmarks.length > 0) {
        for (let i = 0; i < handLandmarks.length; i++) {
          const handedness = this.handLandmarker.lastHandedness[i][0].categoryName;
          const handIdMatch = `${handedness}-${i}`;
          
          if (handIdMatch === handId && handLandmarks[i].length > 0) {
            // Use wrist position as the hand position
            const wrist = handLandmarks[i][0];
            return {
              ...gesture,
              details: {
                ...gesture.details,
                position: { x: wrist.x, y: wrist.y, z: wrist.z }
              }
            };
          }
        }
      }
      return gesture;
    });
    
    // Add gestures to history
    if (enrichedGestures.length > 0) {
      history.push(...enrichedGestures);
    }
    
    // Trim history to maximum length
    if (history.length > this.historyMaxLength) {
      history.splice(0, history.length - this.historyMaxLength);
    }
    
    // Remove old entries (older than 2 seconds)
    const oldestAllowedTimestamp = timestamp - 2000;
    const firstValidIndex = history.findIndex(g => g.timestamp >= oldestAllowedTimestamp);
    if (firstValidIndex > 0) {
      history.splice(0, firstValidIndex);
    }
  }
  
  /**
   * Calculates the distance between two 3D points.
   * 
   * @private
   * @param {Object} p1 - First point with x, y, z coordinates
   * @param {Object} p2 - Second point with x, y, z coordinates
   * @returns {number} - Euclidean distance between the points
   */
  calculateDistance(p1, p2) {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2)
    );
  }
  
  /**
   * Calculates the angle between three 3D points.
   * 
   * @private
   * @param {Object} p1 - First point with x, y, z coordinates
   * @param {Object} p2 - Second point (vertex) with x, y, z coordinates
   * @param {Object} p3 - Third point with x, y, z coordinates
   * @returns {number} - Angle in radians
   */
  calculateAngle(p1, p2, p3) {
    // Calculate vectors
    const v1 = {
      x: p1.x - p2.x,
      y: p1.y - p2.y,
      z: p1.z - p2.z
    };
    
    const v2 = {
      x: p3.x - p2.x,
      y: p3.y - p2.y,
      z: p3.z - p2.z
    };
    
    // Calculate dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    
    // Calculate magnitudes
    const v1Mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const v2Mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    
    // Calculate angle
    const cosAngle = dotProduct / (v1Mag * v2Mag);
    
    // Handle numerical precision issues
    if (cosAngle > 1.0) return 0;
    if (cosAngle < -1.0) return Math.PI;
    
    return Math.acos(cosAngle);
  }
  
  /**
   * Determines if a finger is extended based on its landmarks.
   * 
   * @private
   * @param {Object} wrist - Wrist landmark
   * @param {Object} mcp - Metacarpophalangeal joint landmark
   * @param {Object} pip - Proximal interphalangeal joint landmark
   * @param {Object} tip - Fingertip landmark
   * @returns {boolean} - True if the finger is extended
   */
  isFingerExtended(wrist, mcp, pip, tip) {
    // Calculate distances
    const wristToMcp = this.calculateDistance(wrist, mcp);
    const mcpToTip = this.calculateDistance(mcp, tip);
    const wristToTip = this.calculateDistance(wrist, tip);
    
    // Calculate straightness ratio
    // If finger is straight, wristToTip should be close to wristToMcp + mcpToTip
    const straightnessRatio = wristToTip / (wristToMcp + mcpToTip);
    
    // Calculate the angle at the PIP joint
    const pipAngle = this.calculateAngle(mcp, pip, tip);
    
    // A finger is extended if it's relatively straight and the PIP angle is not too bent
    return straightnessRatio > 0.7 && pipAngle > 2.5;
  }
  
  /**
   * Determines if the thumb is pointing up.
   * 
   * @private
   * @param {Object} wrist - Wrist landmark
   * @param {Object} thumbTip - Thumb tip landmark
   * @param {Object} palmCenter - Calculated palm center
   * @returns {boolean} - True if thumb is pointing up
   */
  isThumbUp(wrist, thumbTip, palmCenter) {
    // Thumb is up if the tip is significantly higher than the wrist
    // and not too far to the side
    return (wrist.y - thumbTip.y) > 0.1 && 
           Math.abs(thumbTip.x - palmCenter.x) < 0.2;
  }
  
  /**
   * Determines if the thumb is pointing down.
   * 
   * @private
   * @param {Object} wrist - Wrist landmark
   * @param {Object} thumbTip - Thumb tip landmark
   * @param {Object} palmCenter - Calculated palm center
   * @returns {boolean} - True if thumb is pointing down
   */
  isThumbDown(wrist, thumbTip, palmCenter) {
    // Thumb is down if the tip is significantly lower than the wrist
    // and not too far to the side
    return (thumbTip.y - wrist.y) > 0.1 && 
           Math.abs(thumbTip.x - palmCenter.x) < 0.2;
  }
  
  /**
   * Determines if the hand is making an OK sign.
   * 
   * @private
   * @param {Object} thumbTip - Thumb tip landmark
   * @param {Object} indexTip - Index fingertip landmark
   * @param {Object} indexMcp - Index finger MCP joint landmark
   * @returns {boolean} - True if the hand is making an OK sign
   */
  isOkSign(thumbTip, indexTip, indexMcp) {
    // OK sign is formed when thumb and index fingertips are close together
    // and form a circular shape
    const tipDistance = this.calculateDistance(thumbTip, indexTip);
    const indexLength = this.calculateDistance(indexMcp, indexTip);
    
    // Tips should be close together relative to finger length
    return tipDistance < indexLength * 0.3;
  }
  
  /**
   * Calculates the pointing direction of the index finger.
   * 
   * @private
   * @param {Object} wrist - Wrist landmark
   * @param {Object} indexTip - Index fingertip landmark
   * @returns {Object} - Direction vector normalized to unit length
   */
  calculatePointingDirection(wrist, indexTip) {
    // Calculate direction vector from wrist to index tip
    const direction = {
      x: indexTip.x - wrist.x,
      y: indexTip.y - wrist.y,
      z: indexTip.z - wrist.z
    };
    
    // Calculate magnitude
    const magnitude = Math.sqrt(
      direction.x * direction.x +
      direction.y * direction.y +
      direction.z * direction.z
    );
    
    // Normalize to unit vector
    if (magnitude > 0) {
      direction.x /= magnitude;
      direction.y /= magnitude;
      direction.z /= magnitude;
    }
    
    return direction;
  }
  
  /**
   * Calculates a confidence score based on multiple factors.
   * 
   * @private
   * @param {number} baseConfidence - Base confidence for the gesture
   * @param {number} handConfidence - Confidence of hand detection
   * @param {Array<boolean>} conditions - Array of boolean conditions that should be true
   * @returns {number} - Combined confidence score between 0 and 1
   */
  calculateConfidence(baseConfidence, handConfidence, conditions) {
    // Start with base confidence
    let confidence = baseConfidence;
    
    // Adjust based on hand detection confidence
    confidence *= handConfidence;
    
    // Adjust based on how many conditions are met
    const trueConditions = conditions.filter(c => c).length;
    const conditionFactor = trueConditions / conditions.length;
    confidence *= (0.5 + 0.5 * conditionFactor); // Scale to ensure minimum 50% of original confidence
    
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }
}

// Add module.exports at the end of the file
module.exports = { MediaPipeProvider };
