import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import OpenAI from "openai";

import { checkSubscription } from "@/lib/subscription";
import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE, // Optional: Use for custom endpoints
});

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { prompt, amount = 1, resolution = "512x512" } = body;

    // User authentication check
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Ensure OpenAI API Key is configured
    if (!process.env.OPENAI_API_KEY) {
      return new NextResponse("OpenAI API Key not configured.", {
        status: 500,
      });
    }

    // Validate required fields
    if (!prompt) {
      return new NextResponse("Prompt is required.", { status: 400 });
    }

    // Check if `amount` and `resolution` are valid
    if (!amount || isNaN(amount) || parseInt(amount, 10) <= 0) {
      return new NextResponse("Amount must be a positive integer.", {
        status: 400,
      });
    }

    const validResolutions = ["256x256", "512x512", "1024x1024"];
    if (!validResolutions.includes(resolution)) {
      return new NextResponse(
        `Resolution must be one of ${validResolutions.join(", ")}.`,
        { status: 400 }
      );
    }

    // Check usage limits
    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse(
        "Free trial has expired. Please upgrade to pro.",
        { status: 403 }
      );
    }

    // Generate images via OpenAI API
    const response = await openai.images.generate({
      prompt,
      n: parseInt(amount, 10),
      size: resolution,
    });

    // Increment API usage count if user is not a Pro subscriber
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return generated images
    return NextResponse.json(response.data);
  } catch (error) {
    console.error("[IMAGE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
