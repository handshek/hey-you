import { GreeterScreen } from "@/components/greeter-screen";

interface GreeterPageProps {
    params: Promise<{ id: string }>;
}

// This page is the full-screen greeter view that displays on the iPad/laptop.
// It reads the Space config and passes it to the greeter screen.
// Eventually, this will fetch space data from the database and connect to Stream.

export default async function GreeterPage({ params }: GreeterPageProps) {
    const { id } = await params;

    // TODO: Fetch space configuration from database using space ID
    // TODO: Create/join a Stream video call for this space
    // TODO: Wire up real-time greeting text from the vision agent

    return <GreeterScreen spaceName={`Space ${id}`} />;
}
