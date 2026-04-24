/**
 * Shared types for the OceanAI app.
 */

export interface FishAnalysisResult {
  species: string;
  scientificName: string;
  confidence: number;
  qualityGrade: "Premium" | "Standard" | "Low";
  isSustainable: boolean;
  measurements: {
    length_mm: number;
    weight_g: number;
    width_mm: number;
  };
  compliance: {
    is_legal_size: boolean;
    min_legal_size_mm: number;
  };
  marketEstimate: {
    price_per_kg: number;
    estimated_value: number;
  };
  weightEstimate: number;
  weightConfidence: number;
  marketPriceEstimate: number;
  timestamp: string;
  debugUrls?: {
    yoloImageUrl: string | null;
    cropImageUrl: string | null;
    gradcamUrl: string | null;
  };
}

export interface ChatMessage {
  chatId: string;
  userId: string;
  message: string;
  response: string;
  timestamp: string;
}

// ── ML API Response Types ─────────────────────────────────────────────────────

export interface MLPrediction {
  label: string;
  confidence: number;
  gradcam_url: string;
}

export interface MLCropResult {
  bbox: number[];
  crop_url: string;
  species: MLPrediction;
  disease: MLPrediction;
  yolo_confidence: number;
}

// ── Group Analysis Types ──────────────────────────────────────────────────────

export interface GroupAnalysis {
  images: Array<{
    imageIndex: number;
    s3Key: string;
    crops: Record<string, MLCropResult>;
    yolo_image_url: string;
    error?: string;
  }>;
  aggregateStats: {
    totalFishCount: number;
    speciesDistribution: Record<string, number>;
    averageConfidence: number;
    diseaseDetected: boolean;
    totalEstimatedWeight: number;
    totalEstimatedValue: number;
  };
  detections?: Array<{
    cropUrl: string;
    species: string;
    confidence: number;
    diseaseStatus: string;
    diseaseConfidence: number;
    weight: number;
    value: number;
    gradcamUrls: {
      species: string;
      disease: string;
    };
  }>;
  yoloVisualizationUrls?: string[];
  processedAt: string;
}

// ── User Profile Types ────────────────────────────────────────────────────────

export interface UserPreferences {
  language: string;
  notifications: boolean;
  offlineSync: boolean;
  units: string;
  boatType?: string;
  // Extended preferences for PreferencesManager
  unitsExtended?: {
    weight: "kg" | "lb";
    temperature: "celsius" | "fahrenheit";
    distance: "km" | "mi";
  };
  notificationsExtended?: {
    pushEnabled: boolean;
    disasterAlerts: boolean;
    analysisComplete: boolean;
    chatMessages: boolean;
  };
  offlineSyncExtended?: {
    autoSync: boolean;
    syncOnWifiOnly: boolean;
    cacheSize: "small" | "medium" | "large";
  };
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string; // presigned URL from backend
  port?: string;
  customPort?: string;
  region?: string;
  boatType?: string;
  role?:
    | "Fisherman"
    | "Boat Owner"
    | "Fish Trader"
    | "Cooperative Member"
    | "Researcher";
  publicProfileEnabled: boolean;
  publicProfileSlug?: string;
  showPublicStats?: boolean;
  preferences: UserPreferences; // Embedded preferences
  createdAt: string;
  updatedAt?: string;
}

export interface PublicProfile {
  slug: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  port?: string;
  region?: string;
  isPublic: boolean;
  showStats: boolean;
  stats?: {
    totalCatches: number;
    speciesCount: number;
    totalEarnings: number;
    speciesDistribution: Record<string, number>;
  };
  createdAt: string;
}

// ── Avatar and Upload Types ───────────────────────────────────────────────────

export interface AvatarUpload {
  userId: string;
  imageUri: string;
  uploadUrl: string;
  s3Key: string;
  status: "pending" | "uploading" | "completed" | "failed";
  progress: number;
  error?: string;
}

// ── Sync Queue Types ──────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string;
  type:
    | "profile_update"
    | "preferences_update"
    | "avatar_upload"
    | "weight_estimate";
  payload: any;
  timestamp: string;
  retryCount: number;
  status: "pending" | "syncing" | "completed" | "failed";
  error?: string;
}

// ── Export Types ──────────────────────────────────────────────────────────────

export interface PDFExportOptions {
  groupId?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  includeCharts: boolean;
  includeImages: boolean;
  format: "A4" | "Letter";
}

export interface DataExportOptions {
  format: "csv" | "json";
  includeAnalysis: boolean;
  includeChat: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

// ── Weather and Ocean Data Types ──────────────────────────────────────────────

export interface WeatherData {
  location: { latitude: number; longitude: number };
  temperature: number;
  windSpeed: number;
  windDirection: number;
  waveHeight: number;
  visibility: number;
  seaState: string;
  timestamp: string;
}

export interface FishingZone {
  zoneId: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  health: "excellent" | "good" | "fair" | "poor";
  topSpecies: string[];
  avgTemperature: number;
  catchCount: number;
  advisory?: string;
  lastUpdated: string;
}

export interface DisasterAlert {
  alertId: string;
  type: "cyclone" | "tsunami" | "storm" | "advisory";
  severity: "low" | "medium" | "high" | "critical";
  location: { latitude: number; longitude: number };
  radius: number;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

// ── History and Group Types ───────────────────────────────────────────────────

export interface GroupRecord {
  groupId: string;
  userId: string;
  imageCount: number;
  s3Keys: string[];
  presignedViewUrls?: string[]; // Only available from getGroupDetails, not from list
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  latitude?: number;
  longitude?: number;
  locationMapped?: boolean;
  locationMapReason?: string;
  analysisResult?: GroupAnalysis;
  weightEstimates?: Record<string, any>;
}

export interface FishDetection {
  cropUrl: string;
  species: string;
  confidence: number;
  diseaseStatus: string;
  diseaseConfidence: number;
  weight: number;
  value: number;
  gradcamUrls: {
    species: string;
    disease: string;
  };
}

// ── API Response Types ────────────────────────────────────────────────────────

export interface GroupListResponse {
  groups: GroupRecord[];
}
