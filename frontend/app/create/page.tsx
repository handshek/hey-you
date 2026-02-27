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
import { generateSpaceId, saveSpaceConfig } from "@/lib/space-config";

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

export default function CreatePage() {
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

    const id = generateSpaceId();
    saveSpaceConfig({
      id,
      name,
      businessType,
      tone,
      context,
      createdAt: new Date().toISOString(),
    });

    router.push(`/greeter/${id}`);
  };

  return (
    <main className="min-h-screen bg-[#0C0A09] text-foreground py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display italic">Create a Greeter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your space, then launch the greeter session.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Space Details</CardTitle>
              <CardDescription>
                Give your space a name and choose a business type.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="space-name">Space Name</Label>
                <Input
                  id="space-name"
                  placeholder='e.g. "Downtown Boutique"'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-type">Business Type</Label>
                <Select
                  value={businessType}
                  onValueChange={(value) =>
                    setBusinessType(value as BusinessType)
                  }
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Greeting Tone</CardTitle>
              <CardDescription>
                How should HeyYou speak to people entering your space?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {toneOptions.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setTone(item.value)}
                    className={`flex flex-col items-start p-4 rounded-lg border text-left transition-colors ${
                      tone === item.value
                        ? "border-amber bg-amber/5 ring-1 ring-amber/30"
                        : "border-border hover:border-muted-foreground/40 hover:bg-secondary/40"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        tone === item.value ? "text-amber" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extra Context</CardTitle>
              <CardDescription>
                Optional details for the agent (promotions, seasonal notes,
                etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                placeholder="e.g. Running a weekend promotion on jackets."
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!name || !businessType || !tone || isSubmitting}
              className="bg-amber text-[#0C0A09] hover:bg-amber/90"
            >
              {isSubmitting ? "Creating..." : "Create and Launch"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
