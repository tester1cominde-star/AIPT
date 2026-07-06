import express from "express";
import multer from "multer";
import fs from "fs";
import { analyzeFoodImage } from "../models/groqService.js";
import { saveFoodLog } from "../supabaseClient.js";
import { getProductFromBarcode } from "../barcodeUtils.js";
import { detectBarcode } from "../barcodeScanner.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Analyze food image with Groq (first checks for barcode)
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
    const imageBuffer = fs.readFileSync(file.path);

    // First try to detect barcode
    
    try {
      const barcode = await detectBarcode(imageBuffer);
      if (barcode) {
        const foodData = await getProductFromBarcode(barcode);
        fs.unlink(file.path, () => {});
        
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
      }
    } catch (barcodeError) {
      console.log("No barcode detected, proceeding with food analysis");
    }
  

    // If no barcode, analyze with Groq
    const base64Image = imageBuffer.toString("base64");
    const result = await analyzeFoodImage(base64Image, file.mimetype);

    if (result.success) {
      fs.unlink(file.path, () => {});

      // Save to Supabase
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

    fs.unlink(file.path, () => {});
    return res.status(result.status || 500).json({
      error: "Failed to analyze food image",
      details: result.details,
    });
  } catch (err) {
    console.error(err);
    if (file?.path) fs.unlink(file.path, () => {});
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Scan barcode from image
router.post("/scan-barcode", upload.single("image"), async (req, res) => {
  const file = req.file;
  const userId = req.body.user_id || req.headers["x-user-id"];

  if (!file) {
    return res.status(400).json({ error: "Image is required in field named 'image'" });
  }

  if (!userId) {
    return res.status(400).json({ error: "user_id is required in body or header" });
  }

  try {
    const imageBuffer = fs.readFileSync(file.path);
    const barcode = await detectBarcode(imageBuffer);

    if (!barcode) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "No barcode detected in image" });
    }

    const foodData = await getProductFromBarcode(barcode);
    fs.unlink(file.path, () => {});

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
    if (file?.path) fs.unlink(file.path, () => {});
    return res.status(500).json({ error: "Failed to scan barcode", details: err.message });
  }
});

// Analyze barcode by number
router.post("/analyze-barcode", async (req, res) => {
  const { barcode } = req.body;
  const userId = req.body.user_id || req.headers["x-user-id"];

  if (!barcode) {
    return res.status(400).json({ error: "barcode is required in request body" });
  }

  if (!userId) {
    return res.status(400).json({ error: "user_id is required in body or header" });
  }

  try {
    const foodData = await getProductFromBarcode(barcode);

    // Save to Supabase
    try {
      const savedLog = await saveFoodLog({
        user_id: userId,
        ...foodData,
      });
      return res.json({ success: true, data: foodData, log_id: savedLog?.id });
    } catch (dbError) {
      console.error("Failed to save to Supabase:", dbError);
      return res.json({ success: true, data: foodData, warning: "Failed to save to database" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to analyze barcode", details: err.message });
  }
});

export default router;
