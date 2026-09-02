import { serve } from "https://deno.land/x/sserve@v1.0.0/mod.ts";
import Stripe from "https://esm.sh/stripe@14.2.0?target=deno";

// Initialize Stripe with your secret key
const stripe = Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, currency, metadata } = await req.json();

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata,
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
      }),
      {
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating payment intent:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});