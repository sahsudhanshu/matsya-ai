import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

const AVATAR_CACHE_DIR = `${FileSystem.cacheDirectory}avatars/`;
const MAX_AVATAR_SIZE = 500 * 1024; // 500KB
const AVATAR_DIMENSIONS = 512;

/**
 * Service for handling avatar image operations
 */
export class AvatarService {
  /**
   * Initialize avatar cache directory
   */
  static async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(AVATAR_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AVATAR_CACHE_DIR, {
        intermediates: true,
      });
    }
  }

  /**
   * Pick image from library or camera
   */
  static async pickImage(source: "camera" | "library"): Promise<string | null> {
    const permissionResult =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      throw new Error("Permission denied");
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images" as any,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (result.canceled) return null;
    return result.assets[0].uri;
  }

  /**
   * Compress and resize image
   */
  static async processImage(uri: string): Promise<string> {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: AVATAR_DIMENSIONS, height: AVATAR_DIMENSIONS } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    // Check file size
    const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
    if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_AVATAR_SIZE) {
      // Compress more aggressively
      const recompressed = await ImageManipulator.manipulateAsync(
        manipResult.uri,
        [],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      return recompressed.uri;
    }

    return manipResult.uri;
  }

  /**
   * Upload avatar to S3
   */
  static async uploadAvatar(
    imageUri: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    // Ensure cache directory exists
    await this.initialize();

    // Import API functions
    const { getAvatarPresignedUrl, uploadToS3, updateAvatarUrl } =
      await import("./api-client");

    // Process image
    const processedUri = await this.processImage(imageUri);

    // Get presigned URL
    const fileName = `avatar-${Date.now()}.jpg`;
    const { uploadUrl, avatarUrl } = await getAvatarPresignedUrl(
      fileName,
      "image/jpeg",
    );

    // Upload to S3
    await uploadToS3(uploadUrl, processedUri, "image/jpeg", onProgress);

    // Update profile with new avatar URL
    await updateAvatarUrl(avatarUrl);

    // Cache avatar locally
    await this.cacheAvatar(avatarUrl, processedUri);

    return avatarUrl;
  }

  /**
   * Remove avatar from profile
   */
  static async removeAvatar(): Promise<void> {
    const { removeAvatar } = await import("./api-client");
    await removeAvatar();
  }

  /**
   * Get cached avatar path
   */
  static async getCachedAvatar(url: string): Promise<string | null> {
    const fileName = this.getFileNameFromUrl(url);
    const localPath = `${AVATAR_CACHE_DIR}${fileName}`;

    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }

    return null;
  }

  /**
   * Cache avatar from URL
   */
  static async cacheAvatar(url: string, localUri?: string): Promise<string> {
    // Ensure cache directory exists
    await this.initialize();

    const fileName = this.getFileNameFromUrl(url);
    const localPath = `${AVATAR_CACHE_DIR}${fileName}`;

    if (localUri) {
      // Copy from local URI
      await FileSystem.copyAsync({ from: localUri, to: localPath });
    } else {
      // Download from URL
      await FileSystem.downloadAsync(url, localPath);
    }

    return localPath;
  }

  /**
   * Clear avatar cache
   */
  static async clearCache(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(AVATAR_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(AVATAR_CACHE_DIR, { idempotent: true });
      await this.initialize();
    }
  }

  /**
   * Extract filename from URL
   */
  private static getFileNameFromUrl(url: string): string {
    const parts = url.split("/");
    return parts[parts.length - 1] || "avatar.jpg";
  }
}
