"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { GreeterYoloCall } from "@/components/greeter-yolo-call";
import { loadSpaceConfig } from "@/lib/space-config";

export default function GreeterPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "unknown";
  const config = useMemo(() => loadSpaceConfig(id), [id]);
  const name = config?.name ?? `Space ${id}`;

  return <GreeterYoloCall spaceId={id} spaceName={name} videoInput="camera" spaceConfig={config} />;
}
