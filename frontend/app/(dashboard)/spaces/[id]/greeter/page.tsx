import { GreeterCall } from "@/components/greeter-call";

interface GreeterPageProps {
  params: Promise<{ id: string }>;
}

export default async function GreeterPage({ params }: GreeterPageProps) {
  const { id } = await params;

  return <GreeterCall spaceId={id} spaceName={`Space ${id}`} />;
}
