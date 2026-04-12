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
    "https://calculens-35ead.web.app/pages/registration/registration.html?p{phoneNumber}",
  EDIT_PROFILE_URL_TEMPLATE:
    "https://calculens-35ead.web.app/pages/edit_profile/edit_profile.html?userId={userDocumentId}",
  USER_ANALYSIS_URL_TEMPLATE:
    "https://calculens-35ead.web.app/pages/user_analysis/user_analysis.html?userId={userDocumentId}&analysisRunId={analysisRunId}"
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

/**
 * Build edit profile link for a given user document ID
 * @param {string} userDocumentId
 * @returns {string}
 */
function buildUserEditProfileLink(userDocumentId) {
  const normalizedUserDocumentId = (userDocumentId || "").trim();

  return FIREBASE_USER_LINKS.EDIT_PROFILE_URL_TEMPLATE.replace(
    "{userDocumentId}",
    encodeURIComponent(normalizedUserDocumentId)
  );
}

/**
 * Build user analysis link for a given user and analysis run.
 * @param {Object} params
 * @param {string} params.userDocumentId
 * @param {string} params.analysisRunId
 * @returns {string}
 */
function buildUserAnalysisLink({
  userDocumentId,
  analysisRunId,
}) {
  const normalizedUserDocumentId = (userDocumentId || "").trim();
  const normalizedAnalysisRunId = (analysisRunId || "").trim();

  return FIREBASE_USER_LINKS.USER_ANALYSIS_URL_TEMPLATE
      .replace(
          "{userDocumentId}",
          encodeURIComponent(normalizedUserDocumentId)
      )
      .replace(
          "{analysisRunId}",
          encodeURIComponent(normalizedAnalysisRunId)
      );
}

module.exports = {
  USER_COLLECTION,
  USER_FIELDS,
  USER_SUBCOLLECTIONS,
  FIREBASE_USER_LINKS,
  buildUserRegistrationLink,
  buildUserEditProfileLink,
  buildUserAnalysisLink
};
