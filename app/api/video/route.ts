import Replicate from "replicate";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { incrementApiLimit, checkApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

// Initialize Replicate with the API token from environment variables
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(req: Request) {
  try {
    const { userId } = auth(); // Authenticate the user
    const body = await req.json(); // Parse the request body
    const { prompt } = body; // Extract the prompt from the body

    // Check if the user is authenticated
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Validate the presence of a prompt
    if (!prompt) {
      return new NextResponse("Prompt is required", { status: 400 });
    }

    // Check user's API limit and subscription status
    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    // If no free trial or subscription is available, restrict access
    if (!freeTrial && !isPro) {
      return new NextResponse(
        "Free trial has expired. Please upgrade to pro.",
        { status: 403 }
      );
    }

    // Run the Replicate model for video generation
    const response = await replicate.run(
      "anotherjesse/zeroscope-v2-xl:71996d331e8ede8ef7bd76eba9fae076d31792e4ddf4ad057779b443d6aea62f",
      {
        input: {
          prompt, // Pass the user-provided prompt
        },
      }
    );

    // Increment API usage for non-subscribed users
    if (!isPro) {
      await incrementApiLimit();
    }

    // Return the generated response
    return NextResponse.json(response);
  } catch (error) {
    console.error("[VIDEO_ERROR]", error); // Log the error for debugging
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
