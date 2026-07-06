import { createKeyPool, classifyQuotaError } from "../keyPool.js";
import dotenv from "dotenv";
dotenv.config(); 
const GEMINI_MODEL = "gemini-2.0-flash";
const keyPool = createKeyPool(process.env.GEMINI_API_KEYS);

console.log(`Key pool created with ${keyPool.size()} keys`);

function buildGeminiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    food_name: { type: "STRING", description: "Expected food name" },
    portion_estimate: { type: "STRING", description: "Portion size estimate, e.g. '1 plate' or '250g'" },
    calories_kcal: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    saturated_fat_g: { type: "NUMBER" },
    sugar_g: { type: "NUMBER" },
    fiber_g: { type: "NUMBER" },
    sodium_mg: { type: "NUMBER" },
    confidence: { type: "STRING", description: "low, medium, or high" },
    notes: { type: "STRING", description: "Notes about estimation accuracy" },
  },
  required: [
    "food_name",
    "calories_kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "confidence",
  ],
};

const PROMPT = `You are a nutrition analysis assistant. Look at the food image and estimate its nutritional content.
Identify the dish, estimate the portion size shown in the image, and provide your best estimate for calories and macronutrients for that visible portion (not per 100g, unless that's all that's visible).
If multiple food items are visible, sum their totals into one combined estimate and mention them in food_name.
Be realistic — use your knowledge of typical recipes and portions. If you are unsure, still give a best-effort numeric estimate and reflect the uncertainty in the "confidence" and "notes" fields.
Respond only with the structured data requested.`;

async function callGeminiWithKey(apiKey, imageBase64, mimeType) {
  const geminiRequestBody = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  };

  const geminiRes = await fetch(buildGeminiUrl(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiRequestBody),
  });

  let geminiData;
  try {
    geminiData = await geminiRes.json();
  } catch {
    return { error: true, status: geminiRes.status || 502, details: "Unexpected response from server" };
  }

  if (geminiRes.status === 429) {
    const kind = classifyQuotaError(geminiData);
    keyPool.markExhausted(apiKey, kind);
    return { exhausted: true };
  }

  if (!geminiRes.ok) {
    return { error: true, status: geminiRes.status, details: geminiData };
  }

  const textPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) {
    return { error: true, status: 502, details: geminiData };
  }

  return { success: true, data: JSON.parse(textPart) };
}

export async function analyzeFoodImage(imageBase64, mimeType) {
  const maxAttempts = keyPool.size();
  let lastFailure = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, allExhausted, retryAfterMs } = keyPool.getAvailableKey();

    if (allExhausted) {
      return { 
        exhausted: true, 
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000) 
      };
    }

    const result = await callGeminiWithKey(key, imageBase64, mimeType);

    if (result.success) {
      return result;
    }

    if (result.exhausted) {
      console.warn(`Key ${keyPool.keys.indexOf(key)} quota exhausted, trying next key...`);
      lastFailure = { error: "Key quota exhausted", status: 429 };
      continue;
    }

    return result;
  }

  return { 
    exhausted: true, 
    details: lastFailure 
  };
}
