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
  CALORIE_RANGE_FIELDS,
} = require("../config/firebase/food_data_schema");

const MAX_WHATSAPP_REPLY_LENGTH = 1500;

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
      replyMessage:
        "Please send a food photo so I can estimate the food items and calories.",
    };
  }

  if (!mediaUrl || typeof mediaUrl !== "string") {
    return {
      isValid: false,
      status: "missing_media_url",
      replyMessage:
        "I could not read the photo attachment. Please try sending the photo again.",
    };
  }

  if (!mediaContentType || typeof mediaContentType !== "string") {
    return {
      isValid: false,
      status: "missing_media_content_type",
      replyMessage:
        "I could not determine the photo type. Please send the image again.",
    };
  }

  if (!mediaContentType.startsWith("image/")) {
    return {
      isValid: false,
      status: "unsupported_media_type",
      replyMessage:
        "Please send an image of your food. Non-image attachments are not supported.",
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

function buildFoodPhotoReplyMessage({
  foodDescription,
  calorieCalculated,
}) {
  const foodItems = Array.isArray(foodDescription?.[FOOD_ANALYSIS_FIELDS.ITEMS])
    ? foodDescription[FOOD_ANALYSIS_FIELDS.ITEMS]
    : [];

  const calorieItems = Array.isArray(
    calorieCalculated?.[FOOD_ANALYSIS_FIELDS.ITEMS]
  )
    ? calorieCalculated[FOOD_ANALYSIS_FIELDS.ITEMS]
    : [];

  const totalCalories =
    calorieCalculated?.[FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES];

  const calorieRange =
    calorieCalculated?.[FOOD_ANALYSIS_FIELDS.CALORIE_RANGE] || {};

  const lines = [];
  lines.push("Food detected:");

  if (foodItems.length === 0) {
    lines.push("- I could not confidently identify the food items.");
  } else {
    foodItems.forEach((item, index) => {
      const foodName = safeString(item?.[FOOD_ITEM_FIELDS.NAME], "Unknown item");
      const quantityText = safeString(
        item?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT],
        "quantity unclear"
      );
      const estimatedGrams = item?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS];

      const gramsText = Number.isFinite(Number(estimatedGrams))
        ? ` (~${Number(estimatedGrams)}g)`
        : "";

      lines.push(`${index + 1}. ${foodName} - ${quantityText}${gramsText}`);
    });
  }

  if (calorieItems.length > 0) {
    lines.push("");
    lines.push("Estimated calories:");
    calorieItems.forEach((item, index) => {
      const foodName = safeString(item?.[FOOD_ITEM_FIELDS.NAME], "Unknown item");
      const estimatedCalories = item?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES];
      const calorieText = Number.isFinite(Number(estimatedCalories))
        ? `${Math.round(Number(estimatedCalories))} kcal`
        : "calories unclear";

      lines.push(`${index + 1}. ${foodName} - ${calorieText}`);
    });
  }

  if (Number.isFinite(Number(totalCalories))) {
    lines.push("");
    lines.push(`Total estimated calories: ${Math.round(Number(totalCalories))} kcal`);
  }

  const low = calorieRange?.[CALORIE_RANGE_FIELDS.LOW];
  const mid = calorieRange?.[CALORIE_RANGE_FIELDS.MID];
  const high = calorieRange?.[CALORIE_RANGE_FIELDS.HIGH];

  if (
    Number.isFinite(Number(low)) &&
    Number.isFinite(Number(mid)) &&
    Number.isFinite(Number(high))
  ) {
    lines.push(
      `Range: ${Math.round(Number(low))}-${Math.round(Number(high))} kcal (mid ${Math.round(Number(mid))})`
    );
  }

  lines.push("");
  lines.push("These are image-based estimates and may not be exact.");

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
  buildFoodPhotoReplyMessage,
  truncateWhatsAppMessage,
};