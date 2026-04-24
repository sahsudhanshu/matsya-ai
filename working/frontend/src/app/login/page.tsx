"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "One special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;
  return (
    <motion.ul
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="mt-2 space-y-1"
    >
      {PASSWORD_RULES.map(({ label, test }) => {
        const met = test(password);
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 text-xs font-medium transition-colors duration-200",
              met ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {met ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 shrink-0 opacity-40" />
            )}
            {label}
          </li>
        );
      })}
    </motion.ul>
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    setIsLoading(true);
    try {
      if (mode === "login") {
        await login(normalizedEmail, normalizedPassword);
        toast.success("Welcome back! 🐟");
        router.push("/");
      } else {
        if (!name.trim()) {
          toast.error("Name is required");
          setIsLoading(false);
          return;
        }
        await register(name.trim(), normalizedEmail, normalizedPassword, "");
        toast.success("Account created! Please sign in.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-background flex overflow-hidden">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-ocean-gradient relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-white/5" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
        <svg
          className="absolute inset-0 w-full h-full opacity-5"
          viewBox="0 0 800 600"
        >
          <path
            d="M0 300 Q200 100 400 300 Q600 500 800 300"
            stroke="white"
            fill="none"
            strokeWidth="2"
          />
          <path
            d="M0 400 Q200 200 400 400 Q600 600 800 400"
            stroke="white"
            fill="none"
            strokeWidth="2"
          />
        </svg>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="MatsyaAI Logo" className="w-12 h-12 object-contain" />
          <div>
            <p className="text-white font-bold text-xl">MatsyaAI</p>
            <p className="text-white/50 text-xs">AI for Bharat</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-10">
          <Badge className="bg-white/15 text-white border-none px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            AWS AI for Bharat Challenge
          </Badge>
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            Empowering India's
            <br />
            <span className="text-amber-400">Fishermen</span>
            <br />
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-md">
            AI-powered fish identification, weight estimation, and market
            intelligence - all from a single photo.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="MatsyaAI Logo" className="w-10 h-10 object-contain" />
          <p className="font-bold text-xl">MatsyaAI</p>
        </div>

        <div className="w-full max-w-md space-y-8">

          {/* Animated heading */}
          <div className="relative overflow-hidden" style={{ minHeight: 72 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-2"
              >
                <h2 className="text-3xl font-bold">
                  {mode === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="text-muted-foreground">
                  {mode === "login"
                    ? "Sign in to your MatsyaAI dashboard"
                    : "Start your AI fishing journey today"}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mode Toggle - Sliding Pill */}
          <div className="relative flex rounded-2xl bg-muted/30 p-1 border border-border/20">
            {/* Sliding pill background */}
            <motion.div
              layout
              layoutId="tab-pill"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              className={cn(
                "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-background shadow-md border border-border/20",
                mode === "login" ? "left-1" : "left-[calc(50%+3px)]"
              )}
            />
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "relative z-10 flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200",
                  mode === m
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name - animated in/out */}
            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1, height: "auto",
                    transition: { height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.2, delay: 0.05 } }
                  }}
                  exit={{
                    opacity: 0, height: 0,
                    transition: { opacity: { duration: 0.12 }, height: { duration: 0.25, delay: 0.1, ease: [0.4, 0, 1, 1] } }
                  }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-0">
                    <Label
                      htmlFor="name"
                      className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="Ram Mohan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-xl bg-muted/20 border border-border/40 focus-visible:ring-2 focus-visible:ring-primary/30 px-4 font-medium"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="fisherman@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl bg-muted/20 border border-border/40 focus-visible:ring-2 focus-visible:ring-primary/30 pl-11 pr-4 font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-muted/20 border border-border/40 focus-visible:ring-2 focus-visible:ring-primary/30 pl-11 pr-12 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {mode === "signup" && (
                  <PasswordRequirements password={password} />
                )}
              </AnimatePresence>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary font-bold text-base shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === "login" ? "Signing in..." : "Creating account..."}
                  </motion.span>
                ) : (
                  <motion.span
                    key={`btn-${mode}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2"
                  >
                    {mode === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <button
              type="button"
              onClick={() => setLegalModal("terms")}
              className="text-primary font-bold hover:underline"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setLegalModal("privacy")}
              className="text-primary font-bold hover:underline"
            >
              Privacy Policy
            </button>
          </p>

          {/* Legal Modal */}
          <AnimatePresence>
            {legalModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setLegalModal(null)}
              >
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="relative bg-card border border-border/30 rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
                    <h3 className="font-bold text-base">
                      {legalModal === "terms" ? "Terms of Service" : "Privacy Policy"}
                    </h3>
                    <button
                      onClick={() => setLegalModal(null)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-y-auto px-6 py-5 text-sm text-muted-foreground space-y-4 leading-relaxed">
                    {legalModal === "terms" ? (
                      <>
                        <p className="font-semibold text-foreground">1. Acceptance of Terms</p>
                        <p>By accessing MatsyaAI, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
                        <p className="font-semibold text-foreground">2. Use of Service</p>
                        <p>MatsyaAI provides AI-powered fish identification and market intelligence tools for fishermen. The service is provided for informational purposes only.</p>
                        <p className="font-semibold text-foreground">3. Data Usage</p>
                        <p>Images and data you upload are used solely to provide the service. We do not sell your personal data to third parties.</p>
                        <p className="font-semibold text-foreground">4. Limitation of Liability</p>
                        <p>MatsyaAI is not liable for decisions made based on AI predictions. Always consult local market experts for pricing decisions.</p>
                        <p className="text-xs text-muted-foreground/50 pt-2">Last updated: March 2025 • Part of AWS AI for Bharat Challenge</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-foreground">1. Information We Collect</p>
                        <p>We collect your name, email, fishing port, and images you upload for catch analysis. Location data is used only for ocean data features.</p>
                        <p className="font-semibold text-foreground">2. How We Use Your Data</p>
                        <p>Your data is used to personalize your dashboard, improve AI models, and deliver weather and market alerts relevant to your region.</p>
                        <p className="font-semibold text-foreground">3. Data Storage</p>
                        <p>All data is stored securely on AWS infrastructure in India. We comply with applicable Indian data protection laws.</p>
                        <p className="font-semibold text-foreground">4. Your Rights</p>
                        <p>You may request deletion of your account and all associated data at any time via Settings → Data &amp; Privacy → Delete Account.</p>
                        <p className="text-xs text-muted-foreground/50 pt-2">Last updated: March 2025 • Part of AWS AI for Bharat Challenge</p>
                      </>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
