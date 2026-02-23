export default function GreeterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Override the dashboard layout — greeter is full screen with no sidebar
    return <>{children}</>;
}
