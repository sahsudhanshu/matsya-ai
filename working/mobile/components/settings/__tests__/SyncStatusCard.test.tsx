/**
 * Bug Condition Exploration Test: SyncStatusCard Silent Failure
 *
 * **Validates: Requirements 2.2**
 *
 * This test verifies that when the sync API fails in SyncStatusCard,
 * the system displays a user-friendly error toast notification.
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
 * - The unfixed code only logs to console (console.error)
 * - No toast notification is shown to the user
 * - This test will fail because toastService.error() is NOT called
 *
 * EXPECTED OUTCOME ON FIXED CODE: Test PASSES
 * - The fixed code calls toastService.error() with appropriate message
 * - User is notified of sync failure via toast
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SyncStatusCard } from "../SyncStatusCard";
import { SyncService } from "../../../lib/sync-service";
import { toastService } from "../../../lib/toast-service";

// Mock dependencies
jest.mock("../../../lib/sync-service");
jest.mock("../../../lib/toast-service");

describe("SyncStatusCard - Bug Condition Exploration", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (SyncService.getSyncStatus as jest.Mock).mockResolvedValue({
      pending: 5,
      failed: 0,
      syncing: false,
      syncStatus: "idle",
      lastSync: new Date().toISOString(),
    });

    (SyncService.subscribe as jest.Mock).mockReturnValue(() => {});
  });

  it("should display error toast when sync fails", async () => {
    // Mock sync API to reject with error
    const syncError = new Error("Network error");
    (SyncService.syncPendingChanges as jest.Mock).mockRejectedValue(syncError);

    // Render component
    const { getByText } = render(<SyncStatusCard />);

    // Wait for component to load
    await waitFor(() => {
      expect(getByText("5 pending")).toBeTruthy();
    });

    // Trigger manual sync action by pressing "Sync Now" button
    const syncButton = getByText("Sync Now");
    fireEvent.press(syncButton);

    // Wait for async operation to complete
    await waitFor(() => {
      expect(SyncService.syncPendingChanges).toHaveBeenCalled();
    });

    // Assert toastService.error() is called with appropriate message
    // EXPECTED: This assertion will FAIL on unfixed code
    // The unfixed code only calls console.error(), not toastService.error()
    expect(toastService.error).toHaveBeenCalledWith(
      "Sync failed. Please try again.",
    );
  });

  it("should still log error to console for debugging", async () => {
    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Mock sync API to reject with error
    const syncError = new Error("Network error");
    (SyncService.syncPendingChanges as jest.Mock).mockRejectedValue(syncError);

    // Render component
    const { getByText } = render(<SyncStatusCard />);

    // Wait for component to load
    await waitFor(() => {
      expect(getByText("5 pending")).toBeTruthy();
    });

    // Trigger manual sync action
    const syncButton = getByText("Sync Now");
    fireEvent.press(syncButton);

    // Wait for async operation to complete
    await waitFor(() => {
      expect(SyncService.syncPendingChanges).toHaveBeenCalled();
    });

    // Verify console.error is still called (preservation requirement)
    expect(consoleErrorSpy).toHaveBeenCalledWith("Sync failed:", syncError);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});
