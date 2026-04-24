import Link from "next/link";
import { Fish, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 text-center">
            <div className="relative">
                <div className="text-[120px] font-black text-primary/10 leading-none select-none">404</div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                        <Fish className="w-10 h-10 text-primary" />
                    </div>
                </div>
            </div>
            <div className="space-y-3 max-w-sm">
                <h1 className="text-2xl font-bold">Gone Fishing!</h1>
                <p className="text-muted-foreground">
                    This page seems to have drifted off to sea. Let's get you back to safer waters.
                </p>
            </div>
            <Button asChild className="rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20">
                <Link href="/">
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back to Dashboard
                </Link>
            </Button>
        </div>
    );
}
