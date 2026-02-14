import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import stripeRoutes from "./routes/stripe.js";
import livekitRoutes from "./routes/livekit.js";

dotenv.config();

const app = express();
app.set("trust proxy", true); 

app.use(cors());
app.use(express.json());

// Use the Stripe routes
//app.use("/stripe", stripeRoutes);
// Mount Stripe routes only if a key is present
if (process.env.STRIPE_SECRET_KEY) {
  app.use("/stripe", stripeRoutes);
} else {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — /stripe endpoints are disabled.");
}

// LiveKit API
app.use("/api/livekit", livekitRoutes);

app.get("/", (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));