import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { LanguageProvider, useLanguage } from "../lib/i18n";
import { NetworkProvider } from "../lib/network-context";
import { AgentContextProvider } from "../lib/agent-context";
import { ToastProvider } from "../components/providers/ToastProvider";
import { NetworkStatusBanner } from "../components/ui/NetworkStatusBanner";
import { COLORS } from "../lib/constants";
import { runStartupChecks } from "../lib/startup-check";
import {
  AgentOnboarding,
  shouldShowOnboarding,
} from "../components/onboarding/AgentOnboarding";

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    shouldShowOnboarding().then((show) => {
      setShowOnboarding(show);
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (isLoading || !onboardingChecked || showOnboarding) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/login");
    }
  }, [user, isLoading, onboardingChecked, showOnboarding]);

  if (isLoading || !onboardingChecked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (showOnboarding && user) {
    return (
      <AgentOnboarding
        onComplete={() => {
          setShowOnboarding(false);
          router.replace("/(tabs)");
        }}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
    </Stack>
  );
}

function AppWithNetworkBanner() {
  return (
    <>
      <NetworkStatusBanner />
      <RootLayoutNav />
    </>
  );
}

import { ThemeProvider, DarkTheme } from "@react-navigation/native";

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.bgDark,
    card: COLORS.bgCard,
    text: COLORS.textPrimary,
    border: COLORS.border,
    primary: COLORS.primary,
  },
};

export default function RootLayout() {
  const [diagnosticsComplete, setDiagnosticsComplete] = useState(!__DEV__);

  useEffect(() => {
    // Initialize offline queue
    import("../lib/offline-queue").then(({ offlineQueue }) => {
      offlineQueue.initialize();
    });

    // Initialize sync service
    import("../lib/sync-service").then(({ SyncService }) => {
      SyncService.initialize();
    });

    // Initialize deep linking
    import("../lib/deep-link-service").then(({ DeepLinkService }) => {
      DeepLinkService.initialize();
    });

    // Run startup diagnostics in development mode
    if (__DEV__) {
      runStartupChecks()
        .then((results) => {
          if (!results.ok) {
            console.warn(
              "⚠️  Startup diagnostics found issues. Check the logs above.",
            );
          }
        })
        .catch((err) => {
          console.error("❌ Startup diagnostics failed:", err);
        })
        .finally(() => {
          setDiagnosticsComplete(true);
        });
    }
  }, []);

  // Show loading screen while diagnostics are running (dev mode only)
  if (!diagnosticsComplete) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={customDarkTheme}>
        <SafeAreaProvider>
          <NetworkProvider>
            <LanguageProvider>
              <AgentContextProvider>
                <AuthProvider>
                  <ToastProvider>
                    <StatusBar style="light" backgroundColor={COLORS.bgDark} />
                    <AppWithNetworkBanner />
                  </ToastProvider>
                </AuthProvider>
              </AgentContextProvider>
            </LanguageProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgDark },
  loading: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    alignItems: "center",
    justifyContent: "center",
  },
});
