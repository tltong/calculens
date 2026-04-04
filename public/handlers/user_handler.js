// public/handlers/user_handler.js

import { initFirebase } from "/utils/firebase/firebase.js";
import {
  initFirestore,
  addDocument,
  queryDocuments,
  getDocument,
  updateDocument
} from "/utils/firebase/firebase_ops.js";

import {
  USER_COLLECTION,
  USER_FIELDS,
  GENDER_OPTIONS,
  GMT_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS,
  buildUserData,
  normalizeProfileMetricInput,
  buildProfileMetricsUpdateData,
  buildProfileSnapshot,
  buildProfileSnapshotFieldPath,
  buildProfileSnapshotsMap,
  applyDerivedFieldsToProfileSnapshot
} from "/config/firebase/firebase_user_schema.js";

import {
  calculateDailyCalorieFields
} from "/handlers/user_calorie_handler.js";

/**
 * Initialize user handler dependencies
 */
function initUserHandler() {
  initFirebase();
  initFirestore();
  console.log("[UserHandler] Initialized");
}

/**
 * Validate E.164 phone number
 * @param {string} phoneNumber
 * @returns {boolean}
 */
function isValidE164PhoneNumber(phoneNumber) {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

function isPositiveNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0;
}

function isValidDob(dob) {
  if (!dob || typeof dob !== "string") {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dob)) {
    return false;
  }

  const parsedDate = new Date(dob);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const [year, month, day] = dob.split("-").map(Number);
  const reconstructedYear = parsedDate.getUTCFullYear();
  const reconstructedMonth = parsedDate.getUTCMonth() + 1;
  const reconstructedDay = parsedDate.getUTCDate();

  if (
    reconstructedYear !== year ||
    reconstructedMonth !== month ||
    reconstructedDay !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  return dob <= todayString;
}

/**
 * Normalize raw registration input
 * @param {Object} rawInput
 * @returns {Object}
 */
function normalizeRegistrationInput(rawInput) {
  const rawBodyFatPercentage =
    rawInput.bodyFatPercentage?.toString().trim() ?? "";

  return {
    name: rawInput.name?.trim() ?? "",
    phoneNumber: rawInput.phoneNumber?.trim() ?? "",
    dob: rawInput.dob?.trim() ?? "",
    gender: rawInput.gender?.trim().toLowerCase() ?? "",
    gmt: rawInput.gmt?.trim() ?? "",
    heightCm: rawInput.heightCm === "" ? null : Number(rawInput.heightCm),
    weightKg: rawInput.weightKg === "" ? null : Number(rawInput.weightKg),
    stepsPerDay: rawInput.stepsPerDay === "" ? null : Number(rawInput.stepsPerDay),
    bodyFatPercentage:
      rawBodyFatPercentage === "" ? null : Number(rawBodyFatPercentage),
    exerciseFrequencyPerWeek:
      rawInput.exerciseFrequencyPerWeek === ""
        ? null
        : Number(rawInput.exerciseFrequencyPerWeek),
    exerciseDurationMinutes:
      rawInput.exerciseDurationMinutes === ""
        ? null
        : Number(rawInput.exerciseDurationMinutes),
    exerciseIntensity: rawInput.exerciseIntensity?.trim().toLowerCase() ?? ""
  };
}

/**
 * Validate registration input
 * @param {Object} rawInput
 * @returns {{valid: boolean, errors: string[], data: Object}}
 */
function validateRegistrationInput(rawInput) {
  const data = normalizeRegistrationInput(rawInput);
  const errors = [];

  if (!data.name) {
    errors.push("Name is required.");
  }

  if (!data.phoneNumber) {
    errors.push("Phone number is required.");
  } else if (!isValidE164PhoneNumber(data.phoneNumber)) {
    errors.push("Phone number must be in E.164 format, for example +60123456789.");
  }

  if (!data.dob) {
    errors.push("DOB is required.");
  } else if (!isValidDob(data.dob)) {
    errors.push("DOB must be a valid date in YYYY-MM-DD format and cannot be in the future.");
  }

  if (!GENDER_OPTIONS.includes(data.gender)) {
    errors.push(`Gender must be one of: ${GENDER_OPTIONS.join(", ")}.`);
  }

  if (!GMT_OPTIONS.includes(data.gmt)) {
    errors.push("GMT must be selected from the dropdown.");
  }

  if (!isPositiveNumber(data.heightCm)) {
    errors.push("Height must be a valid number greater than 0.");
  }

  if (!isPositiveNumber(data.weightKg)) {
    errors.push("Weight must be a valid number greater than 0.");
  }

  if (!isNonNegativeNumber(data.stepsPerDay)) {
    errors.push("Steps per day must be 0 or more.");
  }

  if (
    data.bodyFatPercentage !== null &&
    (
      !isNonNegativeNumber(data.bodyFatPercentage) ||
      data.bodyFatPercentage > 100
    )
  ) {
    errors.push("Body fat percentage must be between 0 and 100 when provided.");
  }

  if (!EXERCISE_FREQUENCY_OPTIONS.includes(data.exerciseFrequencyPerWeek)) {
    errors.push("Exercise frequency must be selected from 0 to 7.");
  }

  if (!isNonNegativeNumber(data.exerciseDurationMinutes)) {
    errors.push("Exercise duration must be 0 minutes or more.");
  }

  if (!EXERCISE_INTENSITY_OPTIONS.includes(data.exerciseIntensity)) {
    errors.push(
      `Exercise intensity must be one of: ${EXERCISE_INTENSITY_OPTIONS.join(", ")}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

/**
 * Validate editable profile input
 * @param {Object} rawInput
 * @returns {{valid: boolean, errors: string[], data: Object}}
 */
function validateProfileMetricsInput(rawInput) {
  const data = normalizeProfileMetricInput(rawInput);
  const errors = [];
  const name = rawInput.name?.trim() ?? "";

  if (!name) {
    errors.push("Name is required.");
  }

  if (!isPositiveNumber(data.weightKg)) {
    errors.push("Weight must be a valid number greater than 0.");
  }

  if (!isNonNegativeNumber(data.stepsPerDay)) {
    errors.push("Steps per day must be 0 or more.");
  }

  if (
    data.bodyFatPercentage !== null &&
    (
      !isNonNegativeNumber(data.bodyFatPercentage) ||
      data.bodyFatPercentage > 100
    )
  ) {
    errors.push("Body fat percentage must be between 0 and 100 when provided.");
  }

  if (!EXERCISE_FREQUENCY_OPTIONS.includes(data.exerciseFrequencyPerWeek)) {
    errors.push("Exercise frequency must be selected from 0 to 7.");
  }

  if (!isNonNegativeNumber(data.exerciseDurationMinutes)) {
    errors.push("Exercise duration must be 0 minutes or more.");
  }

  if (!EXERCISE_INTENSITY_OPTIONS.includes(data.exerciseIntensity)) {
    errors.push(
      `Exercise intensity must be one of: ${EXERCISE_INTENSITY_OPTIONS.join(", ")}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      ...data,
      name
    }
  };
}

/**
 * Get a user by phone number
 * @param {string} phoneNumber
 * @returns {Promise<Object|null>}
 */
async function getUserByPhoneNumber(phoneNumber) {
  const results = await queryDocuments(
    USER_COLLECTION,
    USER_FIELDS.PHONE_NUMBER,
    "==",
    phoneNumber
  );

  return results.length > 0 ? results[0] : null;
}

/**
 * Get user by document ID
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getUserById(userId) {
  if (!userId || typeof userId !== "string") {
    return null;
  }

  return await getDocument(USER_COLLECTION, userId.trim());
}

/**
 * Add calculated calorie fields safely without breaking registration/update
 * @param {Object} userData
 * @returns {Object}
 */
function appendCalorieFieldsSafely(userData) {
  try {
    const calorieFields = calculateDailyCalorieFields(userData);
    console.log("[UserHandler] calorieFields:", calorieFields);

    return {
      ...userData,
      [USER_FIELDS.BASE_CALORIES_PER_DAY]:
        calorieFields[USER_FIELDS.BASE_CALORIES_PER_DAY] ?? null,
      [USER_FIELDS.NEAT_CALORIES_PER_DAY]:
        calorieFields[USER_FIELDS.NEAT_CALORIES_PER_DAY] ?? null,
      [USER_FIELDS.EAT_CALORIES_PER_DAY]:
        calorieFields[USER_FIELDS.EAT_CALORIES_PER_DAY] ?? null,
      [USER_FIELDS.TEF_CALORIES_PER_DAY]:
        calorieFields[USER_FIELDS.TEF_CALORIES_PER_DAY] ?? null,
      [USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]:
        calorieFields[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? null,
      [USER_FIELDS.CALORIE_METHOD]:
        calorieFields[USER_FIELDS.CALORIE_METHOD] ?? ""
    };
  } catch (error) {
    console.warn("[UserHandler] Calorie calculation skipped:", error);
    return userData;
  }
}

/**
 * Build nested profileSnapshots object for create payloads
 * @param {Object} userData
 * @param {number} [timestamp]
 * @returns {Object}
 */
function buildCurrentProfileSnapshotsCreateData(userData, timestamp = Date.now()) {
  const { dateKey, snapshot } = buildProfileSnapshot(userData, timestamp);
  const snapshotWithDerivedFields = applyDerivedFieldsToProfileSnapshot(snapshot, userData);

  return buildProfileSnapshotsMap(dateKey, snapshotWithDerivedFields);
}

/**
 * Build profileSnapshots.<dateKey> update payload for update operations
 * @param {Object} userData
 * @param {number} [timestamp]
 * @returns {Object}
 */
function buildCurrentProfileSnapshotUpdateData(userData, timestamp = Date.now()) {
  const { dateKey, snapshot } = buildProfileSnapshot(userData, timestamp);
  const snapshotWithDerivedFields = applyDerivedFieldsToProfileSnapshot(snapshot, userData);

  return {
    [buildProfileSnapshotFieldPath(dateKey)]: snapshotWithDerivedFields
  };
}

/**
 * Register a new user
 * @param {Object} rawInput
 * @returns {Promise<{success: boolean, userId?: string, data?: Object, errors?: string[]}>}
 */
async function registerUser(rawInput) {
  const validation = validateRegistrationInput(rawInput);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  const existingUser = await getUserByPhoneNumber(validation.data.phoneNumber);

  if (existingUser) {
    return {
      success: false,
      errors: ["A user with this phone number already exists."]
    };
  }

  const baseUserData = buildUserData(validation.data);
  const userDataWithCalories = appendCalorieFieldsSafely(baseUserData);

  const userData = {
    ...userDataWithCalories,
    ...buildCurrentProfileSnapshotsCreateData(
      userDataWithCalories,
      userDataWithCalories[USER_FIELDS.UPDATED_AT]
    )
  };

  console.log("[UserHandler] final userData before save:", userData);

  const userId = await addDocument(USER_COLLECTION, userData);

  return {
    success: true,
    userId,
    data: userData
  };
}

/**
 * Update editable profile fields and save snapshot
 * @param {string} userId
 * @param {Object} rawInput
 * @returns {Promise<{success: boolean, userId?: string, data?: Object, user?: Object, errors?: string[]}>}
 */
async function updateUserProfileMetrics(userId, rawInput) {
  const trimmedUserId = userId?.trim();

  if (!trimmedUserId) {
    return {
      success: false,
      errors: ["User document ID is required."]
    };
  }

  const existingUser = await getUserById(trimmedUserId);

  if (!existingUser) {
    return {
      success: false,
      errors: ["User not found."]
    };
  }

  const validation = validateProfileMetricsInput(rawInput);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  const baseUpdateData = buildProfileMetricsUpdateData(validation.data);

  const mergedUserData = {
    ...existingUser,
    ...baseUpdateData
  };

  const mergedUserDataWithCalories = appendCalorieFieldsSafely(mergedUserData);

  const updateData = {
    ...baseUpdateData,
    [USER_FIELDS.BASE_CALORIES_PER_DAY]:
      mergedUserDataWithCalories[USER_FIELDS.BASE_CALORIES_PER_DAY] ?? null,
    [USER_FIELDS.NEAT_CALORIES_PER_DAY]:
      mergedUserDataWithCalories[USER_FIELDS.NEAT_CALORIES_PER_DAY] ?? null,
    [USER_FIELDS.EAT_CALORIES_PER_DAY]:
      mergedUserDataWithCalories[USER_FIELDS.EAT_CALORIES_PER_DAY] ?? null,
    [USER_FIELDS.TEF_CALORIES_PER_DAY]:
      mergedUserDataWithCalories[USER_FIELDS.TEF_CALORIES_PER_DAY] ?? null,
    [USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]:
      mergedUserDataWithCalories[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? null,
    [USER_FIELDS.CALORIE_METHOD]:
      mergedUserDataWithCalories[USER_FIELDS.CALORIE_METHOD] ?? ""
  };

  Object.assign(
    updateData,
    buildCurrentProfileSnapshotUpdateData(
      mergedUserDataWithCalories,
      baseUpdateData[USER_FIELDS.UPDATED_AT]
    )
  );

  console.log("[UserHandler] final updateData before save:", updateData);

  await updateDocument(USER_COLLECTION, trimmedUserId, updateData);

  const updatedUser = await getUserById(trimmedUserId);

  return {
    success: true,
    userId: trimmedUserId,
    data: updateData,
    user: updatedUser
  };
}

export {
  initUserHandler,
  isValidE164PhoneNumber,
  normalizeRegistrationInput,
  validateRegistrationInput,
  validateProfileMetricsInput,
  getUserByPhoneNumber,
  getUserById,
  registerUser,
  updateUserProfileMetrics
};