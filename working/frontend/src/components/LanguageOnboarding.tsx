"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check } from "lucide-react";
import { useLanguage, LANGUAGES } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";

/**
 * Full-screen language selector shown on first visit.
 * Uses large native-script buttons instead of English dropdowns.
 */
export default function LanguageOnboarding() {
    const { locale, setLocale, isFirstVisit } = useLanguage();
    const [selected, setSelected] = React.useState<Locale>(locale);
    const [dismissed, setDismissed] = React.useState(false);

    if (!isFirstVisit || dismissed) return null;

    const handleConfirm = () => {
        setLocale(selected);
        setDismissed(true);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-6"
            >
                {/* Header */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-center mb-10"
                >
                    <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-5">
                        <Globe className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-black mb-2">
                        Choose Your Language
                    </h1>
                    <p className="text-lg text-gray-600">अपनी भाषा चुनें</p>
                </motion.div>

                {/* Language Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg w-full mb-10">
                    {LANGUAGES.map((lang, i) => {
                        const isSelected = selected === lang.code;
                        return (
                            <motion.button
                                key={lang.code}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.15 + i * 0.05 }}
                                onClick={() => setSelected(lang.code)}
                                className={`
                  relative flex flex-col items-center justify-center p-5 rounded-2xl border-3 transition-all duration-200
                  min-h-[100px] text-center
                  ${isSelected
                                        ? "border-blue-600 bg-blue-50 shadow-lg shadow-blue-600/20"
                                        : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-md"
                                    }
                `}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <span
                                    className={`text-2xl font-bold mb-1 ${isSelected ? "text-blue-700" : "text-black"
                                        }`}
                                >
                                    {lang.label}
                                </span>
                                <span className="text-sm text-gray-500">{lang.labelEn}</span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Confirm Button */}
                <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={handleConfirm}
                    className="w-full max-w-xs h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                >
                    Continue →
                </motion.button>
            </motion.div>
        </AnimatePresence>
    );
}
