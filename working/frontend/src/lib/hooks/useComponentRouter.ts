/**
 * useComponentRouter hook for component routing logic
 * Connects to Zustand store and provides routing actions with history tracking
 * 
 * Requirements: 16.2, 16.3
 */

import { useCallback } from 'react';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { ComponentType, ComponentProps } from '@/types/agent-first';

export interface UseComponentRouterReturn {
  // Current state
  activeComponent: ComponentType | null;
  componentProps: ComponentProps;
  componentHistory: Array<{ component: ComponentType; props: ComponentProps; timestamp: number }>;
  
  // Actions
  navigateTo: (component: ComponentType, props?: ComponentProps) => void;
  close: () => void;
  goBack: () => void;
  
  // Utilities
  canGoBack: boolean;
  isActive: (component: ComponentType) => boolean;
}

/**
 * Hook for component routing logic
 * Provides a clean API for navigating between components
 */
export function useComponentRouter(): UseComponentRouterReturn {
  // Select state from store
  const activeComponent = useAgentFirstStore((state) => state.activeComponent);
  const componentProps = useAgentFirstStore((state) => state.componentProps);
  const componentHistory = useAgentFirstStore((state) => state.componentHistory);
  
  // Select actions from store
  const setActiveComponent = useAgentFirstStore((state) => state.setActiveComponent);
  const clearComponent = useAgentFirstStore((state) => state.clearComponent);
  const goBackAction = useAgentFirstStore((state) => state.goBack);
  
  // Navigate to a component
  const navigateTo = useCallback(
    (component: ComponentType, props: ComponentProps = {}) => {
      setActiveComponent(component, props);
    },
    [setActiveComponent]
  );
  
  // Close current component
  const close = useCallback(() => {
    clearComponent();
  }, [clearComponent]);
  
  // Go back to previous component
  const goBack = useCallback(() => {
    goBackAction();
  }, [goBackAction]);
  
  // Check if can go back
  const canGoBack = componentHistory.length > 0;
  
  // Check if a component is currently active
  const isActive = useCallback(
    (component: ComponentType) => {
      return activeComponent === component;
    },
    [activeComponent]
  );
  
  return {
    activeComponent,
    componentProps,
    componentHistory,
    navigateTo,
    close,
    goBack,
    canGoBack,
    isActive,
  };
}

/**
 * Hook for accessing only the navigation actions
 * Useful when you don't need to subscribe to state changes
 */
export function useComponentNavigation() {
  const setActiveComponent = useAgentFirstStore((state) => state.setActiveComponent);
  const clearComponent = useAgentFirstStore((state) => state.clearComponent);
  const goBackAction = useAgentFirstStore((state) => state.goBack);
  
  const navigateTo = useCallback(
    (component: ComponentType, props: ComponentProps = {}) => {
      setActiveComponent(component, props);
    },
    [setActiveComponent]
  );
  
  const close = useCallback(() => {
    clearComponent();
  }, [clearComponent]);
  
  const goBack = useCallback(() => {
    goBackAction();
  }, [goBackAction]);
  
  return {
    navigateTo,
    close,
    goBack,
  };
}
