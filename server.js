import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import axios from "axios";
import foodRoutes from "./routes/foodRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/", foodRoutes);
app.use("/health", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("Food Calorie Analyzer Backend is running - Use POST /analyze-food");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Self-ping cron job to keep the server awake
if (process.env.BASE_URL) {
  cron.schedule("*/14 * * * *", () => {
    console.log("Pinging the server to keep it alive...");
    axios
      .get(`${process.env.BASE_URL}/health/ping`)
      .then((response) => {
        console.log("Ping successful:", response.data);
      })
      .catch((error) => {
        if (error.response) {
          console.error(
            "Server responded with an error:",
            error.response.status,
            error.response.data,
          );
        } else if (error.request) {
          console.error("No response received:", error.request);
        } else {
          console.error("Error setting up the request:", error.message);
        }
      });
  });
  console.log("Self-ping cron job started (every 14 minutes)");
} else {
  console.log("BASE_URL not set, self-ping cron job disabled");
}
