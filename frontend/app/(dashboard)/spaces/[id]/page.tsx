import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface SpacePageProps {
    params: Promise<{ id: string }>;
}

// This page will eventually fetch the real space from the database.
// For now, it shows the space dashboard shell.

export default async function SpaceDashboardPage({ params }: SpacePageProps) {
    const { id } = await params;

    return (
        <div id="space-dashboard">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-display italic text-foreground">
                            Space Dashboard
                        </h1>
                        <Badge variant="outline" className="text-amber border-amber/30">
                            Active
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Space ID: {id}
                    </p>
                </div>
                <Button
                    asChild
                    className="bg-amber text-[#0C0A09] hover:bg-amber/90"
                >
                    <Link href={`/spaces/${id}/greeter`}>
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
                                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                            />
                        </svg>
                        Launch Greeter
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Stats cards */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Greetings Today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-medium text-foreground">—</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Connect database to track
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Greetings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-medium text-foreground">—</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            All time
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Agent not connected</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Launch greeter to start
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Separator className="mb-8" />

            {/* Configuration section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Configuration</CardTitle>
                        <CardDescription>
                            Current space settings. Edit these to change how HeyYou greets
                            your guests.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                Business Type
                            </p>
                            <p className="text-sm text-foreground">—</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                Tone
                            </p>
                            <p className="text-sm text-foreground">—</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                Context
                            </p>
                            <p className="text-sm text-foreground">—</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Recent Greetings</CardTitle>
                        <CardDescription>
                            The latest greetings delivered at this space.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                No greetings yet. Launch the greeter to get started!
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
