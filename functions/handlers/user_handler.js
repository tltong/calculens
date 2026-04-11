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
  FOOD_LOG_SUBCOLLECTIONS,
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
 * users/{userDocumentId}/foodLogs/{logDate}/entries/{autoId}
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

  const {logDate, logTime, gmt} = buildFoodLogDateTimeStrings({
    gmt: existingUser[USER_FIELDS.GMT],
  });
  const timestamp = firebaseOps.getTimestamp();

  const foodLogData = {
    [FOOD_LOG_FIELDS.LOG_DATE]: logDate,
    [FOOD_LOG_FIELDS.LOG_TIME]: logTime,
    [FOOD_LOG_FIELDS.GMT]: gmt,
    [FOOD_LOG_FIELDS.FOOD_DESCRIPTION]: foodDescription,
    [FOOD_LOG_FIELDS.CALORIE_CALCULATED]: calorieCalculated,
    [FOOD_LOG_FIELDS.PROCESSING_STATUS]: processingStatus,
    [FOOD_LOG_FIELDS.PROCESSING_ERROR_CODE]: processingErrorCode,
    [FOOD_LOG_FIELDS.CREATED_AT]: timestamp,
    [FOOD_LOG_FIELDS.UPDATED_AT]: timestamp,
  };

  const db = firebaseOps.getFirestore();
  const foodLogDayRef = db
    .collection(USER_COLLECTION)
    .doc(userDocumentId)
    .collection(USER_SUBCOLLECTIONS.FOOD_LOGS)
    .doc(logDate);

  await ensureFoodLogDayDocument({
    foodLogDayRef,
    logDate,
    gmt,
    timestamp,
  });

  const foodLogRef = await foodLogDayRef
    .collection(FOOD_LOG_SUBCOLLECTIONS.ENTRIES)
    .add(foodLogData);

  return {
    userDocumentId,
    foodLogDate: logDate,
    foodLogEntryDocumentId: foodLogRef.id,
    foodLogDocumentId: foodLogRef.id,
    foodLog: foodLogData,
  };
}

/**
 * Build formatted date/time strings for food logs using the user's GMT offset.
 *
 * @param {Object} [params]
 * @param {string} [params.gmt]
 * @param {Date} [params.now]
 * @returns {{logDate: string, logTime: string, gmt: string}}
 */
function buildFoodLogDateTimeStrings({
  gmt = FOOD_LOG_CONFIG.DEFAULT_GMT,
  now = new Date(),
} = {}) {
  const normalizedGmt = normalizeGmtOffset(gmt);
  const offsetMinutes = parseGmtOffsetMinutes(normalizedGmt);
  const userLocalDate = new Date(now.getTime() + offsetMinutes * 60 * 1000);

  const year = String(userLocalDate.getUTCFullYear());
  const month = String(userLocalDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(userLocalDate.getUTCDate()).padStart(2, "0");
  const hour = String(userLocalDate.getUTCHours()).padStart(2, "0");
  const minute = String(userLocalDate.getUTCMinutes()).padStart(2, "0");
  const second = String(userLocalDate.getUTCSeconds()).padStart(2, "0");

  return {
    logDate: `${year}-${month}-${day}`,
    logTime: `${hour}:${minute}:${second}`,
    gmt: normalizedGmt,
  };
}

async function ensureFoodLogDayDocument({
  foodLogDayRef,
  logDate,
  gmt,
  timestamp,
}) {
  const foodLogDaySnapshot = await foodLogDayRef.get();
  const foodLogDayData = {
    [FOOD_LOG_FIELDS.LOG_DATE]: logDate,
    [FOOD_LOG_FIELDS.GMT]: gmt,
    [FOOD_LOG_FIELDS.UPDATED_AT]: timestamp,
  };

  if (!foodLogDaySnapshot.exists) {
    foodLogDayData[FOOD_LOG_FIELDS.CREATED_AT] = timestamp;
  }

  await foodLogDayRef.set(foodLogDayData, {merge: true});
}

function normalizeGmtOffset(gmt) {
  const parsedOffset = parseGmtOffset(gmt);

  if (!parsedOffset) {
    return FOOD_LOG_CONFIG.DEFAULT_GMT;
  }

  return formatGmtOffset(parsedOffset);
}

function parseGmtOffsetMinutes(gmt) {
  const parsedOffset = parseGmtOffset(gmt) ||
    parseGmtOffset(FOOD_LOG_CONFIG.DEFAULT_GMT);

  const signMultiplier = parsedOffset.sign === "-" ? -1 : 1;
  return signMultiplier * (parsedOffset.hours * 60 + parsedOffset.minutes);
}

function parseGmtOffset(gmt) {
  if (!gmt || typeof gmt !== "string") {
    return null;
  }

  const match = gmt.trim().match(/^GMT([+-])(\d{1,2}):(\d{2})$/i);

  if (!match) {
    return null;
  }

  const sign = match[1];
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 14 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  if (hours === 14 && minutes !== 0) {
    return null;
  }

  return {
    sign,
    hours,
    minutes,
  };
}

function formatGmtOffset({
  sign,
  hours,
  minutes,
}) {
  return `GMT${sign}${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
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

module.exports = {
  normalizeWhatsAppNumber,
  isUserRegisteredByPhone,
  getUserByPhone,
  buildUserRegistrationStatusReply,
  storeUserFoodAnalysis,
  buildFoodLogDateTimeStrings,
  normalizeGmtOffset,
  parseGmtOffsetMinutes,
};
