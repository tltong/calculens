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
  FOOD_LOG_PROCESSING_STATUS,
  FOOD_PHOTO_PROCESSING_RESULT_FIELDS,
} = require("../config/firebase/food_data_schema");
const {
  FOOD_PROCESSING_MESSAGES,
} = require("../config/usability/food_processing");

/**
 * Process a WhatsApp food photo:
 * 1) validate sender
 * 2) validate media
 * 3) download image from Twilio media URL
 * 4) run Gemini food extraction + calorie estimation
 * 5) store result under the user record
 * 6) do not send success / non-food reply here
 *    the Firestore trigger will notify asynchronously
 *
 * @param {Object} params
 * @param {string} params.from
 * @param {string|number} [params.numMedia=0]
 * @param {string} [params.mediaUrl]
 * @param {string} [params.mediaContentType]
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

  if (!processingResult?.[FOOD_PHOTO_PROCESSING_RESULT_FIELDS.SUCCESS]) {
    const storageResult = await storeUserFoodAnalysis({
      userDocumentId: user.id,
      foodDescription:
        processingResult?.[
          FOOD_PHOTO_PROCESSING_RESULT_FIELDS.FOOD_EXTRACTION
        ] || null,
      calorieCalculated: null,
      processingStatus: FOOD_LOG_PROCESSING_STATUS.FAILED,
      processingErrorCode:
        processingResult?.[FOOD_PHOTO_PROCESSING_RESULT_FIELDS.ERROR_CODE] ||
        null,
    });

    return {
      success: false,
      status: "stored_failed_food_log",
      to: normalizedPhoneNumber,
      userDocumentId: user.id,
      foodLogDate: storageResult.foodLogDate,
      foodLogEntryDocumentId: storageResult.foodLogEntryDocumentId,
      foodLogDocumentId: storageResult.foodLogDocumentId,
    };
  }

  const foodDescription =
    processingResult[FOOD_PHOTO_PROCESSING_RESULT_FIELDS.FOOD_EXTRACTION];
  const calorieCalculated =
    processingResult[FOOD_PHOTO_PROCESSING_RESULT_FIELDS.CALORIE_ESTIMATION];

  const storageResult = await storeUserFoodAnalysis({
    userDocumentId: user.id,
    foodDescription,
    calorieCalculated,
    processingStatus: FOOD_LOG_PROCESSING_STATUS.SUCCESS,
    processingErrorCode: null,
  });

  return {
    success: true,
    status: "stored_food_log",
    to: normalizedPhoneNumber,
    userDocumentId: user.id,
    foodLogDate: storageResult.foodLogDate,
    foodLogEntryDocumentId: storageResult.foodLogEntryDocumentId,
    foodLogDocumentId: storageResult.foodLogDocumentId,
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

module.exports = {
  processWhatsAppFoodPhoto,
  validateIncomingPhotoMedia,
  downloadTwilioMedia,
};
