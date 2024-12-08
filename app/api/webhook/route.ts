import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text(); // Retrieve raw request body
  const signature = headers().get("Stripe-Signature") as string; // Retrieve Stripe signature

  let event: Stripe.Event;

  try {
    // Verify and construct the Stripe event
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error("[WEBHOOK_ERROR]", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Extract session data from the event
  const session = event.data.object as Stripe.Checkout.Session;

  try {
    if (event.type === "checkout.session.completed") {
      console.log("[WEBHOOK] Checkout Session Completed");

      // Retrieve the subscription associated with the session
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      // Ensure userId exists in the session metadata
      if (!session?.metadata?.userId) {
        return new NextResponse("User ID is required", { status: 400 });
      }

      console.log("[WEBHOOK] User ID:", session.metadata.userId);

      // Create a new user subscription in the database
      await prismadb.userSubscription.create({
        data: {
          userId: session.metadata.userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        },
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      console.log("[WEBHOOK] Invoice Payment Succeeded");

      // Retrieve the subscription from the session
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      // Update the subscription details in the database
      await prismadb.userSubscription.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
        },
      });
    }
  } catch (error: any) {
    console.error("[WEBHOOK_PROCESSING_ERROR]", error.message);
    return new NextResponse("Webhook Processing Error", { status: 500 });
  }

  // Respond with 200 status to acknowledge receipt of the event
  return new NextResponse(null, { status: 200 });
}

export const dynamic = "force-dynamic";
