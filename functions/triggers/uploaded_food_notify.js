// functions/triggers/uploaded_food_notify.js

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");

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
  FOOD_LOG_SUBCOLLECTIONS,
  FOOD_LOG_PROCESSING_STATUS,
  FOOD_LOG_PROCESSING_ERROR_CODES,
} = require("../config/firebase/food_data_schema");
const {
  FOOD_PROCESSING_MESSAGES,
} = require("../config/usability/food_processing");
const firebaseOps = require("../utils/firebase/firebase_ops");
const foodProcessingHandler = require("../handlers/food_processing_handler");
const {
  sendWhatsAppMessage,
} = require("../utils/twilio/twilio_send_whatsapp");

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = defineSecret("TWILIO_MESSAGING_SERVICE_SID");

const MAX_WHATSAPP_REPLY_LENGTH = 1500;

const uploadedFoodNotify = onDocumentCreated(
  {
    document:
      `${USER_COLLECTION}/{userDocumentId}/` +
      `${USER_SUBCOLLECTIONS.FOOD_LOGS}/{logDate}/` +
      `${FOOD_LOG_SUBCOLLECTIONS.ENTRIES}/{foodLogEntryDocumentId}`,
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_SERVICE_SID,
    ],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const foodLogData = snapshot.data() || {};
    const userDocumentId = event.params?.userDocumentId;

    if (!userDocumentId) {
      console.error("[uploadedFoodNotify] Missing userDocumentId.");
      return;
    }

    const user = await firebaseOps.readDocument(USER_COLLECTION, userDocumentId);

    if (!user) {
      console.error(`[uploadedFoodNotify] User not found: ${userDocumentId}`);
      return;
    }

    const phoneNumber = user[USER_FIELDS.PHONE_NUMBER];

    if (!phoneNumber) {
      console.error(`[uploadedFoodNotify] User phoneNumber missing: ${userDocumentId}`);
      return;
    }

    const dailyCaloriesProgressLine = await buildDailyCaloriesProgressLineForLog({
      foodLogData,
      user,
      userDocumentId,
      logDate: event.params?.logDate,
    });

    const message = buildUploadedFoodReplyMessage({
      foodLogData,
      dailyCaloriesProgressLine,
    });

    await sendWhatsAppMessage({
      accountSid: TWILIO_ACCOUNT_SID.value(),
      authToken: TWILIO_AUTH_TOKEN.value(),
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
      to: phoneNumber,
      body: message,
    });
  }
);

async function buildDailyCaloriesProgressLineForLog({
  foodLogData,
  user,
  userDocumentId,
  logDate,
}) {
  const processingStatus = foodLogData?.[FOOD_LOG_FIELDS.PROCESSING_STATUS];

  if (processingStatus !== FOOD_LOG_PROCESSING_STATUS.SUCCESS) {
    return "";
  }

  try {
    const dailyCaloriesResult =
      await foodProcessingHandler.getUserTotalCaloriesConsumedForDay({
        userDocumentId,
        logDate,
      });

    return foodProcessingHandler.buildDailyCaloriesProgressLine({
      totalCaloriesConsumed:
        dailyCaloriesResult[
          FOOD_DAILY_SUMMARY_FIELDS.TOTAL_CALORIES_CONSUMED
        ],
      totalCaloriesRequiredPerDay:
        user?.[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY],
    });
  } catch (error) {
    console.error("[uploadedFoodNotify] Daily calories lookup failed:", error);
    return FOOD_PROCESSING_MESSAGES.DAILY_CALORIES_SUMMARY_UNAVAILABLE;
  }
}

function buildUploadedFoodReplyMessage({
  foodLogData,
  dailyCaloriesProgressLine = "",
}) {
  const processingStatus = foodLogData?.[FOOD_LOG_FIELDS.PROCESSING_STATUS];
  const processingErrorCode = foodLogData?.[FOOD_LOG_FIELDS.PROCESSING_ERROR_CODE];

  if (processingStatus === FOOD_LOG_PROCESSING_STATUS.FAILED) {
    if (
      processingErrorCode ===
      FOOD_LOG_PROCESSING_ERROR_CODES.PHOTO_IS_NOT_FOOD
    ) {
      return FOOD_PROCESSING_MESSAGES.PHOTO_NOT_FOOD;
    }

    return FOOD_PROCESSING_MESSAGES.PROCESSING_FAILED;
  }

  const foodDescription = foodLogData?.[FOOD_LOG_FIELDS.FOOD_DESCRIPTION] || {};
  const calorieCalculated = foodLogData?.[FOOD_LOG_FIELDS.CALORIE_CALCULATED] || {};

  return buildFoodPhotoReplyMessage({
    foodDescription,
    calorieCalculated,
    dailyCaloriesProgressLine,
  });
}

function buildFoodPhotoReplyMessage({
  foodDescription,
  calorieCalculated,
  dailyCaloriesProgressLine = "",
}) {
  const foodItems = Array.isArray(foodDescription?.[FOOD_ANALYSIS_FIELDS.ITEMS]) ?
    foodDescription[FOOD_ANALYSIS_FIELDS.ITEMS] :
    [];

  const calorieItems = Array.isArray(
    calorieCalculated?.[FOOD_ANALYSIS_FIELDS.ITEMS]
  ) ?
    calorieCalculated[FOOD_ANALYSIS_FIELDS.ITEMS] :
    [];

  const totalCalories =
    calorieCalculated?.[FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES];

  const lines = [];
  const maxLength = Math.max(foodItems.length, calorieItems.length);

  for (let i = 0; i < maxLength; i++) {
    const foodItem = foodItems[i] || {};
    const calorieItem = calorieItems[i] || {};

    const foodName = safeString(
      foodItem?.[FOOD_ITEM_FIELDS.NAME] ||
        calorieItem?.[FOOD_ITEM_FIELDS.NAME],
      FOOD_PROCESSING_MESSAGES.UNKNOWN_ITEM
    );

    const quantityText = safeString(
      foodItem?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT] ||
        calorieItem?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT],
      FOOD_PROCESSING_MESSAGES.QUANTITY_UNCLEAR
    );

    const grams =
      foodItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS] ??
      calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS];

    const calories = calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES];

    lines.push(
      foodProcessingHandler.buildSimpleFoodLine({
        foodName,
        quantityText,
        grams,
        calories,
      })
    );
  }

  if (Number.isFinite(Number(totalCalories))) {
    lines.push("");
    lines.push(foodProcessingHandler.buildTotalLine(totalCalories));
  }

  const normalizedDailyCaloriesProgressLine = safeString(
    dailyCaloriesProgressLine
  );

  if (normalizedDailyCaloriesProgressLine) {
    lines.push("");
    lines.push(normalizedDailyCaloriesProgressLine);
  }

  return truncateWhatsAppMessage(lines.join("\n"));
}

function truncateWhatsAppMessage(message) {
  if (!message || typeof message !== "string") {
    return "";
  }

  if (message.length <= MAX_WHATSAPP_REPLY_LENGTH) {
    return message;
  }

  return `${message.slice(0, MAX_WHATSAPP_REPLY_LENGTH - 3)}...`;
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || fallback;
}

module.exports = {
  uploadedFoodNotify,
  buildDailyCaloriesProgressLineForLog,
  buildUploadedFoodReplyMessage,
  buildFoodPhotoReplyMessage,
};
