"use client"

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  error: Error | string;
  componentName?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

export default function ErrorState({ 
  error, 
  componentName, 
  onRetry, 
  onGoBack 
}: ErrorStateProps) {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);

  // Extract error message and details
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'string' ? null : error.stack;
  const errorName = typeof error === 'string' ? 'Error' : error.name;

  // Get user-friendly error title
  const getErrorTitle = (): string => {
    if (componentName) {
      return t('canvas.error.title.component') || `Failed to load ${componentName}`;
    }
    return t('canvas.error.title.default') || 'Something went wrong';
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-10">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 30% 40%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)
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

      {/* Center error content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-center space-y-6 max-w-md w-full"
        >
          {/* Error icon with glow */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: 'spring', 
              stiffness: 200, 
              damping: 15,
              delay: 0.1 
            }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
              <div className="relative w-20 h-20 rounded-2xl bg-red-500/10 backdrop-blur-sm border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>
          </motion.div>

          {/* Error message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="space-y-3"
          >
            <h3 className="text-2xl font-bold text-foreground">
              {getErrorTitle()}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorMessage || t('canvas.error.message.default') || 'An unexpected error occurred'}
            </p>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                size="lg"
                className="gap-2 min-w-[140px]"
              >
                <RefreshCw className="w-4 h-4" />
                {t('canvas.error.action.retry') || 'Retry'}
              </Button>
            )}
            
            {onGoBack && (
              <Button
                onClick={onGoBack}
                variant="outline"
                size="lg"
                className="gap-2 min-w-[140px]"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('canvas.error.action.goBack') || 'Go Back'}
              </Button>
            )}
          </motion.div>

          {/* Collapsible error details */}
          {(errorStack || errorName !== 'Error') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="w-full"
            >
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t('canvas.error.details.hide') || 'Hide details'}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {t('canvas.error.details.show') || 'Show details'}
                  </>
                )}
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-4 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg text-left">
                      <div className="space-y-2">
                        {errorName !== 'Error' && (
                          <div>
                            <span className="text-xs font-semibold text-red-400">
                              {t('canvas.error.details.type') || 'Error Type'}:
                            </span>
                            <p className="text-xs text-muted-foreground font-mono mt-1">
                              {errorName}
                            </p>
                          </div>
                        )}
                        
                        {errorStack && (
                          <div>
                            <span className="text-xs font-semibold text-red-400">
                              {t('canvas.error.details.stack') || 'Stack Trace'}:
                            </span>
                            <pre className="text-xs text-muted-foreground font-mono mt-1 overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {errorStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
    </div>
  );
}
