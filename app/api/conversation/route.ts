import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import OpenAI from "openai";

import { checkSubscription } from "@/lib/subscription";
import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE, // Optional: Use if you're pointing to a custom base URL
});

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { messages } = body;

    // Ensure the user is authenticated
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse("OpenAI API Key not configured.", {
        status: 500,
      });
    }

    // Validate input messages
    if (!messages || !Array.isArray(messages)) {
      return new NextResponse("Messages are required and must be an array.", {
        status: 400,
      });
    }

    // Check API usage limits
    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse(
        "Free trial has expired. Please upgrade to pro.",
        { status: 403 }
      );
    }

    // Call OpenAI's chat completions endpoint
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
    });

    // Increment API usage count if not a pro user
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return the first choice's message as a JSON response
    return NextResponse.json(response.choices[0].message);
  } catch (error) {
    console.error("[CONVERSATION_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
