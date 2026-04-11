// functions/config/usability/food_processing.js

const FOOD_PROCESSING_MESSAGES = {
  PHOTO_NOT_FOOD:
    "Photo is not food. Please send a food photo.",

  MISSING_MEDIA:
    "Please send a food photo.",

  MISSING_MEDIA_URL:
    "Could not read the photo. Please try again.",

  MISSING_MEDIA_CONTENT_TYPE:
    "Could not determine photo type. Please resend.",

  UNSUPPORTED_MEDIA_TYPE:
    "Please send an image.",

  PROCESSING_FAILED:
    "Could not process photo. Try again.",

  UNKNOWN_ITEM:
    "Unknown item",

  QUANTITY_UNCLEAR:
    "unknown quantity",

  CALORIES_UNCLEAR:
    "unknown kcal",

  TOTAL_PREFIX:
    "Total:",

  DAILY_CALORIES_PROGRESS:
    "Today: {totalCaloriesConsumed} / {totalCaloriesRequiredPerDay} kcal ({remainingCalories} kcal remaining).",

  DAILY_CALORIES_EXCEEDED:
    "Today: {totalCaloriesConsumed} / {totalCaloriesRequiredPerDay} kcal ({exceededCalories} kcal over).",

  DAILY_CALORIES_TARGET_UNAVAILABLE:
    "Today: {totalCaloriesConsumed} kcal consumed. Daily calorie target unavailable.",

  DAILY_CALORIES_SUMMARY_UNAVAILABLE:
    "Daily calorie summary unavailable.",
};

module.exports = {
  FOOD_PROCESSING_MESSAGES,
};
