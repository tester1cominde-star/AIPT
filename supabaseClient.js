import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log("✅ Supabase client initialized");
} else {
  console.warn("⚠️  SUPABASE_URL or SUPABASE_ANON_KEY not set - database features disabled");
}

export { supabase };

/**
 * Save food analysis to Supabase
 */
export async function saveFoodLog(foodData) {
  if (!supabase) {
    console.warn("Supabase not configured - skipping database save");
    return null;
  }

  const { data, error } = await supabase
    .from("food_logs")
    .insert({
      user_id: foodData.user_id,
      food_name: foodData.food_name,
      portion_estimate: foodData.portion_estimate,
      calories_kcal: foodData.calories_kcal,
      protein_g: foodData.protein_g,
      carbs_g: foodData.carbs_g,
      fat_g: foodData.fat_g,
      saturated_fat_g: foodData.saturated_fat_g,
      sugar_g: foodData.sugar_g,
      fiber_g: foodData.fiber_g,
      sodium_mg: foodData.sodium_mg,
      confidence: foodData.confidence,
      notes: foodData.notes,
      image_url: foodData.image_url,
      barcode: foodData.barcode,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save food log: ${error.message}`);
  }

  return data;
}

/**
 * Get daily summary for a user
 */
export async function getDailySummary(userId, date = null) {
  if (!supabase) {
    throw new Error("Supabase not configured - database features disabled");
  }

  const queryDate = date || new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", queryDate)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get daily summary: ${error.message}`);
  }

  // Calculate totals
  const summary = {
    date: queryDate,
    user_id: userId,
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0,
    total_saturated_fat: 0,
    total_sugar: 0,
    total_fiber: 0,
    total_sodium: 0,
    food_count: data.length,
    foods: data,
  };

  data.forEach((food) => {
    summary.total_calories += Number(food.calories_kcal) || 0;
    summary.total_protein += Number(food.protein_g) || 0;
    summary.total_carbs += Number(food.carbs_g) || 0;
    summary.total_fat += Number(food.fat_g) || 0;
    summary.total_saturated_fat += Number(food.saturated_fat_g) || 0;
    summary.total_sugar += Number(food.sugar_g) || 0;
    summary.total_fiber += Number(food.fiber_g) || 0;
    summary.total_sodium += Number(food.sodium_mg) || 0;
  });

  return summary;
}
