"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
    Search, ChevronDown, Mail,
    Fish, BarChart2, MessageSquare, Phone,
    HelpCircle, BookOpen, Zap, Shield, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── FAQ Data ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
    {
        category: "Getting Started", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10",
        questions: [
            { q: "How do I upload my first catch?", a: "Navigate to the Camera/Upload tab from the bottom menu. You can snap a photo directly or upload an image from your gallery. Our AI will automatically analyze the species, weight, and freshness." },
            { q: "What image formats are supported?", a: "We support JPEG, PNG, and WebP formats. For the best AI accuracy, ensure the fish is fully visible and the photo is taken in natural daylight." },
            { q: "Is MatsyaAI available offline?", a: "Yes! Your Dashboard, Analytics, and past Catch History are available offline. However, processing new catch images requires an active internet connection." },
        ],
    },
    {
        category: "Fish Analysis", icon: Fish, color: "text-teal-500", bg: "bg-teal-500/10",
        questions: [
            { q: "How accurate is species identification?", a: "Our AI model boasts over 90% accuracy for common coastal species found in Indian waters, including Pomfret, Rohu, Catla, Hilsa, and Indian Mackerel." },
            { q: "How is the weight estimated?", a: "The computer vision model analyzes the fish's length, girth, and overall shape from your image. While highly accurate, the results are typically within a ±10% margin of the actual scale weight." },
            { q: "What does the freshness metric mean?", a: "Freshness is classified on a scale from 'Very Fresh' to 'Not Fresh' based on visual indicators like eye clarity, gill color, and skin texture. This is crucial for determining optimal market pricing." },
            { q: "Can I analyze multiple fish at once?", a: "Yes, you can use the 'Group Analysis' feature to upload a batch. It will provide aggregate statistics such as total count, species distribution, and combined weight estimates." },
        ],
    },
    {
        category: "Market & Analytics", icon: BarChart2, color: "text-indigo-500", bg: "bg-indigo-500/10",
        questions: [
            { q: "How do I generate a PDF report?", a: "Go to the Analytics tab and tap 'Generate Report'. The PDF will include your summary statistics, a breakdown by species, earnings trends, and a complete historical log." },
            { q: "How are earnings estimated?", a: "Earnings are estimated by cross-referencing your identified species and their weights with the typical, real-time market rates for your registered port or region." },
            { q: "Can I export my data?", a: "Absolutely! Go to Profile -> App Settings -> Data & Privacy -> Export Catch Data. You will receive a comprehensive CSV file containing your full history." },
        ],
    },
    {
        category: "AI Assistant", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10",
        questions: [
            { q: "What can I ask the AI?", a: "The AI Assistant is fully context-aware! You can ask it to summarize your catch history, identify specific species, provide local fishing regulations, check weather forecasts, or fetch current market prices." },
            { q: "Does it support regional languages?", a: "Yes. The AI natively understands Hindi, Tamil, Marathi, Malayalam, and more. You can change your preferred language in the App Settings." },
        ],
    },
    {
        category: "Privacy & Security", icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10",
        questions: [
            { q: "How is my data protected?", a: "All personal data and images are encrypted both at rest and in transit. Images are securely stored in AWS S3 and analysis metrics in DynamoDB. We never share your personal data with third parties." },
            { q: "How do I delete my account?", a: "Go to Profile -> App Settings -> Data & Privacy -> Delete Account. You will be prompted to type 'DELETE' to confirm. Note that this action is strictly irreversible." },
        ],
    },
];

// ── Premium FAQ Item ──────────────────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={cn(
            "border rounded-2xl overflow-hidden transition-all duration-300",
            open ? "border-primary/30 bg-primary/[0.03] shadow-sm" : "border-border/20 hover:border-border/40 hover:bg-muted/10"
        )}>
            <button
                className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left gap-4"
                onClick={() => setOpen(!open)}
            >
                <span className={cn("text-sm transition-colors duration-200 leading-snug", open ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>{question}</span>
                <div className={cn("shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300", open ? "bg-primary text-primary-foreground rotate-180" : "bg-muted text-muted-foreground/70")}>
                    <ChevronDown className="w-3.5 h-3.5" />
                </div>
            </button>
            <div className={cn(
                "grid transition-all duration-300 ease-in-out",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}>
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground/80 leading-relaxed">
                        {answer}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// REDESIGNED HELP OVERLAY
// ═══════════════════════════════════════════════════════════════════

export default function HelpOverlay() {
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const categories = useMemo(() => ["All", ...FAQ_ITEMS.map((f) => f.category)], []);

    const filtered = useMemo(
        () => FAQ_ITEMS
            .map((s) => ({
                ...s, questions: s.questions.filter((q) =>
                    !search || q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase()),
                )
            }))
            .filter((s) => (activeCategory === "All" || s.category === activeCategory) && s.questions.length > 0),
        [search, activeCategory],
    );

    const setCategory = useCallback((c: string) => setActiveCategory(c), []);

    return (
        <div className="px-4 py-6 sm:p-8 space-y-6 max-w-full">
            {/* Header & Search */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-1">
                        <HelpCircle className="w-3 h-3" /> Support Center
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">How can we help?</h1>
                    <p className="text-sm text-muted-foreground/70">Search our knowledge base or get in touch with our support team.</p>
                </div>

                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-md transition-opacity opacity-0 group-focus-within:opacity-100" />
                    <div className="relative flex items-center bg-card border border-border/30 rounded-2xl p-1 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
                        <div className="pl-3 pr-2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <Input
                            placeholder="Find answers (e.g., How do I upload?)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm px-0 placeholder:text-muted-foreground/40"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Actions (2 Columns for premium feel) */}
            {!search && (
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: BookOpen, label: "Detailed Guides", desc: "Read documentation", color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                        { icon: Globe, label: "System Status", desc: "All systems online", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                    ].map(({ icon: Icon, label, desc, color, bg, border }) => (
                        <Card key={label} className={cn("rounded-2xl border bg-card/40 cursor-pointer hover:bg-card hover:shadow-md transition-all duration-300 group", border)}>
                            <CardContent className="p-3.5 flex flex-col gap-2.5">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", bg, color)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-bold text-foreground leading-tight">{label}</p>
                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 mt-0.5">{desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Scrollable Category Filter */}
            <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar snap-x">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={cn(
                                "shrink-0 snap-center rounded-xl h-9 px-4 text-xs font-bold transition-all duration-200 border",
                                activeCategory === cat
                                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                    : "bg-muted/30 text-muted-foreground/70 border-border/20 hover:bg-muted/60 hover:text-foreground"
                            )}
                            onClick={() => setCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* FAQ Sections */}
            <div className="min-h-[300px]">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground/50 border border-dashed border-border/30 rounded-3xl bg-muted/5">
                        <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-bold text-foreground/60">No matching questions found</p>
                        <p className="text-xs mt-1">Try adjusting your search terms</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filtered.map((section) => {
                            const Icon = section.icon;
                            return (
                                <section key={section.category} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex items-center gap-2.5 px-1">
                                        <div className={cn("p-1.5 rounded-lg shadow-sm", section.bg, section.color)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-sm font-extrabold tracking-tight text-foreground/90">{section.category}</h2>
                                    </div>
                                    <div className="space-y-2">
                                        {section.questions.map((item) => <FAQItem key={item.q} question={item.q} answer={item.a} />)}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Premium Contact Section */}
            <Card className="rounded-2xl border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent relative overflow-hidden mt-8">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                <CardContent className="p-5 sm:p-6 flex flex-col gap-4 relative z-10">
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-foreground">Still need help?</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Our support team is available around the clock. We usually respond within a few hours.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                        <Button className="rounded-xl h-10 w-full sm:w-auto font-bold text-xs gap-2 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                            <Mail className="w-4 h-4" /> Email Support
                        </Button>
                        <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto font-bold text-xs gap-2 border-border/30 bg-card hover:bg-muted/50">
                            <Phone className="w-4 h-4" /> Call Us (Toll Free)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
