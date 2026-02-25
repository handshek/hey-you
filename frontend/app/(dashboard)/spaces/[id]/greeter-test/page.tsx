import { GreeterYoloCall } from "@/components/greeter-yolo-call";

interface GreeterTestPageProps {
  params: Promise<{ id: string }>;
}

export default async function GreeterTestPage({
  params,
}: GreeterTestPageProps) {
  const { id } = await params;

  return <GreeterYoloCall spaceId={id} spaceName={`Space ${id}`} />;
}
