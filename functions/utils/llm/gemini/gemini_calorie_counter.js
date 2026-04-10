// functions/utils/llm/gemini/gemini_calorie_counter.js

const {GoogleGenAI} = require("@google/genai");
const {
  FOOD_ANALYSIS_FIELDS,
  FOOD_ITEM_FIELDS,
  CALORIE_RANGE_FIELDS,
  FOOD_ANALYSIS_JSON_SCHEMA,
} = require("../../../config/firebase/food_data_schema");

const DEFAULT_MODEL = "gemini-2.5-flash";

class GeminiCalorieCounter {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    this.client = new GoogleGenAI({apiKey});
    this.model = DEFAULT_MODEL;
  }

  async extractFoodItemsFromPhoto({
    imageBuffer,
    mimeType = "image/jpeg",
  }) {
    this._validateImageInput(imageBuffer, mimeType);

    const prompt = [
      "You are analyzing a meal photo.",
      "Identify only visible food and drink items.",
      "Estimate realistic portion sizes.",
      "Return strict JSON only.",
      "Rules:",
      "- No markdown",
      "- No explanation outside JSON",
      `- ${FOOD_ITEM_FIELDS.ESTIMATED_GRAMS} must be numeric`,
      `- ${FOOD_ITEM_FIELDS.CONFIDENCE} must be between 0 and 1`,
      "- Do not invent hidden ingredients unless clearly visible",
    ].join("\n");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: this._toBase64(imageBuffer),
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: FOOD_ANALYSIS_JSON_SCHEMA.FOOD_ITEMS_EXTRACTION,
      },
    });

    return this._normalizeFoodItemsResult(this._parseJson(response?.text));
  }

  async estimateCaloriesFromFoodItems({foodItems}) {
    if (!Array.isArray(foodItems) || foodItems.length === 0) {
      throw new Error("foodItems must be a non-empty array.");
    }

    const prompt = [
      "Estimate calories for the provided food items.",
      "Return strict JSON only.",
      "Rules:",
      "- Use only the provided food items and quantities",
      `- ${FOOD_ITEM_FIELDS.ESTIMATED_CALORIES} must be numeric`,
      `- ${FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES} should approximately equal the sum of item calories`,
      `- ${FOOD_ANALYSIS_FIELDS.CALORIE_RANGE}.${CALORIE_RANGE_FIELDS.LOW} <= ${FOOD_ANALYSIS_FIELDS.CALORIE_RANGE}.${CALORIE_RANGE_FIELDS.MID} <= ${FOOD_ANALYSIS_FIELDS.CALORIE_RANGE}.${CALORIE_RANGE_FIELDS.HIGH}`,
      `- ${FOOD_ITEM_FIELDS.CONFIDENCE} must be between 0 and 1`,
      "",
      "Food items JSON:",
      JSON.stringify(foodItems, null, 2),
    ].join("\n");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: FOOD_ANALYSIS_JSON_SCHEMA.CALORIE_ESTIMATION,
      },
    });

    return this._normalizeCalorieEstimateResult(this._parseJson(response?.text));
  }

  _normalizeFoodItemsResult(result) {
    const rawItems = Array.isArray(result?.[FOOD_ANALYSIS_FIELDS.ITEMS]) ?
      result[FOOD_ANALYSIS_FIELDS.ITEMS] :
      [];

    return {
      [FOOD_ANALYSIS_FIELDS.ITEMS]: rawItems
          .map((item) => ({
            [FOOD_ITEM_FIELDS.NAME]: this._asString(item?.[FOOD_ITEM_FIELDS.NAME]),
            [FOOD_ITEM_FIELDS.QUANTITY_TEXT]: this._asString(
                item?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT]
            ),
            [FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]: this._asNumber(
                item?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]
            ),
            [FOOD_ITEM_FIELDS.CONFIDENCE]: this._clamp01(
                item?.[FOOD_ITEM_FIELDS.CONFIDENCE]
            ),
          }))
          .filter((item) => item[FOOD_ITEM_FIELDS.NAME]),
      [FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]: this._normalizeStringArray(
          result?.[FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]
      ),
      [FOOD_ANALYSIS_FIELDS.NOTES]: this._normalizeStringArray(
          result?.[FOOD_ANALYSIS_FIELDS.NOTES]
      ),
    };
  }

  _normalizeCalorieEstimateResult(result) {
    const rawItems = Array.isArray(result?.[FOOD_ANALYSIS_FIELDS.ITEMS]) ?
      result[FOOD_ANALYSIS_FIELDS.ITEMS] :
      [];

    return {
      [FOOD_ANALYSIS_FIELDS.ITEMS]: rawItems
          .map((item) => ({
            [FOOD_ITEM_FIELDS.NAME]: this._asString(item?.[FOOD_ITEM_FIELDS.NAME]),
            [FOOD_ITEM_FIELDS.QUANTITY_TEXT]: this._asString(
                item?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT]
            ),
            [FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]: this._asNumber(
                item?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]
            ),
            [FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]: this._asNumber(
                item?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]
            ),
            [FOOD_ITEM_FIELDS.CONFIDENCE]: this._clamp01(
                item?.[FOOD_ITEM_FIELDS.CONFIDENCE]
            ),
          }))
          .filter((item) => item[FOOD_ITEM_FIELDS.NAME]),
      [FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES]: this._asNumber(
          result?.[FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES]
      ),
      [FOOD_ANALYSIS_FIELDS.CALORIE_RANGE]: {
        [CALORIE_RANGE_FIELDS.LOW]: this._asNumber(
            result?.[FOOD_ANALYSIS_FIELDS.CALORIE_RANGE]?.[CALORIE_RANGE_FIELDS.LOW]
        ),
        [CALORIE_RANGE_FIELDS.MID]: this._asNumber(
            result?.[FOOD_ANALYSIS_FIELDS.CALORIE_RANGE]?.[CALORIE_RANGE_FIELDS.MID]
        ),
        [CALORIE_RANGE_FIELDS.HIGH]: this._asNumber(
            result?.[FOOD_ANALYSIS_FIELDS.CALORIE_RANGE]?.[CALORIE_RANGE_FIELDS.HIGH]
        ),
      },
      [FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]: this._normalizeStringArray(
          result?.[FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]
      ),
      [FOOD_ANALYSIS_FIELDS.NOTES]: this._normalizeStringArray(
          result?.[FOOD_ANALYSIS_FIELDS.NOTES]
      ),
    };
  }

  _parseJson(text) {
    if (!text || typeof text !== "string") {
      throw new Error("Empty response from Gemini.");
    }

    const cleaned = text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(`Failed to parse Gemini JSON response: ${error.message}`);
    }
  }

  _toBase64(buffer) {
    if (Buffer.isBuffer(buffer)) {
      return buffer.toString("base64");
    }

    if (buffer instanceof Uint8Array) {
      return Buffer.from(buffer).toString("base64");
    }

    return Buffer.from(buffer).toString("base64");
  }

  _validateImageInput(imageBuffer, mimeType) {
    if (!imageBuffer) {
      throw new Error("imageBuffer is required.");
    }

    if (!mimeType || typeof mimeType !== "string") {
      throw new Error("mimeType is required.");
    }
  }

  _normalizeStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
        .map((item) => this._asString(item))
        .filter(Boolean);
  }

  _asString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  _asNumber(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  _clamp01(value) {
    const numericValue = this._asNumber(value);

    if (numericValue < 0) {
      return 0;
    }

    if (numericValue > 1) {
      return 1;
    }

    return numericValue;
  }
}

let geminiCalorieCounterInstance = null;

function getGeminiCalorieCounter() {
  if (!geminiCalorieCounterInstance) {
    geminiCalorieCounterInstance = new GeminiCalorieCounter();
  }

  return geminiCalorieCounterInstance;
}

module.exports = {
  getGeminiCalorieCounter,
  GeminiCalorieCounter,
};