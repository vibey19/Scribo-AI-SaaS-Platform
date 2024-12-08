import Replicate from "replicate";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(req: Request) {
  try {
    // Authentication and request validation
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return new NextResponse(
        "Prompt is required and must be a non-empty string.",
        { status: 400 }
      );
    }

    // Check API usage limits and subscription status
    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse(
        "Free trial has expired. Please upgrade to pro.",
        { status: 403 }
      );
    }

    // Call Replicate's API with the Riffusion model
    const response = await replicate.run(
      "riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05",
      {
        input: {
          prompt_a: prompt,
        },
      }
    );

    // Increment API usage for non-Pro users
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return the API response
    return NextResponse.json(response);
  } catch (error) {
    console.error("[MUSIC_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
