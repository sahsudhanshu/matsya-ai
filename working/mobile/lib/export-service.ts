import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportUserData } from './api-client';
import type { DataExportOptions } from './types';

export class ExportService {
  /**
   * Export user data to CSV or JSON
   */
  static async exportData(options: DataExportOptions): Promise<void> {
    try {
      // Call backend API to generate export
      const { downloadUrl, fileSize } = await exportUserData(options);

      // Download file
      const fileName = `oceanai-data-${new Date().toISOString().split('T')[0]}.${options.format}`;
      const localUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.downloadAsync(downloadUrl, localUri);

      // Share file
      await this.shareFile(localUri, fileName, options.format);
    } catch (error) {
      console.error('Export data error:', error);
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Share exported file
   */
  private static async shareFile(uri: string, fileName: string, format: 'csv' | 'json'): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: format === 'csv' ? 'text/csv' : 'application/json',
      dialogTitle: 'Export Data',
      UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
    });
  }

  /**
   * Get file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
