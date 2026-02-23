import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { user_id } = await request.json();

        if (!user_id || typeof user_id !== "string") {
            return NextResponse.json(
                { error: "user_id is required and must be a string" },
                { status: 400 }
            );
        }

        const apiSecret = process.env.STREAM_API_SECRET;
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

        if (!apiSecret || !apiKey) {
            return NextResponse.json(
                { error: "Stream API credentials are not configured" },
                { status: 500 }
            );
        }

        // Dynamic import to avoid bundling issues — Stream server SDK
        const { StreamClient } = await import("@stream-io/node-sdk");
        const client = new StreamClient(apiKey, apiSecret);

        // Generate a user token for the Stream Video SDK
        const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour expiry
        const token = client.generateUserToken({ user_id, expiration: exp });

        return NextResponse.json({ token });
    } catch (error) {
        console.error("Error generating Stream token:", error);
        return NextResponse.json(
            { error: "Failed to generate token" },
            { status: 500 }
        );
    }
}
