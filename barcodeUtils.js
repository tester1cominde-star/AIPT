/**
 * Fetch product information from Open Food Facts API using barcode
 */
export async function getProductFromBarcode(barcode) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (!data.success || !data.product) {
      throw new Error("Product not found in Open Food Facts database");
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    // Extract nutritional information
    const foodData = {
      food_name: product.product_name || product.product_name_en || "Unknown Product",
      barcode: barcode,
      calories_kcal: nutriments["energy-kcal_100g"] || nutriments["energy-kcal"] || 0,
      protein_g: nutriments["proteins_100g"] || nutriments["proteins"] || 0,
      carbs_g: nutriments["carbohydrates_100g"] || nutriments["carbohydrates"] || 0,
      fat_g: nutriments["fat_100g"] || nutriments["fat"] || 0,
      saturated_fat_g: nutriments["saturated-fat_100g"] || nutriments["saturated-fat"] || 0,
      sugar_g: nutriments["sugars_100g"] || nutriments["sugars"] || 0,
      fiber_g: nutriments["fiber_100g"] || nutriments["fiber"] || 0,
      sodium_mg: (nutriments["sodium_100g"] || nutriments["sodium"] || 0) * 1000, // Convert to mg
      portion_estimate: `${nutriments["serving_size"] || "100g"}`,
      confidence: "high",
      notes: "Data from Open Food Facts database",
    };

    return foodData;
  } catch (error) {
    throw new Error(`Failed to fetch product data: ${error.message}`);
  }
}
