// functions/config/firebase/food_data_schema.js

const FOOD_ANALYSIS_COLLECTION = "foodAnalyses";

const FOOD_ANALYSIS_FIELDS = {
  ITEMS: "items",
  ASSUMPTIONS: "assumptions",
  NOTES: "notes",
  TOTAL_ESTIMATED_CALORIES: "totalEstimatedCalories",
  CALORIE_RANGE: "calorieRange",
};

const FOOD_ITEM_FIELDS = {
  NAME: "name",
  QUANTITY_TEXT: "quantityText",
  ESTIMATED_GRAMS: "estimatedGrams",
  CONFIDENCE: "confidence",
  ESTIMATED_CALORIES: "estimatedCalories",
};

const CALORIE_RANGE_FIELDS = {
  LOW: "low",
  MID: "mid",
  HIGH: "high",
};

const FOOD_LOG_FIELDS = {
  LOG_DATE: "logDate",
  LOG_TIME: "logTime",
  FOOD_DESCRIPTION: "foodDescription",
  CALORIE_CALCULATED: "calorieCalculated",
  PROCESSING_STATUS: "processingStatus",
  PROCESSING_ERROR_CODE: "processingErrorCode",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
};

const FOOD_LOG_PROCESSING_STATUS = {
  SUCCESS: "success",
  FAILED: "failed",
};

const FOOD_LOG_PROCESSING_ERROR_CODES = {
  PHOTO_IS_NOT_FOOD: "PHOTO_IS_NOT_FOOD",
};

const FOOD_LOG_CONFIG = {
  DEFAULT_TIMEZONE: "Asia/Kuala_Lumpur",
  DATE_FORMAT_OPTIONS: {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
  TIME_FORMAT_OPTIONS: {
    timeZone: "Asia/Kuala_Lumpur",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  },
};

const FOOD_ANALYSIS_JSON_SCHEMA = {
  FOOD_ITEMS_EXTRACTION: {
    type: "object",
    properties: {
      [FOOD_ANALYSIS_FIELDS.ITEMS]: {
        type: "array",
        items: {
          type: "object",
          properties: {
            [FOOD_ITEM_FIELDS.NAME]: {type: "string"},
            [FOOD_ITEM_FIELDS.QUANTITY_TEXT]: {type: "string"},
            [FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]: {type: "number"},
            [FOOD_ITEM_FIELDS.CONFIDENCE]: {type: "number"},
          },
          required: [
            FOOD_ITEM_FIELDS.NAME,
            FOOD_ITEM_FIELDS.QUANTITY_TEXT,
            FOOD_ITEM_FIELDS.ESTIMATED_GRAMS,
            FOOD_ITEM_FIELDS.CONFIDENCE,
          ],
        },
      },
      [FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]: {
        type: "array",
        items: {type: "string"},
      },
      [FOOD_ANALYSIS_FIELDS.NOTES]: {
        type: "array",
        items: {type: "string"},
      },
    },
    required: [
      FOOD_ANALYSIS_FIELDS.ITEMS,
      FOOD_ANALYSIS_FIELDS.ASSUMPTIONS,
      FOOD_ANALYSIS_FIELDS.NOTES,
    ],
  },

  CALORIE_ESTIMATION: {
    type: "object",
    properties: {
      [FOOD_ANALYSIS_FIELDS.ITEMS]: {
        type: "array",
        items: {
          type: "object",
          properties: {
            [FOOD_ITEM_FIELDS.NAME]: {type: "string"},
            [FOOD_ITEM_FIELDS.QUANTITY_TEXT]: {type: "string"},
            [FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]: {type: "number"},
            [FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]: {type: "number"},
            [FOOD_ITEM_FIELDS.CONFIDENCE]: {type: "number"},
          },
          required: [
            FOOD_ITEM_FIELDS.NAME,
            FOOD_ITEM_FIELDS.QUANTITY_TEXT,
            FOOD_ITEM_FIELDS.ESTIMATED_GRAMS,
            FOOD_ITEM_FIELDS.ESTIMATED_CALORIES,
            FOOD_ITEM_FIELDS.CONFIDENCE,
          ],
        },
      },
      [FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES]: {
        type: "number",
      },
      [FOOD_ANALYSIS_FIELDS.CALORIE_RANGE]: {
        type: "object",
        properties: {
          [CALORIE_RANGE_FIELDS.LOW]: {type: "number"},
          [CALORIE_RANGE_FIELDS.MID]: {type: "number"},
          [CALORIE_RANGE_FIELDS.HIGH]: {type: "number"},
        },
        required: [
          CALORIE_RANGE_FIELDS.LOW,
          CALORIE_RANGE_FIELDS.MID,
          CALORIE_RANGE_FIELDS.HIGH,
        ],
      },
      [FOOD_ANALYSIS_FIELDS.ASSUMPTIONS]: {
        type: "array",
        items: {type: "string"},
      },
      [FOOD_ANALYSIS_FIELDS.NOTES]: {
        type: "array",
        items: {type: "string"},
      },
    },
    required: [
      FOOD_ANALYSIS_FIELDS.ITEMS,
      FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES,
      FOOD_ANALYSIS_FIELDS.CALORIE_RANGE,
      FOOD_ANALYSIS_FIELDS.ASSUMPTIONS,
      FOOD_ANALYSIS_FIELDS.NOTES,
    ],
  },
};

module.exports = {
  FOOD_ANALYSIS_COLLECTION,
  FOOD_ANALYSIS_FIELDS,
  FOOD_ITEM_FIELDS,
  CALORIE_RANGE_FIELDS,
  FOOD_LOG_FIELDS,
  FOOD_LOG_PROCESSING_STATUS,
  FOOD_LOG_PROCESSING_ERROR_CODES,
  FOOD_LOG_CONFIG,
  FOOD_ANALYSIS_JSON_SCHEMA,
};