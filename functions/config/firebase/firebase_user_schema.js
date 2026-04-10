// functions/config/firebase/firebase_user_schema.js

const USER_COLLECTION = "users";

const USER_FIELDS = {
  NAME: "name",
  PHONE_NUMBER: "phoneNumber",
  DOB: "dob",
  GENDER: "gender",
  GMT: "gmt",
  HEIGHT_CM: "heightCm",
  WEIGHT_KG: "weightKg",
  STEPS_PER_DAY: "stepsPerDay",
  BODY_FAT_PERCENTAGE: "bodyFatPercentage",
  EXERCISE_FREQUENCY_PER_WEEK: "exerciseFrequencyPerWeek",
  EXERCISE_DURATION_MINUTES: "exerciseDurationMinutes",
  EXERCISE_INTENSITY: "exerciseIntensity",
  PROFILE_SNAPSHOTS: "profileSnapshots",
  BASE_CALORIES_PER_DAY: "baseCaloriesPerDay",
  NEAT_CALORIES_PER_DAY: "neatCaloriesPerDay",
  EAT_CALORIES_PER_DAY: "eatCaloriesPerDay",
  TEF_CALORIES_PER_DAY: "tefCaloriesPerDay",
  TOTAL_CALORIES_REQUIRED_PER_DAY: "totalCaloriesRequiredPerDay",
  CALORIE_METHOD: "calorieMethod",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt"
};

const USER_SUBCOLLECTIONS = {
  FOOD_LOGS: "foodLogs"
};

const FIREBASE_USER_LINKS = {
  REGISTRATION_URL_TEMPLATE:
    "https://calculens-35ead.web.app/pages/registration/registration.html?p{phoneNumber}"
};

/**
 * Build registration link for a given phone number
 * @param {string} phoneNumber
 * @returns {string}
 */
function buildUserRegistrationLink(phoneNumber) {
  const normalizedPhoneNumber = (phoneNumber || "").trim().replace(/^\+/, "");

  return FIREBASE_USER_LINKS.REGISTRATION_URL_TEMPLATE.replace(
    "{phoneNumber}",
    normalizedPhoneNumber
  );
}

module.exports = {
  USER_COLLECTION,
  USER_FIELDS,
  USER_SUBCOLLECTIONS,
  FIREBASE_USER_LINKS,
  buildUserRegistrationLink
};