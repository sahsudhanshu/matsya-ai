import { Fish } from "lucide-react";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Fish className="w-9 h-9 text-primary animate-bounce" />
                </div>
            </div>
            <div className="space-y-2 text-center">
                <p className="text-base font-semibold text-foreground animate-pulse">Loading...</p>
                <p className="text-xs text-muted-foreground">Fetching your maritime data</p>
            </div>
        </div>
    );
}
