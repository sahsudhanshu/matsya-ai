import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Platform, Alert } from "react-native";
import { TELEGRAM_BOT_USERNAME } from "./constants";

export class DeepLinkService {
  /**
   * Initialize deep linking
   */
  static initialize(): void {
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleUrl(url);
      }
    });

    // Listen for deep link events
    Linking.addEventListener("url", (event) => {
      this.handleUrl(event.url);
    });
  }

  /**
   * Handle deep link URL
   */
  private static handleUrl(url: string): void {
    const { hostname, path, queryParams } = Linking.parse(url);

    // Handle different deep link patterns
    if (hostname === "history" && path) {
      // oceanai://history/[groupId]
      const groupId = path.replace("/", "");
      router.push(`/history/${groupId}` as any);
    } else if (hostname === "profile") {
      // oceanai://profile
      router.push("/profile/edit" as any);
    } else if (hostname === "chat" && queryParams?.groupId) {
      // oceanai://chat?groupId=xxx
      router.push({
        pathname: "/chat",
        params: { groupId: queryParams.groupId as string },
      } as any);
    }
  }

  /**
   * Open Telegram bot with optional location and user context
   */
  static async openTelegramBot(
    userId?: string,
    latitude?: number,
    longitude?: number,
  ): Promise<void> {
    const botUsername = TELEGRAM_BOT_USERNAME;

    // Build start parameter with context
    let startParam = "";
    if (userId && latitude && longitude) {
      startParam = `loc_${latitude}_${longitude}_${userId}`;
    } else if (userId) {
      startParam = `user_${userId}`;
    }

    // Try deep link first (opens Telegram app directly)
    const deepLinkUrl = startParam
      ? `tg://resolve?domain=${botUsername}&start=${startParam}`
      : `tg://resolve?domain=${botUsername}`;

    try {
      const canOpenDeepLink = await Linking.canOpenURL(deepLinkUrl);
      if (canOpenDeepLink) {
        await Linking.openURL(deepLinkUrl);
        return;
      }
    } catch (error) {
      console.warn("Deep link failed, trying web URL:", error);
    }

    // Fallback to web URL (works on both platforms)
    const webUrl = startParam
      ? `https://t.me/${botUsername}?start=${startParam}`
      : `https://t.me/${botUsername}`;

    try {
      const canOpenWeb = await Linking.canOpenURL(webUrl);
      if (canOpenWeb) {
        await Linking.openURL(webUrl);
        return;
      }
    } catch (error) {
      console.warn("Web URL failed:", error);
    }

    // If both failed, show app store link
    this.showTelegramNotInstalledAlert();
  }

  /**
   * Show alert when Telegram is not installed
   */
  private static showTelegramNotInstalledAlert(): void {
    const appStoreUrl = Platform.select({
      ios: "https://apps.apple.com/app/telegram-messenger/id686449807",
      android:
        "https://play.google.com/store/apps/details?id=org.telegram.messenger",
    });

    Alert.alert(
      "Telegram Not Installed",
      "To connect with Matsya AI on Telegram, you need to install the Telegram app first.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Install Telegram",
          onPress: () => {
            if (appStoreUrl) {
              Linking.openURL(appStoreUrl);
            }
          },
        },
      ],
    );
  }

  /**
   * Open external map app
   */
  static async openMap(latitude: number, longitude: number): Promise<void> {
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    await Linking.openURL(url);
  }

  /**
   * Open URL in browser
   */
  static async openUrl(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error("Cannot open URL");
    }
  }
}
