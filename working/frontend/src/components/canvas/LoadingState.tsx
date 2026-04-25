"use client"

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { ComponentType } from '@/types/agent-first';
import { Button } from '@/components/ui/button';

interface LoadingStateProps {
  componentName: ComponentType;
  progress?: number;
  onRetry?: () => void;
}

export default function LoadingState({ componentName, progress, onRetry }: LoadingStateProps) {
  const { t } = useLanguage();
  const [showTimeout, setShowTimeout] = useState(false);

  // Show timeout warning after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Get display name for component
  const getComponentDisplayName = (type: ComponentType): string => {
    if (!type) return t('canvas.loading.default') || 'Loading';
    
    const names: Record<string, string> = {
      map: t('canvas.loading.map') || 'Loading Map',
      upload: t('canvas.loading.upload') || 'Loading Upload',
      analytics: t('canvas.loading.analytics') || 'Loading Analytics',
    };
    
    return names[type] || t('canvas.loading.default') || 'Loading';
  };

  const displayName = getComponentDisplayName(componentName);

  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)
            `,
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Skeleton screens based on component type */}
      <div className="absolute inset-0 p-8">
        {componentName === 'map' && <MapSkeleton />}
        {componentName === 'upload' && <UploadSkeleton />}
        {componentName === 'analytics' && <AnalyticsSkeleton />}
        {!componentName && <GenericSkeleton />}
      </div>

      {/* Center loading content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-center space-y-6 max-w-md"
        >
          {!showTimeout ? (
            <>
              {/* Spinner with glow */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                  <Loader2 className="w-16 h-16 text-primary relative" />
                </div>
              </motion.div>

              {/* Component name */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  {displayName}...
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('canvas.loading.subtitle') || 'Please wait while we prepare your content'}
                </p>
              </div>

              {/* Progress indicator */}
              <div className="w-full max-w-xs">
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-emerald-500"
                    initial={{ width: '0%' }}
                    animate={{ width: progress !== undefined ? `${progress}%` : '100%' }}
                    transition={{
                      duration: progress !== undefined ? 0.3 : 5,
                      ease: 'easeInOut',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Timeout warning */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Warning icon */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
                    <div className="relative w-16 h-16 rounded-full bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                  </div>
                </div>

                {/* Warning message */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    {t('canvas.loading.timeout.title') || 'Taking longer than expected'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('canvas.loading.timeout.message') || 'The component is taking longer to load. You can wait or try again.'}
                  </p>
                </div>

                {/* Retry button */}
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    variant="default"
                    size="lg"
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('canvas.loading.timeout.retry') || 'Retry'}
                  </Button>
                )}
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
    </div>
  );
}

// ── Skeleton Components ───────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div className="w-full h-full space-y-4 opacity-20">
      {/* Map controls skeleton */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="w-10 h-10 bg-slate-700 rounded-lg animate-pulse" />
        <div className="w-10 h-10 bg-slate-700 rounded-lg animate-pulse" />
        <div className="w-10 h-10 bg-slate-700 rounded-lg animate-pulse" />
      </div>

      {/* Map legend skeleton */}
      <div className="absolute bottom-4 left-4 w-48 space-y-2">
        <div className="h-6 bg-slate-700 rounded animate-pulse" />
        <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse" />
      </div>

      {/* Grid pattern to simulate map */}
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-2 p-4">
        {[...Array(48)].map((_, i) => (
          <motion.div
            key={i}
            className="bg-slate-700/30 rounded"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.02,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function UploadSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center opacity-20">
      <div className="w-full max-w-2xl space-y-6">
        {/* Upload area skeleton */}
        <div className="h-64 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto animate-pulse" />
            <div className="h-4 bg-slate-700 rounded w-48 mx-auto animate-pulse" />
            <div className="h-3 bg-slate-700 rounded w-32 mx-auto animate-pulse" />
          </div>
        </div>

        {/* Preview grid skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="aspect-square bg-slate-700 rounded-lg"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="w-full h-full space-y-6 p-6 opacity-20">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="h-24 bg-slate-700 rounded-lg"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-64 bg-slate-700 rounded-lg relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-600/50 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="h-12 bg-slate-700 rounded"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function GenericSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center opacity-20">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header skeleton */}
        <div className="h-12 bg-slate-700 rounded-lg w-1/3 animate-pulse" />
        
        {/* Content blocks */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="h-32 bg-slate-700 rounded-lg"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
