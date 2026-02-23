"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { ToneType, BusinessType } from "@/types";

const businessTypes: { value: BusinessType; label: string; emoji: string }[] = [
    { value: "boutique_retail", label: "Boutique / Retail", emoji: "🛍️" },
    { value: "cafe_restaurant", label: "Café / Restaurant", emoji: "☕" },
    { value: "conference_event", label: "Conference / Event", emoji: "🎤" },
    { value: "gym_fitness", label: "Gym / Fitness", emoji: "💪" },
    { value: "hotel_hospitality", label: "Hotel / Hospitality", emoji: "🏨" },
    { value: "bookstore_library", label: "Bookstore / Library", emoji: "📚" },
    { value: "salon_spa", label: "Salon / Spa", emoji: "💆" },
    { value: "office_lobby", label: "Office Lobby", emoji: "🏢" },
];

const toneOptions: { value: ToneType; label: string; description: string }[] = [
    {
        value: "warm",
        label: "Warm",
        description: "Friendly, welcoming, like a hug from a friend",
    },
    {
        value: "hype",
        label: "Hype",
        description: "Energetic, exciting, like a pump-up crew",
    },
    {
        value: "witty",
        label: "Witty",
        description: "Clever, playful, with a dash of humor",
    },
    {
        value: "professional",
        label: "Professional",
        description: "Polished, refined, elegantly warm",
    },
];

export default function NewSpacePage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [businessType, setBusinessType] = useState<BusinessType | "">("");
    const [tone, setTone] = useState<ToneType | "">("");
    const [context, setContext] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !businessType || !tone) return;

        setIsSubmitting(true);

        // TODO: Save to database via Supabase
        // For now, just navigate back to spaces list
        console.log("Creating space:", { name, businessType, tone, context });

        // Simulate creation delay
        await new Promise((r) => setTimeout(r, 500));
        router.push("/spaces");
        setIsSubmitting(false);
    };

    return (
        <div className="max-w-2xl" id="new-space-page">
            <div className="mb-8">
                <h1 className="text-2xl font-display italic text-foreground">
                    Create a New Space
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Set up an AI greeter for a new location.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Space Name */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Space Details</CardTitle>
                        <CardDescription>
                            Give your space a name and tell us about your business.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="space-name">Space Name</Label>
                            <Input
                                id="space-name"
                                placeholder='e.g. "Downtown Boutique" or "Main Lobby"'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="business-type">Business Type</Label>
                            <Select
                                value={businessType}
                                onValueChange={(v) => setBusinessType(v as BusinessType)}
                                required
                            >
                                <SelectTrigger id="business-type">
                                    <SelectValue placeholder="Select a business type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {businessTypes.map((bt) => (
                                        <SelectItem key={bt.value} value={bt.value}>
                                            <span className="flex items-center gap-2">
                                                <span>{bt.emoji}</span>
                                                <span>{bt.label}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Tone */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Greeting Tone</CardTitle>
                        <CardDescription>
                            How should HeyYou talk to your guests?
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            {toneOptions.map((t) => (
                                <button
                                    type="button"
                                    key={t.value}
                                    onClick={() => setTone(t.value)}
                                    className={`flex flex-col items-start p-4 rounded-lg border text-left transition-all duration-200 ${tone === t.value
                                        ? "border-amber bg-amber/5 ring-1 ring-amber/30"
                                        : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
                                        }`}
                                    id={`tone-${t.value}`}
                                >
                                    <span
                                        className={`text-sm font-medium ${tone === t.value ? "text-amber" : "text-foreground"
                                            }`}
                                    >
                                        {t.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        {t.description}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Context */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Extra Context</CardTitle>
                        <CardDescription>
                            Any additional info the AI should know? Current promotions,
                            seasonal events, or specific vibes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            id="space-context"
                            placeholder="e.g. Running a 20% off sale on winter coats. Our brand vibe is boho-chic."
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            rows={4}
                        />
                    </CardContent>
                </Card>

                {/* Submit */}
                <div className="flex items-center gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={!name || !businessType || !tone || isSubmitting}
                        className="bg-amber text-[#0C0A09] hover:bg-amber/90 disabled:opacity-50"
                        id="create-space-button"
                    >
                        {isSubmitting ? "Creating..." : "Create Space"}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="text-muted-foreground"
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
