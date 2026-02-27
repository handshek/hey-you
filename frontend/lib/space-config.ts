"use client";

import type { BusinessType, ToneType } from "@/types";

export interface SpaceConfig {
  id: string;
  name: string;
  businessType: BusinessType;
  tone: ToneType;
  context: string;
  createdAt: string;
}

const keyFor = (id: string) => `heyyou:space-config:${id}`;

export function generateSpaceId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `sp-${random}`;
}

export function saveSpaceConfig(config: SpaceConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(config.id), JSON.stringify(config));
}

export function loadSpaceConfig(id: string): SpaceConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyFor(id));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SpaceConfig;
  } catch {
    return null;
  }
}
