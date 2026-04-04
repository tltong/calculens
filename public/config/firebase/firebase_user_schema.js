// public/config/firebase/firebase_user_schema.js

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

const PROFILE_SNAPSHOT_FIELDS = {
  WEIGHT_KG: USER_FIELDS.WEIGHT_KG,
  STEPS_PER_DAY: USER_FIELDS.STEPS_PER_DAY,
  BODY_FAT_PERCENTAGE: USER_FIELDS.BODY_FAT_PERCENTAGE,
  EXERCISE_FREQUENCY_PER_WEEK: USER_FIELDS.EXERCISE_FREQUENCY_PER_WEEK,
  EXERCISE_DURATION_MINUTES: USER_FIELDS.EXERCISE_DURATION_MINUTES,
  EXERCISE_INTENSITY: USER_FIELDS.EXERCISE_INTENSITY,
  BASE_CALORIES_PER_DAY: USER_FIELDS.BASE_CALORIES_PER_DAY,
  NEAT_CALORIES_PER_DAY: USER_FIELDS.NEAT_CALORIES_PER_DAY,
  EAT_CALORIES_PER_DAY: USER_FIELDS.EAT_CALORIES_PER_DAY,
  TEF_CALORIES_PER_DAY: USER_FIELDS.TEF_CALORIES_PER_DAY,
  TOTAL_CALORIES_REQUIRED_PER_DAY: USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY,
  SNAPSHOT_DATE: "snapshotDate",
  SNAPSHOT_CREATED_AT: "snapshotCreatedAt"
};

const GENDER_OPTIONS = ["male", "female"];

const GMT_OPTIONS = [
  "GMT-12:00",
  "GMT-11:00",
  "GMT-10:00",
  "GMT-09:30",
  "GMT-09:00",
  "GMT-08:00",
  "GMT-07:00",
  "GMT-06:00",
  "GMT-05:00",
  "GMT-04:00",
  "GMT-03:30",
  "GMT-03:00",
  "GMT-02:00",
  "GMT-01:00",
  "GMT+00:00",
  "GMT+01:00",
  "GMT+02:00",
  "GMT+03:00",
  "GMT+03:30",
  "GMT+04:00",
  "GMT+04:30",
  "GMT+05:00",
  "GMT+05:30",
  "GMT+05:45",
  "GMT+06:00",
  "GMT+06:30",
  "GMT+07:00",
  "GMT+08:00",
  "GMT+08:45",
  "GMT+09:00",
  "GMT+09:30",
  "GMT+10:00",
  "GMT+10:30",
  "GMT+11:00",
  "GMT+12:00",
  "GMT+12:45",
  "GMT+13:00",
  "GMT+14:00"
];

const EXERCISE_FREQUENCY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];

const EXERCISE_INTENSITY_OPTIONS = ["low", "moderate", "hard"];

/**
 * Returns YYYY-MM-DD based on local date
 * @param {number} timestamp
 * @returns {string}
 */
function getSnapshotDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize profile metric input
 * @param {Object} rawInput
 * @returns {Object}
 */
function normalizeProfileMetricInput(rawInput) {
  const rawBodyFatPercentage =
    rawInput.bodyFatPercentage?.toString().trim() ?? "";

  return {
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
 * Build a dated profile snapshot payload
 * @param {Object} input
 * @param {number} timestamp
 * @returns {{dateKey: string, snapshot: Object}}
 */
function buildProfileSnapshot(input, timestamp = Date.now()) {
  const normalized = normalizeProfileMetricInput(input);
  const dateKey = getSnapshotDateKey(timestamp);

  return {
    dateKey,
    snapshot: {
      [PROFILE_SNAPSHOT_FIELDS.WEIGHT_KG]: normalized.weightKg,
      [PROFILE_SNAPSHOT_FIELDS.STEPS_PER_DAY]: normalized.stepsPerDay,
      [PROFILE_SNAPSHOT_FIELDS.BODY_FAT_PERCENTAGE]: normalized.bodyFatPercentage,
      [PROFILE_SNAPSHOT_FIELDS.EXERCISE_FREQUENCY_PER_WEEK]:
        normalized.exerciseFrequencyPerWeek,
      [PROFILE_SNAPSHOT_FIELDS.EXERCISE_DURATION_MINUTES]:
        normalized.exerciseDurationMinutes,
      [PROFILE_SNAPSHOT_FIELDS.EXERCISE_INTENSITY]: normalized.exerciseIntensity,
      [PROFILE_SNAPSHOT_FIELDS.BASE_CALORIES_PER_DAY]: null,
      [PROFILE_SNAPSHOT_FIELDS.NEAT_CALORIES_PER_DAY]: null,
      [PROFILE_SNAPSHOT_FIELDS.EAT_CALORIES_PER_DAY]: null,
      [PROFILE_SNAPSHOT_FIELDS.TEF_CALORIES_PER_DAY]: null,
      [PROFILE_SNAPSHOT_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]: null,
      [PROFILE_SNAPSHOT_FIELDS.SNAPSHOT_DATE]: dateKey,
      [PROFILE_SNAPSHOT_FIELDS.SNAPSHOT_CREATED_AT]: timestamp
    }
  };
}

/**
 * Creates a normalized user payload for Firestore
 * @param {Object} input
 * @returns {Object}
 */
function buildUserData(input) {
  const now = Date.now();
  const { dateKey, snapshot } = buildProfileSnapshot(input, now);

  return {
    [USER_FIELDS.NAME]: input.name ?? "",
    [USER_FIELDS.PHONE_NUMBER]: input.phoneNumber ?? "",
    [USER_FIELDS.DOB]: input.dob ?? "",
    [USER_FIELDS.GENDER]: input.gender ?? "",
    [USER_FIELDS.GMT]: input.gmt ?? "",
    [USER_FIELDS.HEIGHT_CM]: input.heightCm ?? null,
    [USER_FIELDS.WEIGHT_KG]: input.weightKg ?? null,
    [USER_FIELDS.STEPS_PER_DAY]: input.stepsPerDay ?? null,
    [USER_FIELDS.BODY_FAT_PERCENTAGE]: input.bodyFatPercentage ?? null,
    [USER_FIELDS.EXERCISE_FREQUENCY_PER_WEEK]: input.exerciseFrequencyPerWeek ?? null,
    [USER_FIELDS.EXERCISE_DURATION_MINUTES]: input.exerciseDurationMinutes ?? null,
    [USER_FIELDS.EXERCISE_INTENSITY]: input.exerciseIntensity ?? "",
    [USER_FIELDS.BASE_CALORIES_PER_DAY]: null,
    [USER_FIELDS.NEAT_CALORIES_PER_DAY]: null,
    [USER_FIELDS.EAT_CALORIES_PER_DAY]: null,
    [USER_FIELDS.TEF_CALORIES_PER_DAY]: null,
    [USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]: null,
    [USER_FIELDS.CALORIE_METHOD]: "",
    [USER_FIELDS.PROFILE_SNAPSHOTS]: {
      [dateKey]: snapshot
    },
    [USER_FIELDS.CREATED_AT]: input.createdAt ?? now,
    [USER_FIELDS.UPDATED_AT]: now
  };
}

function buildProfileSnapshotFieldPath(dateKey) {
  return `${USER_FIELDS.PROFILE_SNAPSHOTS}.${dateKey}`;
}

function buildProfileSnapshotsMap(dateKey, snapshot) {
  return {
    [USER_FIELDS.PROFILE_SNAPSHOTS]: {
      [dateKey]: snapshot
    }
  };
}

function applyDerivedFieldsToProfileSnapshot(snapshot, derivedValues = {}) {
  return {
    ...snapshot,
    [PROFILE_SNAPSHOT_FIELDS.BASE_CALORIES_PER_DAY]:
      derivedValues[USER_FIELDS.BASE_CALORIES_PER_DAY] ?? null,
    [PROFILE_SNAPSHOT_FIELDS.NEAT_CALORIES_PER_DAY]:
      derivedValues[USER_FIELDS.NEAT_CALORIES_PER_DAY] ?? null,
    [PROFILE_SNAPSHOT_FIELDS.EAT_CALORIES_PER_DAY]:
      derivedValues[USER_FIELDS.EAT_CALORIES_PER_DAY] ?? null,
    [PROFILE_SNAPSHOT_FIELDS.TEF_CALORIES_PER_DAY]:
      derivedValues[USER_FIELDS.TEF_CALORIES_PER_DAY] ?? null,
    [PROFILE_SNAPSHOT_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]:
      derivedValues[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? null
  };
}

function buildProfileMetricsUpdateData(input) {
  const now = Date.now();
  const normalized = normalizeProfileMetricInput(input);
  const { dateKey, snapshot } = buildProfileSnapshot(normalized, now);

  const updatePayload = {
    [USER_FIELDS.WEIGHT_KG]: normalized.weightKg,
    [USER_FIELDS.STEPS_PER_DAY]: normalized.stepsPerDay,
    [USER_FIELDS.BODY_FAT_PERCENTAGE]: normalized.bodyFatPercentage,
    [USER_FIELDS.EXERCISE_FREQUENCY_PER_WEEK]: normalized.exerciseFrequencyPerWeek,
    [USER_FIELDS.EXERCISE_DURATION_MINUTES]: normalized.exerciseDurationMinutes,
    [USER_FIELDS.EXERCISE_INTENSITY]: normalized.exerciseIntensity,
    [buildProfileSnapshotFieldPath(dateKey)]: snapshot,
    [USER_FIELDS.UPDATED_AT]: now
  };

  if (typeof input.name === "string" && input.name.trim()) {
    updatePayload[USER_FIELDS.NAME] = input.name.trim();
  }

  return updatePayload;
}

export {
  USER_COLLECTION,
  USER_FIELDS,
  PROFILE_SNAPSHOT_FIELDS,
  GENDER_OPTIONS,
  GMT_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS,
  getSnapshotDateKey,
  normalizeProfileMetricInput,
  buildProfileSnapshot,
  buildUserData,
  buildProfileSnapshotFieldPath,
  buildProfileSnapshotsMap,
  applyDerivedFieldsToProfileSnapshot,
  buildProfileMetricsUpdateData
};