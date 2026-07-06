import express from "express";
import { getDailySummary } from "../supabaseClient.js";

const router = express.Router();

// Daily summary endpoint
router.get("/daily-summary", async (req, res) => {
  const userId = req.query.user_id || req.headers["x-user-id"];
  const date = req.query.date;

  if (!userId) {
    return res.status(400).json({ error: "user_id is required in query or header" });
  }

  try {
    const summary = await getDailySummary(userId, date);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to get daily summary", details: err.message });
  }
});

// Ping endpoint for self-ping cron job
router.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Server is awake" });
});

export default router;
