import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import stripeRoutes from "./routes/stripe.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Use the Stripe routes
app.use("/stripe", stripeRoutes);

app.get("/", (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));