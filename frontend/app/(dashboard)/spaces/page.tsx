import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

// This page will eventually fetch spaces from the database.
// For now, it shows the empty state.

export default function SpacesPage() {
    const spaces: never[] = [];

    return (
        <div id="spaces-page">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-display italic text-foreground">
                        Your Spaces
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Each space represents a physical location with an AI greeter.
                    </p>
                </div>
                <Button asChild className="bg-amber text-[#0C0A09] hover:bg-amber/90">
                    <Link href="/spaces/new">
                        <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                            />
                        </svg>
                        New Space
                    </Link>
                </Button>
            </div>

            {/* Empty state or list */}
            {spaces.length === 0 ? (
                <Card className="border-dashed border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-amber/20"
                            style={{
                                background:
                                    "radial-gradient(circle at 40% 35%, #292524 0%, #1c1917 60%, #0C0A09 100%)",
                            }}
                        >
                            <svg
                                viewBox="0 0 100 100"
                                fill="none"
                                className="w-9 h-9"
                            >
                                <ellipse cx="38" cy="40" rx="5" ry="6" fill="#FB923C" />
                                <ellipse cx="62" cy="40" rx="5" ry="6" fill="#FB923C" />
                                <path
                                    d="M 35 55 Q 50 62 65 55"
                                    stroke="#FB923C"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                        <CardTitle className="text-lg mb-1">No spaces yet</CardTitle>
                        <CardDescription className="max-w-sm mb-6">
                            Create your first space to set up an AI greeter for your entrance.
                            You&apos;ll configure the tone, business type, and context.
                        </CardDescription>
                        <Button
                            asChild
                            className="bg-amber text-[#0C0A09] hover:bg-amber/90"
                        >
                            <Link href="/spaces/new">Create Your First Space</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Space cards will render here when data is connected */}
                </div>
            )}
        </div>
    );
}
