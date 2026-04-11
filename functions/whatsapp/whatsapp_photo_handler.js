// functions/whatsapp/whatsapp_photo_handler.js

const {
  getUserByPhone,
  buildUserRegistrationStatusReply,
  normalizeWhatsAppNumber,
  storeUserFoodAnalysis,
} = require("../handlers/user_handler");
const foodProcessingHandler = require("../handlers/food_processing_handler");
const {
  sendWhatsAppMessage,
} = require("../utils/twilio/twilio_send_whatsapp");
const {
  FOOD_ANALYSIS_FIELDS,
  FOOD_ITEM_FIELDS,
} = require("../config/firebase/food_data_schema");
const {
  FOOD_PROCESSING_MESSAGES,
  buildSimpleFoodLine,
  buildTotalLine,
} = require("../config/usability/food_processing");

const MAX_WHATSAPP_REPLY_LENGTH = 1500;

/**
 * Process a WhatsApp food photo:
 * 1) validate sender
 * 2) validate media
 * 3) download image from Twilio media URL
 * 4) run Gemini food extraction + calorie estimation
 * 5) store result under the user record
 * 6) send WhatsApp reply back to the sender
 *
 * @param {Object} params
 * @param {string} params.from Twilio From value, e.g. "whatsapp:+60123456789"
 * @param {string|number} [params.numMedia=0] Twilio NumMedia value
 * @param {string} [params.mediaUrl] Twilio MediaUrl0 value
 * @param {string} [params.mediaContentType] Twilio MediaContentType0 value
 * @param {string} params.twilioAccountSid
 * @param {string} params.twilioAuthToken
 * @param {string} params.twilioMessagingServiceSid
 * @returns {Promise<Object>}
 */
async function processWhatsAppFoodPhoto({
  from,
  numMedia = 0,
  mediaUrl,
  mediaContentType,
  twilioAccountSid,
  twilioAuthToken,
  twilioMessagingServiceSid,
}) {
  const normalizedPhoneNumber = normalizeWhatsAppNumber(from);

  if (!normalizedPhoneNumber) {
    throw new Error("Missing sender phone number.");
  }

  const user = await getUserByPhone(normalizedPhoneNumber);

  if (!user) {
    const registrationReply = await buildUserRegistrationStatusReply(
      normalizedPhoneNumber
    );

    await sendWhatsAppMessage({
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      messagingServiceSid: twilioMessagingServiceSid,
      to: normalizedPhoneNumber,
      body: registrationReply,
    });

    return {
      success: false,
      status: "user_not_registered",
      to: normalizedPhoneNumber,
      message: registrationReply,
    };
  }

  const validatedMedia = validateIncomingPhotoMedia({
    numMedia,
    mediaUrl,
    mediaContentType,
  });

  if (!validatedMedia.isValid) {
    await sendWhatsAppMessage({
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      messagingServiceSid: twilioMessagingServiceSid,
      to: normalizedPhoneNumber,
      body: validatedMedia.replyMessage,
    });

    return {
      success: false,
      status: validatedMedia.status,
      to: normalizedPhoneNumber,
      message: validatedMedia.replyMessage,
    };
  }

  const imageBuffer = await downloadTwilioMedia({
    mediaUrl: validatedMedia.mediaUrl,
    twilioAccountSid,
    twilioAuthToken,
  });

  const processingResult = await foodProcessingHandler.processFoodPhoto({
    imageBuffer,
    mimeType: validatedMedia.mediaContentType,
  });

  if (!processingResult?.success) {
    const failureReplyMessage = buildProcessingFailureReplyMessage({
      processingResult,
    });

    await sendWhatsAppMessage({
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      messagingServiceSid: twilioMessagingServiceSid,
      to: normalizedPhoneNumber,
      body: failureReplyMessage,
    });

    return {
      success: false,
      status:
        processingResult?.errorCode === "PHOTO_IS_NOT_FOOD" ?
          "photo_is_not_food" :
          "processing_failed",
      to: normalizedPhoneNumber,
      message: failureReplyMessage,
    };
  }

  const foodDescription = processingResult.foodExtraction;
  const calorieCalculated = processingResult.calorieEstimation;

  const storageResult = await storeUserFoodAnalysis({
    userDocumentId: user.id,
    foodDescription,
    calorieCalculated,
  });

  const replyMessage = buildFoodPhotoReplyMessage({
    foodDescription,
    calorieCalculated,
  });

  await sendWhatsAppMessage({
    accountSid: twilioAccountSid,
    authToken: twilioAuthToken,
    messagingServiceSid: twilioMessagingServiceSid,
    to: normalizedPhoneNumber,
    body: replyMessage,
  });

  return {
    success: true,
    status: "processed",
    to: normalizedPhoneNumber,
    userDocumentId: user.id,
    foodLogDocumentId: storageResult.foodLogDocumentId,
    foodDescription,
    calorieCalculated,
    replyMessage,
  };
}

function validateIncomingPhotoMedia({
  numMedia = 0,
  mediaUrl,
  mediaContentType,
}) {
  const mediaCount = Number(numMedia || 0);

  if (!Number.isFinite(mediaCount) || mediaCount < 1) {
    return {
      isValid: false,
      status: "missing_media",
      replyMessage: FOOD_PROCESSING_MESSAGES.MISSING_MEDIA,
    };
  }

  if (!mediaUrl || typeof mediaUrl !== "string") {
    return {
      isValid: false,
      status: "missing_media_url",
      replyMessage: FOOD_PROCESSING_MESSAGES.MISSING_MEDIA_URL,
    };
  }

  if (!mediaContentType || typeof mediaContentType !== "string") {
    return {
      isValid: false,
      status: "missing_media_content_type",
      replyMessage: FOOD_PROCESSING_MESSAGES.MISSING_MEDIA_CONTENT_TYPE,
    };
  }

  if (!mediaContentType.startsWith("image/")) {
    return {
      isValid: false,
      status: "unsupported_media_type",
      replyMessage: FOOD_PROCESSING_MESSAGES.UNSUPPORTED_MEDIA_TYPE,
    };
  }

  return {
    isValid: true,
    status: "ok",
    mediaUrl,
    mediaContentType,
  };
}

async function downloadTwilioMedia({
  mediaUrl,
  twilioAccountSid,
  twilioAuthToken,
}) {
  if (!mediaUrl || typeof mediaUrl !== "string") {
    throw new Error("mediaUrl is required.");
  }

  if (!twilioAccountSid || typeof twilioAccountSid !== "string") {
    throw new Error("twilioAccountSid is required.");
  }

  if (!twilioAuthToken || typeof twilioAuthToken !== "string") {
    throw new Error("twilioAuthToken is required.");
  }

  const basicAuth = Buffer.from(
    `${twilioAccountSid}:${twilioAuthToken}`
  ).toString("base64");

  const response = await fetch(mediaUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download Twilio media. Status: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function buildProcessingFailureReplyMessage({
  processingResult,
}) {
  if (processingResult?.errorCode === "PHOTO_IS_NOT_FOOD") {
    return FOOD_PROCESSING_MESSAGES.PHOTO_NOT_FOOD;
  }

  return FOOD_PROCESSING_MESSAGES.PROCESSING_FAILED;
}

function buildFoodPhotoReplyMessage({
  foodDescription,
  calorieCalculated,
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
      foodItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS] ||
      calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS];

    const calories = calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES];

    lines.push(
      buildSimpleFoodLine({
        foodName,
        quantityText,
        grams,
        calories,
      })
    );
  }

  if (Number.isFinite(Number(totalCalories))) {
    lines.push("");
    lines.push(buildTotalLine(totalCalories));
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
  processWhatsAppFoodPhoto,
  validateIncomingPhotoMedia,
  downloadTwilioMedia,
  buildProcessingFailureReplyMessage,
  buildFoodPhotoReplyMessage,
  truncateWhatsAppMessage,
};