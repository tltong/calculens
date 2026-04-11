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
};

function buildSimpleFoodLine({
  foodName,
  quantityText,
  grams,
  calories,
}) {
  const gramsText = Number.isFinite(Number(grams)) ?
    ` (~${Number(grams)}g)` :
    "";

  const calorieText = Number.isFinite(Number(calories)) ?
    `${Math.round(Number(calories))} kcal` :
    FOOD_PROCESSING_MESSAGES.CALORIES_UNCLEAR;

  return `${foodName} - ${quantityText}${gramsText} - ${calorieText}`;
}

function buildTotalLine(totalCalories) {
  return `${FOOD_PROCESSING_MESSAGES.TOTAL_PREFIX} ${Math.round(
    Number(totalCalories)
  )} kcal`;
}

module.exports = {
  FOOD_PROCESSING_MESSAGES,
  buildSimpleFoodLine,
  buildTotalLine,
};