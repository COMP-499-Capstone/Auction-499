import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-connected-account", async (req, res) => {
  try {
    const { email } = req.body;

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      capabilities: { transfers: { requested: true } },
    });

    res.json({ accountId: account.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/create-checkout-session", async (req, res) => {
    console.log("✅ /create-checkout-session hit!", req.body);
    try {
      const { seller_account, amount, profileId } = req.body;
  
      if (!seller_account || !amount) {
        return res.status(400).json({ error: "Missing seller_account or amount" });
      }
  
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Auction Payment" },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://localhost:5173/profile/${profileId}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/profile/${profileId}/cancel`,
      });

      console.log(session);
      res.json({ url: session.url, id: session.id });
    } catch (err) {
      console.error("Error creating checkout session:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/verify-payment", async (req, res) => {
    console.log("✅ /create-checkout-session hit!", req.body);
    try {
      const { checkoutIds } = req.body;
  
      if (!checkoutIds || !Array.isArray(checkoutIds)) {
        return res.status(400).json({ error: "checoutIds must be an array" });
      }

      const results = [];

      for (const id of checkoutIds) {
        try {
          const session = await stripe.checkout.sessions.retrieve(id);
          results.push({
            id,
            status: session.payment_status === "paid" ? "paid" : "pending",
          });
        } catch (err) {
          console.error(`Error verifying checkout Id ${id}:`, err);
          results.push({ id, status: "error", message: err.message });
        }
      }
  
      res.json({ results });
    } catch (err) {
      console.error("Error verifying payment:", err);
      res.status(500).json({ error: err.message });
    }
  });

export default router;