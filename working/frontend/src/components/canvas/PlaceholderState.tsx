"use client"

import React from 'react';
import { motion } from 'framer-motion';
import { Waves, Compass } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function PlaceholderState() {
  const { t } = useLanguage();

  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Animated background waves */}
      <div className="absolute inset-0 opacity-20">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 40% 90%, rgba(99, 102, 241, 0.1) 0%, transparent 50%)
            `,
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary/20 rounded-full"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}

      {/* World map illustration */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5">
        <svg
          viewBox="0 0 800 400"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100,200 Q200,150 300,200 T500,200 Q600,250 700,200"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeDasharray="5,5"
          />
          <circle cx="200" cy="180" r="40" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="400" cy="220" r="60" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="600" cy="190" r="50" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
      </div>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center space-y-6 max-w-md"
        >
          {/* Icon */}
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <div className="relative w-20 h-20 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center">
                <Waves className="w-10 h-10 text-primary" />
              </div>
            </div>
          </motion.div>

          {/* Message */}
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">
              {t('canvas.placeholder.title') || 'Ask me anything about fishing'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('canvas.placeholder.subtitle') || 'Upload catches, view maps, check analytics, or ask questions about the ocean'}
            </p>
          </div>

          {/* Decorative compass */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="flex justify-center opacity-30"
          >
            <Compass className="w-8 h-8 text-primary" />
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
    </div>
  );
}
