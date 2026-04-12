// functions/utils/llm/gemini/gemini_food_consumption_review.js

const {GoogleGenAI} = require("@google/genai");
const {
  USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS,
  USER_ANALYSIS_JSON_SCHEMA,
} = require("../../../config/firebase/user_analysis_schema");
const {
  USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS,
} = require("../../../config/analysis/user_analysis");

const DEFAULT_MODEL = "gemini-2.5-flash";

class GeminiFoodConsumptionReviewer {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    this.client = new GoogleGenAI({apiKey});
    this.model = DEFAULT_MODEL;
  }

  async reviewFoodConsumption({
    foodConsumptionEntries,
    dailyCalorieSummaries = [],
    dailyCaloriesRequired = null,
    dailyAverageCaloriesConsumed = null,
    dailyAverageCalorieDifference = null,
  }) {
    if (
      !Array.isArray(foodConsumptionEntries) ||
      foodConsumptionEntries.length === 0
    ) {
      throw new Error("foodConsumptionEntries must be a non-empty array.");
    }

    const reviewContext = {
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS
          .FOOD_CONSUMPTION_ENTRIES]: foodConsumptionEntries,
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS
          .DAILY_CALORIE_SUMMARIES]: dailyCalorieSummaries,
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS
          .DAILY_CALORIES_REQUIRED]: dailyCaloriesRequired,
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS
          .DAILY_AVERAGE_CALORIES_CONSUMED]:
        dailyAverageCaloriesConsumed,
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_CONTEXT_FIELDS
          .DAILY_AVERAGE_CALORIE_DIFFERENCE]:
        dailyAverageCalorieDifference,
    };

    const prompt = [
      "Review the user's recent food consumption logs.",
      "Assess eating habits using the meal times, food descriptions, quantities, and calorie context.",
      "Return strict JSON only.",
      "Rules:",
      "- No markdown",
      "- No explanation outside JSON",
      "- Do not diagnose medical conditions",
      "- Base the assessment only on the provided logs",
      "- Mention if the logs are sparse or incomplete",
      `- ${USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS.ASSESSMENT} should be concise and admin-readable`,
      `- ${USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS.SUGGESTED_IMPROVEMENTS} should contain practical, specific suggestions`,
      "",
      "Review context JSON:",
      JSON.stringify(reviewContext, null, 2),
    ].join("\n");

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema:
          USER_ANALYSIS_JSON_SCHEMA.FOOD_CONSUMPTION_REVIEW,
      },
    });

    return this._normalizeReviewResult(this._parseJson(response?.text));
  }

  _normalizeReviewResult(result) {
    const reviewFields = USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS;

    return {
      [reviewFields.ASSESSMENT]: this._asString(
          result?.[reviewFields.ASSESSMENT]
      ),
      [reviewFields.SUGGESTED_IMPROVEMENTS]: this._normalizeStringArray(
          result?.[reviewFields.SUGGESTED_IMPROVEMENTS]
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
}

let geminiFoodConsumptionReviewerInstance = null;

function getGeminiFoodConsumptionReviewer() {
  if (!geminiFoodConsumptionReviewerInstance) {
    geminiFoodConsumptionReviewerInstance =
      new GeminiFoodConsumptionReviewer();
  }

  return geminiFoodConsumptionReviewerInstance;
}

module.exports = {
  getGeminiFoodConsumptionReviewer,
  GeminiFoodConsumptionReviewer,
};
