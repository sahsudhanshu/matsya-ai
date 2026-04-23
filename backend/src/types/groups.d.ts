/**
 * TypeScript type definitions for Multiple Image Group Analysis feature
 * 
 * These interfaces define the data models for group-based fish image analysis,
 * matching the DynamoDB schema and ML API response structures.
 */

/**
 * Status enum for group processing lifecycle
 * 
 * - pending: Group created, awaiting image uploads
 * - processing: ML analysis in progress
 * - completed: All images successfully analyzed
 * - partial: Some images succeeded, some failed
 * - failed: All images failed analysis
 */
export type GroupStatus = "pending" | "processing" | "completed" | "partial" | "failed";

/**
 * Individual fish crop result from ML API
 * Contains bounding box, crop image URL, species classification, and disease detection
 * 
 * Validates: Requirements 5.4, 5.5, 5.6
 */
export interface MLCropResult {
  /** Bounding box coordinates [x1, y1, x2, y2] */
  bbox: [number, number, number, number];
  
  /** URL to the cropped fish image */
  crop_url: string;
  
  /** Disease detection result */
  disease: {
    /** Confidence score (0-1) */
    confidence: number;
    /** URL to GradCAM visualization for disease detection */
    gradcam_url: string;
    /** Disease label (e.g., "Healthy Fish", "Parasitic Disease") */
    label: string;
  };
  
  /** Species classification result */
  species: {
    /** Confidence score (0-1) */
    confidence: number;
    /** URL to GradCAM visualization for species classification */
    gradcam_url: string;
    /** Species label (e.g., "Bangus", "Tilapia") */
    label: string;
  };
  
  /** YOLO object detection confidence score */
  yolo_confidence: number;
}

/**
 * Analysis result for a single image in the group
 * Contains all fish detections and YOLO visualization for one uploaded image
 * 
 * Validates: Requirements 5.5, 5.6
 */
export interface ImageAnalysis {
  /** Index of the image in the group (0-based) */
  imageIndex: number;
  
  /** S3 key where the original image is stored */
  s3Key: string;
  
  /** Dictionary of fish crops detected in this image */
  crops: Record<string, MLCropResult>;
  
  /** URL to YOLO detection visualization showing all fish bounding boxes */
  yolo_image_url: string;
  
  /** Error message if analysis failed for this image */
  error?: string;
}

/**
 * Aggregate statistics across all images in the group
 * Provides summary metrics for the entire catch
 * 
 * Validates: Requirements 5.6
 */
export interface AggregateStats {
  /** Total number of fish detected across all images */
  totalFishCount: number;
  
  /** Count of each species detected (species name -> count) */
  speciesDistribution: Record<string, number>;
  
  /** Average confidence score across all species classifications */
  averageConfidence: number;
  
  /** Whether any diseased fish were detected in the group */
  diseaseDetected: boolean;
  
  /** Total estimated weight in kilograms */
  totalEstimatedWeight: number;
  
  /** Total estimated market value in local currency */
  totalEstimatedValue: number;
}

/**
 * Combined analysis results for all images in a group
 * Contains individual image results and aggregate statistics
 * 
 * Validates: Requirements 5.5, 5.6
 */
export interface GroupAnalysis {
  /** Array of analysis results for each image */
  images: ImageAnalysis[];
  
  /** Aggregate statistics across all images */
  aggregateStats: AggregateStats;
  
  /** ISO 8601 timestamp when analysis was completed */
  processedAt: string;
}

/**
 * Error information for a failed image
 */
export interface ImageError {
  /** Index of the failed image */
  imageIndex: number;
  
  /** Error message */
  error: string;
  
  /** ISO 8601 timestamp when error occurred */
  timestamp: string;
}

/**
 * DynamoDB record structure for image groups
 * Stores group metadata, S3 references, and analysis results
 * 
 * Table: ai-bharat-groups
 * Primary Key: groupId (partition key)
 * GSI: userId-createdAt-index (userId partition key, createdAt sort key)
 * 
 * Validates: Requirements 5.4, 5.5, 5.6, 5.9
 */
export interface GroupRecord {
  // Primary key
  /** Unique group identifier (UUID) - DynamoDB partition key */
  groupId: string;
  
  // User identification
  /** User ID from Cognito (sub claim) - GSI partition key */
  userId: string;
  
  // Timestamps
  /** ISO 8601 timestamp when group was created - GSI sort key */
  createdAt: string;
  
  /** ISO 8601 timestamp when group was last updated */
  updatedAt: string;
  
  // Group metadata
  /** Number of images in the group */
  imageCount: number;
  
  /** Current processing status */
  status: GroupStatus;
  
  // S3 references
  /** Array of S3 keys for all images in the group */
  s3Keys: string[];
  
  // Location data (optional, from first image with location)
  /** Latitude coordinate */
  latitude?: number;
  
  /** Longitude coordinate */
  longitude?: number;
  
  /** Whether location was successfully mapped */
  locationMapped?: boolean;
  
  /** Reason for location mapping result */
  locationMapReason?: string;
  
  // Analysis result (populated after ML processing)
  /** Complete analysis results for all images */
  analysisResult?: GroupAnalysis;
  
  // Error tracking
  /** Array of errors for failed images */
  errors?: ImageError[];
}
