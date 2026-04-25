import * as Sharing from 'expo-sharing';
import { Clipboard, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Service for native sharing functionality
 */
export class ShareService {
  /**
   * Share text content
   */
  static async shareText(text: string, title?: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      // Fallback to clipboard
      Clipboard.setString(text);
      Alert.alert('Copied', 'Content copied to clipboard');
      return;
    }

    // Create temporary text file for sharing
    const uri = await this.createTextFile(text);
    await Sharing.shareAsync(uri, {
      dialogTitle: title || 'Share',
    });
  }

  /**
   * Share URL
   */
  static async shareUrl(url: string, message?: string): Promise<void> {
    const text = message ? `${message}\n\n${url}` : url;
    await this.shareText(text, 'Share Link');
  }

  /**
   * Copy to clipboard
   */
  static async copyToClipboard(text: string, successMessage?: string): Promise<void> {
    Clipboard.setString(text);
    Alert.alert('Copied', successMessage || 'Copied to clipboard');
  }

  /**
   * Share file
   */
  static async shareFile(uri: string, mimeType: string, title?: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: title || 'Share File',
    });
  }

  /**
   * Create temporary text file
   */
  private static async createTextFile(text: string): Promise<string> {
    const uri = `${FileSystem.cacheDirectory}share-${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(uri, text);
    
    // Schedule cleanup after 5 minutes
    setTimeout(async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      } catch (error) {
        console.warn('Failed to cleanup temp file:', error);
      }
    }, 5 * 60 * 1000);
    
    return uri;
  }
}
