import { StreamVideoClient } from "@stream-io/video-react-sdk";

let client: StreamVideoClient | null = null;

export function getStreamClient(apiKey: string, token: string, userId: string): StreamVideoClient {
    if (!client) {
        client = new StreamVideoClient({
            apiKey,
            user: { id: userId },
            token,
        });
    }
    return client;
}

export function disconnectStreamClient(): void {
    if (client) {
        client.disconnectUser();
        client = null;
    }
}
