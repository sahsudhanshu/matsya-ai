import Link from "next/link";
import { ArrowLeft, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-[80vh] sm:min-h-[70vh] gap-6 sm:gap-8 md:gap-10 text-center px-4 sm:px-6 overflow-hidden">
            {/* Animated background bubbles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-primary/10 top-[15%] left-[10%] animate-bounce [animation-duration:3s]" />
                <div className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/8 top-[25%] right-[15%] animate-bounce [animation-duration:4s] [animation-delay:0.5s]" />
                <div className="absolute w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/6 bottom-[20%] left-[20%] animate-bounce [animation-duration:5s] [animation-delay:1s]" />
                <div className="absolute w-2 h-2 rounded-full bg-primary/10 top-[40%] right-[8%] animate-bounce [animation-duration:3.5s] [animation-delay:1.5s]" />
                <div className="absolute w-3 h-3 rounded-full bg-primary/5 bottom-[30%] right-[25%] animate-bounce [animation-duration:4.5s] [animation-delay:0.8s]" />
            </div>

            {/* Logo */}
            {/* <div className="relative">
                <div className="absolute -inset-3 sm:-inset-4 rounded-full bg-primary/10 animate-pulse" />
                <div className="absolute -inset-1.5 sm:-inset-2 rounded-full bg-primary/5 animate-pulse [animation-delay:0.5s]" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 backdrop-blur-sm border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
                    <img
                        src="/logo.png"
                        alt="MatsyaAI Logo"
                        className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain drop-shadow-md"
                    />
                </div>
            </div> */}

            {/* 404 text */}
            <div className="text-[80px] sm:text-[120px] md:text-[150px] font-black text-primary/[0.08] leading-none select-none tracking-tighter -my-4 sm:-my-6">
                404
            </div>

            {/* Text content */}
            <div className="space-y-2 sm:space-y-3 max-w-[280px] sm:max-w-sm md:max-w-md">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                    Gone Fishing!
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    This page seems to have drifted off to sea. Let&apos;s get you back to safer waters.
                </p>
            </div>

            {/* Wave divider */}
            <div className="flex items-center gap-2 text-muted-foreground/40">
                <div className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent to-muted-foreground/20" />
                <Waves className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                <div className="w-8 sm:w-12 h-px bg-gradient-to-l from-transparent to-muted-foreground/20" />
            </div>

            {/* CTA button */}
            <Button
                asChild
                className="rounded-xl h-10 sm:h-12 px-6 sm:px-8 bg-primary font-bold shadow-lg shadow-primary/20 text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95"
            >
                <Link href="/">
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back to Home
                </Link>
            </Button>
        </div>
    );
}
