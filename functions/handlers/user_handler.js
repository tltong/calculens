// functions/handlers/user_handler.js

const firebaseOps = require("../utils/firebase/firebase_ops");
const {
  USER_COLLECTION,
  USER_FIELDS,
  USER_SUBCOLLECTIONS,
  buildUserRegistrationLink,
} = require("../config/firebase/firebase_user_schema");
const {
  FOOD_LOG_FIELDS,
  FOOD_LOG_CONFIG,
  FOOD_LOG_PROCESSING_STATUS,
} = require("../config/firebase/food_data_schema");
const {
  USER_REGISTRATION_MESSAGES,
  buildUserNotRegisteredMessage,
} = require("../config/usability/user_registration");

/**
 * Normalize WhatsApp number from Twilio format
 * Example: "whatsapp:+60123456789" -> "+60123456789"
 * @param {string} from
 * @returns {string}
 */
function normalizeWhatsAppNumber(from) {
  if (!from) {
    return "";
  }

  return String(from).replace("whatsapp:", "").trim();
}

/**
 * Check if user exists by phone number
 * @param {string} phoneNumber
 * @returns {Promise<boolean>}
 */
async function isUserRegisteredByPhone(phoneNumber) {
  const normalizedPhoneNumber = normalizeWhatsAppNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return false;
  }

  const users = await firebaseOps.queryDocuments(
    USER_COLLECTION,
    USER_FIELDS.PHONE_NUMBER,
    "==",
    normalizedPhoneNumber,
    {limit: 1}
  );

  return users.length > 0;
}

/**
 * Get user by phone number
 * @param {string} phoneNumber
 * @returns {Promise<Object|null>}
 */
async function getUserByPhone(phoneNumber) {
  const normalizedPhoneNumber = normalizeWhatsAppNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    return null;
  }

  const users = await firebaseOps.queryDocuments(
    USER_COLLECTION,
    USER_FIELDS.PHONE_NUMBER,
    "==",
    normalizedPhoneNumber,
    {limit: 1}
  );

  return users.length > 0 ? users[0] : null;
}

/**
 * Build WhatsApp reply for registration status
 * @param {string} phoneNumber
 * @returns {Promise<string>}
 */
async function buildUserRegistrationStatusReply(phoneNumber) {
  const normalizedPhoneNumber = normalizeWhatsAppNumber(phoneNumber);
  const isRegistered = await isUserRegisteredByPhone(normalizedPhoneNumber);

  if (isRegistered) {
    return USER_REGISTRATION_MESSAGES.USER_REGISTERED;
  }

  const registrationLink = buildUserRegistrationLink(normalizedPhoneNumber);

  return buildUserNotRegisteredMessage({
    registrationLink,
  });
}

/**
 * Store food analysis under a user subcollection.
 *
 * Subcollection path:
 * users/{userDocumentId}/foodLogs/{autoId}
 *
 * @param {Object} params
 * @param {string} params.userDocumentId
 * @param {Object|string|Array|null} [params.foodDescription]
 * @param {Object|number|string|null} [params.calorieCalculated]
 * @param {string} params.processingStatus
 * @param {string|null} [params.processingErrorCode]
 * @returns {Promise<Object>}
 */
async function storeUserFoodAnalysis({
  userDocumentId,
  foodDescription = null,
  calorieCalculated = null,
  processingStatus,
  processingErrorCode = null,
}) {
  _validateUserFoodAnalysisInput({
    userDocumentId,
    processingStatus,
  });

  const existingUser = await firebaseOps.readDocument(USER_COLLECTION, userDocumentId);

  if (!existingUser) {
    throw new Error(`User not found for document ID: ${userDocumentId}`);
  }

  const {logDate, logTime} = buildFoodLogDateTimeStrings();
  const timestamp = firebaseOps.getTimestamp();

  const foodLogData = {
    [FOOD_LOG_FIELDS.LOG_DATE]: logDate,
    [FOOD_LOG_FIELDS.LOG_TIME]: logTime,
    [FOOD_LOG_FIELDS.FOOD_DESCRIPTION]: foodDescription,
    [FOOD_LOG_FIELDS.CALORIE_CALCULATED]: calorieCalculated,
    [FOOD_LOG_FIELDS.PROCESSING_STATUS]: processingStatus,
    [FOOD_LOG_FIELDS.PROCESSING_ERROR_CODE]: processingErrorCode,
    [FOOD_LOG_FIELDS.CREATED_AT]: timestamp,
    [FOOD_LOG_FIELDS.UPDATED_AT]: timestamp,
  };

  const db = firebaseOps.getFirestore();
  const foodLogRef = await db
    .collection(USER_COLLECTION)
    .doc(userDocumentId)
    .collection(USER_SUBCOLLECTIONS.FOOD_LOGS)
    .add(foodLogData);

  return {
    userDocumentId,
    foodLogDocumentId: foodLogRef.id,
    foodLog: foodLogData,
  };
}

/**
 * Build formatted date/time strings for food logs using configured timezone.
 *
 * @returns {{logDate: string, logTime: string}}
 */
function buildFoodLogDateTimeStrings() {
  const now = new Date();

  const dateParts = new Intl.DateTimeFormat(
    "en-CA",
    FOOD_LOG_CONFIG.DATE_FORMAT_OPTIONS
  ).formatToParts(now);

  const timeParts = new Intl.DateTimeFormat(
    "en-GB",
    FOOD_LOG_CONFIG.TIME_FORMAT_OPTIONS
  ).formatToParts(now);

  const year = _getDateTimePartValue(dateParts, "year");
  const month = _getDateTimePartValue(dateParts, "month");
  const day = _getDateTimePartValue(dateParts, "day");
  const hour = _getDateTimePartValue(timeParts, "hour");
  const minute = _getDateTimePartValue(timeParts, "minute");
  const second = _getDateTimePartValue(timeParts, "second");

  return {
    logDate: `${year}-${month}-${day}`,
    logTime: `${hour}:${minute}:${second}`,
  };
}

function _validateUserFoodAnalysisInput({
  userDocumentId,
  processingStatus,
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }

  if (
    !processingStatus ||
    typeof processingStatus !== "string"
  ) {
    throw new Error("processingStatus is required and must be a string.");
  }

  if (
    processingStatus !== FOOD_LOG_PROCESSING_STATUS.SUCCESS &&
    processingStatus !== FOOD_LOG_PROCESSING_STATUS.FAILED
  ) {
    throw new Error("processingStatus is invalid.");
  }
}

/**
 * @param {Array<Intl.DateTimeFormatPart>} parts
 * @param {string} type
 * @returns {string}
 */
function _getDateTimePartValue(parts, type) {
  const matchedPart = parts.find((part) => part.type === type);
  return matchedPart ? matchedPart.value : "";
}

module.exports = {
  normalizeWhatsAppNumber,
  isUserRegisteredByPhone,
  getUserByPhone,
  buildUserRegistrationStatusReply,
  storeUserFoodAnalysis,
  buildFoodLogDateTimeStrings,
};