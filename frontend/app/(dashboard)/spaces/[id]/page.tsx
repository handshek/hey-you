import { GreeterYoloCall } from "@/components/greeter-yolo-call";

interface SpacePageProps {
  params: Promise<{ id: string }>;
}

export default async function SpaceDashboardPage({ params }: SpacePageProps) {
  const { id } = await params;
  return <GreeterYoloCall spaceId={id} />;
}
