// functions/handlers/food_processing_handler.js

const {
  getGeminiCalorieCounter,
} = require("../utils/llm/gemini/gemini_calorie_counter");
const firebaseOps = require("../utils/firebase/firebase_ops");
const {
  USER_COLLECTION,
  USER_FIELDS,
  USER_SUBCOLLECTIONS,
} = require("../config/firebase/firebase_user_schema");
const {
  FOOD_ANALYSIS_FIELDS,
  FOOD_ITEM_FIELDS,
  FOOD_LOG_FIELDS,
  FOOD_DAILY_SUMMARY_FIELDS,
  FOOD_PHOTO_PROCESSING_RESULT_FIELDS,
  FOOD_LOG_SUBCOLLECTIONS,
  FOOD_LOG_PROCESSING_STATUS,
  FOOD_LOG_PROCESSING_ERROR_CODES,
} = require("../config/firebase/food_data_schema");
const {
  buildFoodLogDateTimeStrings,
} = require("./user_handler");
const {
  FOOD_PROCESSING_MESSAGES,
} = require("../config/usability/food_processing");

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
   * If no food items can be extracted, return a non-food result.
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

    const foodItems = Array.isArray(
      foodExtractionResult?.[FOOD_ANALYSIS_FIELDS.ITEMS]
    )
      ? foodExtractionResult[FOOD_ANALYSIS_FIELDS.ITEMS]
      : [];

    if (foodItems.length === 0) {
      return {
        [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.SUCCESS]: false,
        [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.ERROR_CODE]:
          FOOD_LOG_PROCESSING_ERROR_CODES.PHOTO_IS_NOT_FOOD,
        [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.FOOD_EXTRACTION]:
          foodExtractionResult,
        [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.CALORIE_ESTIMATION]: null,
      };
    }

    const calorieEstimationResult =
      await geminiCalorieCounter.estimateCaloriesFromFoodItems({
        foodItems,
      });

    return {
      [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.SUCCESS]: true,
      [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.ERROR_CODE]: null,
      [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.FOOD_EXTRACTION]:
        foodExtractionResult,
      [FOOD_PHOTO_PROCESSING_RESULT_FIELDS.CALORIE_ESTIMATION]:
        calorieEstimationResult,
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

  /**
   * Return total calories consumed by a user for one food log day.
   *
   * If logDate is omitted, "today" is resolved using the user's stored GMT
   * offset, matching how food photo uploads are grouped in Firestore.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {string} [params.logDate] YYYY-MM-DD
   * @param {Date} [params.now]
   * @returns {Promise<Object>}
   */
  async getUserTotalCaloriesConsumedForDay({
    userDocumentId,
    logDate = null,
    now = new Date(),
  }) {
    validateDailyCaloriesInput({
      userDocumentId,
      logDate,
    });

    const user = await firebaseOps.readDocument(USER_COLLECTION, userDocumentId);

    if (!user) {
      throw new Error(`User not found for document ID: ${userDocumentId}`);
    }

    const foodLogDate = logDate || buildFoodLogDateTimeStrings({
      gmt: user[USER_FIELDS.GMT],
      now,
    }).logDate;

    const db = firebaseOps.getFirestore();
    const entriesSnapshot = await db
      .collection(USER_COLLECTION)
      .doc(userDocumentId)
      .collection(USER_SUBCOLLECTIONS.FOOD_LOGS)
      .doc(foodLogDate)
      .collection(FOOD_LOG_SUBCOLLECTIONS.ENTRIES)
      .get();

    let totalCaloriesConsumed = 0;
    let countedFoodPhotoCount = 0;

    entriesSnapshot.forEach((entrySnapshot) => {
      const foodLogData = entrySnapshot.data() || {};

      if (
        foodLogData[FOOD_LOG_FIELDS.PROCESSING_STATUS] !==
        FOOD_LOG_PROCESSING_STATUS.SUCCESS
      ) {
        return;
      }

      const entryCalories = getCaloriesFromFoodLogData(foodLogData);

      if (!Number.isFinite(entryCalories)) {
        return;
      }

      totalCaloriesConsumed += entryCalories;
      countedFoodPhotoCount++;
    });

    return {
      [FOOD_DAILY_SUMMARY_FIELDS.USER_DOCUMENT_ID]: userDocumentId,
      [FOOD_DAILY_SUMMARY_FIELDS.FOOD_LOG_DATE]: foodLogDate,
      [FOOD_DAILY_SUMMARY_FIELDS.TOTAL_CALORIES_CONSUMED]:
        totalCaloriesConsumed,
      [FOOD_DAILY_SUMMARY_FIELDS.FOOD_PHOTO_COUNT]: entriesSnapshot.size,
      [FOOD_DAILY_SUMMARY_FIELDS.COUNTED_FOOD_PHOTO_COUNT]:
        countedFoodPhotoCount,
      [FOOD_DAILY_SUMMARY_FIELDS.SKIPPED_FOOD_PHOTO_COUNT]:
        entriesSnapshot.size - countedFoodPhotoCount,
    };
  }

  /**
   * Build one food item line using usability message templates.
   *
   * @param {Object} params
   * @param {string} params.foodName
   * @param {string} params.quantityText
   * @param {number|string|null} [params.grams]
   * @param {number|string|null} [params.calories]
   * @returns {string}
   */
  buildSimpleFoodLine({
    foodName,
    quantityText,
    grams,
    calories,
  }) {
    const gramsNumber = toFiniteNumber(grams);
    const gramsText = gramsNumber !== null ?
      ` (~${gramsNumber}g)` :
      "";

    const calorieNumber = toFiniteNumber(calories);
    const calorieText = calorieNumber !== null ?
      `${Math.round(calorieNumber)} kcal` :
      FOOD_PROCESSING_MESSAGES.CALORIES_UNCLEAR;

    return `${foodName} - ${quantityText}${gramsText} - ${calorieText}`;
  }

  /**
   * Build the total calorie line for a single food photo.
   *
   * @param {number|string} totalCalories
   * @returns {string}
   */
  buildTotalLine(totalCalories) {
    return `${FOOD_PROCESSING_MESSAGES.TOTAL_PREFIX} ${Math.round(
      Number(totalCalories)
    )} kcal`;
  }

  /**
   * Build the daily calorie progress line against the user's daily target.
   *
   * @param {Object} params
   * @param {number|string} params.totalCaloriesConsumed
   * @param {number|string|null} params.totalCaloriesRequiredPerDay
   * @returns {string}
   */
  buildDailyCaloriesProgressLine({
    totalCaloriesConsumed,
    totalCaloriesRequiredPerDay,
  }) {
    const consumedCalories = toRoundedFiniteNumber(totalCaloriesConsumed);

    if (consumedCalories === null) {
      return "";
    }

    const requiredCalories = toRoundedFiniteNumber(totalCaloriesRequiredPerDay);

    if (requiredCalories === null) {
      return buildMessageFromTemplate(
        FOOD_PROCESSING_MESSAGES.DAILY_CALORIES_TARGET_UNAVAILABLE,
        {
          totalCaloriesConsumed: consumedCalories,
        }
      );
    }

    const calorieDifference = requiredCalories - consumedCalories;

    if (calorieDifference >= 0) {
      return buildMessageFromTemplate(
        FOOD_PROCESSING_MESSAGES.DAILY_CALORIES_PROGRESS,
        {
          totalCaloriesConsumed: consumedCalories,
          totalCaloriesRequiredPerDay: requiredCalories,
          remainingCalories: calorieDifference,
        }
      );
    }

    return buildMessageFromTemplate(
      FOOD_PROCESSING_MESSAGES.DAILY_CALORIES_EXCEEDED,
      {
        totalCaloriesConsumed: consumedCalories,
        totalCaloriesRequiredPerDay: requiredCalories,
        exceededCalories: Math.abs(calorieDifference),
      }
    );
  }
}

function getCaloriesFromFoodLogData(foodLogData) {
  const calorieCalculated = foodLogData?.[FOOD_LOG_FIELDS.CALORIE_CALCULATED];
  const calorieCalculatedNumber = toFiniteNumber(calorieCalculated);

  if (calorieCalculatedNumber !== null) {
    return calorieCalculatedNumber;
  }

  if (!calorieCalculated || typeof calorieCalculated !== "object") {
    return null;
  }

  const totalCalories =
    calorieCalculated[FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES];
  const totalCaloriesNumber = toFiniteNumber(totalCalories);

  if (totalCaloriesNumber !== null) {
    return totalCaloriesNumber;
  }

  const calorieItems = Array.isArray(
    calorieCalculated[FOOD_ANALYSIS_FIELDS.ITEMS]
  ) ?
    calorieCalculated[FOOD_ANALYSIS_FIELDS.ITEMS] :
    [];

  if (calorieItems.length === 0) {
    return null;
  }

  let hasItemCalories = false;
  const itemCalories = calorieItems.reduce((sum, calorieItem) => {
    const calories = toFiniteNumber(
      calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]
    );

    if (calories === null) {
      return sum;
    }

    hasItemCalories = true;
    return sum + calories;
  }, 0);

  return hasItemCalories ? itemCalories : null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function toRoundedFiniteNumber(value) {
  const numberValue = toFiniteNumber(value);

  return numberValue === null ? null : Math.round(numberValue);
}

function buildMessageFromTemplate(template, values) {
  return Object.entries(values).reduce((message, [key, value]) => {
    return message.replaceAll(`{${key}}`, String(value));
  }, template);
}

function validateDailyCaloriesInput({
  userDocumentId,
  logDate,
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }

  if (logDate !== null && logDate !== undefined) {
    if (typeof logDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      throw new Error("logDate must use YYYY-MM-DD format.");
    }
  }
}

module.exports = new FoodProcessingHandler();
module.exports.FoodProcessingHandler = FoodProcessingHandler;
