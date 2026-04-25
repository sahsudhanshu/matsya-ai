"use client"

import React, { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AgentFirstLayout from './AgentFirstLayout';
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const PUBLIC_ROUTES = ['/login', '/signup'];

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // /profile/[slug] is public (public profile view), but /profile alone is authenticated
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
    || /^\/profile\/[^/]+/.test(pathname);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

  // Show public routes without layout
  if (isPublicRoute) return <>{children}</>;

  // Global loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-float">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-gentle-pulse">Loading MatsyaAI...</p>
        </div>
      </div>
    );
  }

  // Redirect in progress - show loading instead of white screen
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-float">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-gentle-pulse">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Authenticated routes run in a single Agent-First experience.
  return <AgentFirstLayout />;
}
