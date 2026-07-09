import express from "express";
import multer from "multer";
import { analyzeFoodImage } from "../models/groqService.js";
import { saveFoodLog } from "../supabaseClient.js";
import { getProductFromBarcode } from "../barcodeUtils.js";
import { detectBarcode } from "../barcodeScanner.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Analyze food image with Groq
router.post("/analyze-food", upload.single("image"), async (req, res) => {
  const file = req.file;
  const userId = req.body.user_id || req.headers["x-user-id"];

  if (!file) {
    return res.status(400).json({ error: "Image is required in field named 'image'" });
  }

  if (!userId) {
    return res.status(400).json({ error: "user_id is required in body or header" });
  }

  try {
    const base64Image = file.buffer.toString("base64");
    const result = await analyzeFoodImage(base64Image, file.mimetype);

    if (result.success) {
      try {
        const savedLog = await saveFoodLog({
          user_id: userId,
          ...result.data,
        });
        return res.json({ success: true, data: result.data, log_id: savedLog?.id });
      } catch (dbError) {
        console.error("Failed to save to Supabase:", dbError);
        return res.json({ success: true, data: result.data, warning: "Failed to save to database" });
      }
    }

    return res.status(result.status || 500).json({
      error: "Failed to analyze food image",
      details: result.details,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


// Analyze barcode from image
router.post("/analyze-barcode", upload.single("image"), async (req, res) => {
  const file = req.file;
  const userId = req.body.user_id || req.headers["x-user-id"];

  if (!file) {
    return res.status(400).json({ error: "Image is required in field named 'image'" });
  }

  if (!userId) {
    return res.status(400).json({ error: "user_id is required in body or header" });
  }

  try {
    const imageBuffer = file.buffer;
    const barcode = await detectBarcode(imageBuffer);

    if (!barcode) {
      return res.status(400).json({ error: "No barcode detected in image" });
    }

    const foodData = await getProductFromBarcode(barcode);

    // Save to Supabase
    try {
      const savedLog = await saveFoodLog({
        user_id: userId,
        ...foodData,
      });
      return res.json({ success: true, data: foodData, barcode: barcode, log_id: savedLog?.id });
    } catch (dbError) {
      console.error("Failed to save to Supabase:", dbError);
      return res.json({ success: true, data: foodData, barcode: barcode, warning: "Failed to save to database" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to analyze barcode", details: err.message });
  }
});

export default router;