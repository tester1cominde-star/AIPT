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
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Food Calorie Analyzer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2.5em;
    }
    .status {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 0.9em;
      margin-bottom: 30px;
      font-weight: 600;
    }
    .description {
      color: #666;
      margin-bottom: 40px;
      line-height: 1.6;
    }
    .endpoints {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .endpoint {
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 10px;
      padding: 20px;
      text-align: left;
      transition: all 0.3s ease;
    }
    .endpoint:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
    }
    .endpoint h3 {
      color: #333;
      margin-bottom: 8px;
      font-size: 1.1em;
    }
    .endpoint .method {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 4px 10px;
      border-radius: 5px;
      font-size: 0.8em;
      font-weight: 600;
      margin-right: 8px;
    }
    .endpoint .url {
      color: #667eea;
      font-family: monospace;
      font-size: 0.95em;
    }
    .endpoint p {
      color: #666;
      margin-top: 10px;
      font-size: 0.9em;
    }
    .footer {
      margin-top: 30px;
      color: #999;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Food Calorie Analyzer</h1>
    <div class="status">System Running</div>
    <p class="description">
      Upload food images to analyze nutritional content using AI. 
      Three main APIs available for food analysis, barcode lookup, and daily summaries.
    </p>
    <div class="endpoints">
      <div class="endpoint">
        <h3><span class="method">POST</span><span class="url">/analyze-food</span></h3>
        <p>Analyze food image with AI. Upload an image to get nutritional estimates.</p>
      </div>
      <div class="endpoint">
        <h3><span class="method">POST</span><span class="url">/analyze-barcode</span></h3>
        <p>Analyze barcode from image. Upload an image containing a barcode to get product info.</p>
      </div>
      <div class="endpoint">
        <h3><span class="method">GET</span><span class="url">/health/daily-summary</span></h3>
        <p>Get daily food summary for a user. Requires user_id parameter.</p>
      </div>
    </div>
    <p class="footer">Food Calorie Analyzer Backend v2.0.0</p>
  </div>
</body>
</html>
  `);
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
