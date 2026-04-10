// functions/handlers/food_processing_handler.js

const {
  getGeminiCalorieCounter,
} = require("../utils/llm/gemini/gemini_calorie_counter");
const {
  FOOD_ANALYSIS_FIELDS,
} = require("../config/firebase/food_data_schema");

/**
 * Wrapper handler around Gemini calorie counter utilities.
 * Keeps Gemini-specific calls out of webhook / trigger / controller layers.
 */
class FoodProcessingHandler {
  /**
   * Analyze a food photo and return both:
   * 1) extracted food items + approximate quantities
   * 2) calorie estimation based on the extracted items
   *
   * @param {Object} params
   * @param {Buffer|Uint8Array|string} params.imageBuffer
   * @param {string} [params.mimeType="image/jpeg"]
   * @returns {Promise<Object>}
   */
  async processFoodPhoto({
    imageBuffer,
    mimeType = "image/jpeg",
  }) {
    const geminiCalorieCounter = getGeminiCalorieCounter();

    const foodExtractionResult =
      await geminiCalorieCounter.extractFoodItemsFromPhoto({
        imageBuffer,
        mimeType,
      });

    const foodItems = Array.isArray(foodExtractionResult?.[FOOD_ANALYSIS_FIELDS.ITEMS]) ?
      foodExtractionResult[FOOD_ANALYSIS_FIELDS.ITEMS] :
      [];

    const calorieEstimationResult =
      await geminiCalorieCounter.estimateCaloriesFromFoodItems({
        foodItems,
      });

    return {
      foodExtraction: foodExtractionResult,
      calorieEstimation: calorieEstimationResult,
    };
  }

  /**
   * Analyze a food photo and return only food items + approximate quantities.
   *
   * @param {Object} params
   * @param {Buffer|Uint8Array|string} params.imageBuffer
   * @param {string} [params.mimeType="image/jpeg"]
   * @returns {Promise<Object>}
   */
  async extractFoodItemsFromPhoto({
    imageBuffer,
    mimeType = "image/jpeg",
  }) {
    const geminiCalorieCounter = getGeminiCalorieCounter();

    return geminiCalorieCounter.extractFoodItemsFromPhoto({
      imageBuffer,
      mimeType,
    });
  }

  /**
   * Estimate calories from previously extracted food items.
   *
   * @param {Object} params
   * @param {Array<Object>} params.foodItems
   * @returns {Promise<Object>}
   */
  async estimateCaloriesFromFoodItems({
    foodItems,
  }) {
    const geminiCalorieCounter = getGeminiCalorieCounter();

    return geminiCalorieCounter.estimateCaloriesFromFoodItems({
      foodItems,
    });
  }
}

module.exports = new FoodProcessingHandler();
module.exports.FoodProcessingHandler = FoodProcessingHandler;