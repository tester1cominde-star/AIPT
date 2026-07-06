import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

console.log("Groq client initialized");

// ملاحظة: response_format: "json_object" (المستخدم تحت) بيضمن إن الرد JSON صحيح بس،
// من غير ما يضمن التزامه بأسماء/أنواع حقول معينة. عشان نضمن الالتزام بالحقول،
// لازم نوصف الشكل المطلوب بوضوح جوه نص الـ prompt نفسه (زي تحت).
const RESPONSE_SHAPE_DESCRIPTION = `
{
  "food_name": string,            // اسم الأكلة المتوقع
  "portion_estimate": string,     // تقدير حجم الحصة، مثلاً "1 plate" أو "250g"
  "calories_kcal": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "saturated_fat_g": number,
  "sugar_g": number,
  "fiber_g": number,
  "sodium_mg": number,
  "confidence": "low" | "medium" | "high",
  "notes": string                 // أي ملاحظات عن دقة التقدير
}`.trim();

const PROMPT = `You are a nutrition analysis assistant. Look at the food image and estimate its nutritional content.
Identify the dish, estimate the portion size shown in the image, and provide your best estimate for calories and macronutrients for that visible portion (not per 100g, unless that's all that's visible).
If multiple food items are visible, sum their totals into one combined estimate and mention them in food_name.
Be realistic — use your knowledge of typical recipes and portions. If you are unsure, still give a best-effort numeric estimate and reflect the uncertainty in the "confidence" and "notes" fields.

Respond ONLY with valid JSON matching exactly this structure (no extra fields, no markdown, no explanation text):
${RESPONSE_SHAPE_DESCRIPTION}`;

// الحقول اللي لازم تكون موجودة دايمًا في رد الموديل - لو ناقصة نرفض الرد بدل ما نبعت بيانات غير مكتملة
const REQUIRED_FIELDS = ["food_name", "calories_kcal", "protein_g", "carbs_g", "fat_g", "confidence"];

function validateShape(data) {
  const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === null);
  return { valid: missing.length === 0, missing };
}

/**
 * Parse nutritional data from text response
 */
function parseTextResponse(text) {
  const data = {
    food_name: "",
    portion_estimate: "",
    calories_kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    saturated_fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
    confidence: "medium",
    notes: "",
  };

  // Extract food name
  const foodMatch = text.match(/food[_\s]?name[:\s]+([^\n,]+)/i) || text.match(/(?:food|dish|item)[:\s]+([^\n,]+)/i);
  if (foodMatch) data.food_name = foodMatch[1].trim();

  // Extract portion
  const portionMatch = text.match(/portion[_\s]?estimate[:\s]+([^\n,]+)/i) || text.match(/portion[:\s]+([^\n,]+)/i);
  if (portionMatch) data.portion_estimate = portionMatch[1].trim();

  // Extract calories
  const caloriesMatch = text.match(/calories[_\s]?kcal[:\s]+(\d+)/i) || text.match(/calories[:\s]+(\d+)/i);
  if (caloriesMatch) data.calories_kcal = parseInt(caloriesMatch[1]);

  // Extract protein
  const proteinMatch = text.match(/protein[_\s]?g[:\s]+(\d+\.?\d*)/i) || text.match(/protein[:\s]+(\d+\.?\d*)/i);
  if (proteinMatch) data.protein_g = parseFloat(proteinMatch[1]);

  // Extract carbs
  const carbsMatch = text.match(/carbs[_\s]?g[:\s]+(\d+\.?\d*)/i) || text.match(/carbohydrates[:\s]+(\d+\.?\d*)/i);
  if (carbsMatch) data.carbs_g = parseFloat(carbsMatch[1]);

  // Extract fat
  const fatMatch = text.match(/fat[_\s]?g[:\s]+(\d+\.?\d*)/i) || text.match(/fat[:\s]+(\d+\.?\d*)/i);
  if (fatMatch) data.fat_g = parseFloat(fatMatch[1]);

  // Extract saturated fat
  const satFatMatch = text.match(/saturated[_\s]?fat[_\s]?g[:\s]+(\d+\.?\d*)/i);
  if (satFatMatch) data.saturated_fat_g = parseFloat(satFatMatch[1]);

  // Extract sugar
  const sugarMatch = text.match(/sugar[_\s]?g[:\s]+(\d+\.?\d*)/i);
  if (sugarMatch) data.sugar_g = parseFloat(sugarMatch[1]);

  // Extract fiber
  const fiberMatch = text.match(/fiber[_\s]?g[:\s]+(\d+\.?\d*)/i);
  if (fiberMatch) data.fiber_g = parseFloat(fiberMatch[1]);

  // Extract sodium
  const sodiumMatch = text.match(/sodium[_\s]?mg[:\s]+(\d+)/i);
  if (sodiumMatch) data.sodium_mg = parseInt(sodiumMatch[1]);

  // Extract confidence
  const confidenceMatch = text.match(/confidence[:\s]+(low|medium|high)/i);
  if (confidenceMatch) data.confidence = confidenceMatch[1].toLowerCase();

  // Extract notes
  const notesMatch = text.match(/notes[:\s]+([^\n]+)/i);
  if (notesMatch) data.notes = notesMatch[1].trim();

  // If food name is still empty, try to extract from beginning of text
  if (!data.food_name) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.includes(':') && line.length < 100) {
        data.food_name = line.trim();
        break;
      }
    }
  }

  return data;
}

export async function analyzeFoodImage(imageBase64, mimeType) {
  try {
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.5,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return { error: true, status: 502, details: "No response from Groq" };
    }

    let parsedData;
    try {
      // Try to parse directly first
      parsedData = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks or text
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[1]);
        } catch {
          // If JSON parsing fails, parse text response
          parsedData = parseTextResponse(content);
        }
      } else {
        // Try to find JSON-like object in the text
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            parsedData = JSON.parse(objMatch[0]);
          } catch {
            // If JSON parsing fails, parse text response
            parsedData = parseTextResponse(content);
          }
        } else {
          // Parse text response
          parsedData = parseTextResponse(content);
        }
      }
    }

    const { valid, missing } = validateShape(parsedData);
    if (!valid) {
      return {
        error: true,
        status: 502,
        details: `Groq response missing required fields: ${missing.join(", ")}`,
        raw: parsedData,
      };
    }

    return { success: true, data: parsedData };
  } catch (error) {
    console.error("Groq API error:", error);
    return { error: true, status: error.status || 500, details: error.message };
  }
}