"use client";

import React, { Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAgentFirstStore,
  selectActiveComponent,
  selectComponentState,
} from "@/lib/stores/agent-first-store";
import PlaceholderState from "./PlaceholderState";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";
import { cn } from "@/lib/utils";
import { lazyRetry } from "@/lib/lazy-retry";

// ── Lazy load canvas components ───────────────────────────────────────────────
const UploadComponent = lazy(lazyRetry(() => import("./UploadComponent")));
const MapComponent = lazy(lazyRetry(() => import("./MapComponent")));
const AnalyticsComponent = lazy(
  lazyRetry(() => import("./AnalyticsComponent")),
);
const HistoryComponent = lazy(lazyRetry(() => import("./HistoryComponent")));

interface ContentCanvasPaneProps {
  className?: string;
}

// ── Animation variants ────────────────────────────────────────────────────────
const canvasVariants = {
  idle: { opacity: 0.6, scale: 1 },
  loading: {
    opacity: 0.8,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
  active: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

export default function ContentCanvasPane({
  className,
}: ContentCanvasPaneProps) {
  const activeComponent = useAgentFirstStore(selectActiveComponent);
  const componentState = useAgentFirstStore(selectComponentState);
  const componentProps = useAgentFirstStore((state) => state.componentProps);
  const dispatchPaneMessage = useAgentFirstStore(
    (state) => state.dispatchPaneMessage,
  );

  const [mountedComponents, setMountedComponents] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    if (activeComponent) {
      setMountedComponents((prev) => new Set(prev).add(activeComponent));
    }
  }, [activeComponent]);

  const commonProps = {
    onPaneMessage: dispatchPaneMessage,
    ...componentProps,
  };

  return (
    <div
      className={cn(
        "w-full h-full min-h-0 relative overflow-hidden bg-background",
        className,
      )}
    >
      <AnimatePresence>
        {componentState.type === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background"
          >
            <ErrorState
              error={componentState.error || ""}
              componentName={activeComponent || undefined}
              onRetry={() => {
                useAgentFirstStore
                  .getState()
                  .setActiveComponent(activeComponent, componentProps);
              }}
              onGoBack={() => {
                useAgentFirstStore.getState().goBack();
              }}
            />
          </motion.div>
        )}

        {componentState.type === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-background"
          >
            <LoadingState
              componentName={activeComponent}
              progress={componentState.progress}
            />
          </motion.div>
        )}

        {!activeComponent && componentState.type !== "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30"
          >
            <PlaceholderState />
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={<LoadingState componentName={activeComponent} />}>
        {mountedComponents.has("upload") && (
          <div
            className={cn(
              "w-full h-full min-h-0",
              activeComponent === "upload" ? "block" : "hidden",
            )}
          >
            <UploadComponent {...commonProps} />
          </div>
        )}
        {mountedComponents.has("map") && (
          <div
            className={cn(
              "w-full h-full min-h-0",
              activeComponent === "map" ? "block" : "hidden",
            )}
          >
            <MapComponent {...commonProps} />
          </div>
        )}
        {mountedComponents.has("analytics") && (
          <div
            className={cn(
              "w-full h-full min-h-0",
              activeComponent === "analytics" ? "block" : "hidden",
            )}
          >
            <AnalyticsComponent {...commonProps} />
          </div>
        )}
        {mountedComponents.has("history") && (
          <div
            className={cn(
              "w-full h-full min-h-0",
              activeComponent === "history" ? "block" : "hidden",
            )}
          >
            <HistoryComponent {...commonProps} />
          </div>
        )}
      </Suspense>
    </div>
  );
}
