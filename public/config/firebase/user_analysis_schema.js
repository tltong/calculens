// public/config/firebase/user_analysis_schema.js

const USER_ANALYSIS_SUBCOLLECTIONS = {
  ANALYSIS_RUNS: "analysisRuns"
};

const USER_ANALYSIS_FIELDS = {
  TYPE: "type",
  STATUS: "status",
  PARAMETERS: "parameters",
  RESULT: "result",
  ERROR: "error",
  REQUESTED_BY: "requestedBy",
  REQUESTED_AT: "requestedAt",
  STARTED_AT: "startedAt",
  COMPLETED_AT: "completedAt",
  UPDATED_AT: "updatedAt"
};

const USER_ANALYSIS_PARAMETER_FIELDS = {
  LOG_DATE: "logDate"
};

const USER_ANALYSIS_RESULT_FIELDS = {
  FOOD_LOG_DATE: "foodLogDate",
  PHOTO_COUNT: "photoCount",
  COUNTED_PHOTO_COUNT: "countedPhotoCount",
  SKIPPED_PHOTO_COUNT: "skippedPhotoCount",
  TOTAL_CALORIES_CONSUMED: "totalCaloriesConsumed",
  DAILY_CALORIES_REQUIRED: "dailyCaloriesRequired",
  DAILY_CALORIE_SUMMARIES: "dailyCalorieSummaries",
  DAILY_AVERAGE_CALORIES_CONSUMED: "dailyAverageCaloriesConsumed",
  DAILY_AVERAGE_CALORIE_DIFFERENCE: "dailyAverageCalorieDifference",
  DAILY_AVERAGE_DAY_COUNT: "dailyAverageDayCount",
  CURRENT_WEIGHT_KG: "currentWeightKg",
  WEIGHT_CHANGE_PROJECTIONS: "weightChangeProjections",
  FOOD_CONSUMPTION_REVIEW: "foodConsumptionReview"
};

const USER_ANALYSIS_DAILY_RESULT_FIELDS = {
  FOOD_LOG_DATE: "foodLogDate",
  PHOTO_COUNT: "photoCount",
  COUNTED_PHOTO_COUNT: "countedPhotoCount",
  SKIPPED_PHOTO_COUNT: "skippedPhotoCount",
  TOTAL_CALORIES_CONSUMED: "totalCaloriesConsumed",
  CALORIE_DIFFERENCE: "calorieDifference",
  HAS_DATA: "hasData"
};

const USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS = {
  PERIOD_LABEL: "periodLabel",
  DAYS: "days",
  PROJECTED_WEIGHT_CHANGE_KG: "projectedWeightChangeKg",
  PROJECTED_WEIGHT_KG: "projectedWeightKg"
};

const USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS = {
  ASSESSMENT: "assessment",
  SUGGESTED_IMPROVEMENTS: "suggestedImprovements"
};

const USER_ANALYSIS_ERROR_FIELDS = {
  MESSAGE: "message",
  CODE: "code"
};

const USER_ANALYSIS_TYPES = {
  FOOD_SUMMARY: "foodSummary"
};

const USER_ANALYSIS_STATUSES = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed"
};

const USER_ANALYSIS_REQUEST_SOURCES = {
  ADMIN_PAGE: "admin_page",
  SCHEDULED_WEEKLY: "scheduled_weekly"
};

export {
  USER_ANALYSIS_SUBCOLLECTIONS,
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_DAILY_RESULT_FIELDS,
  USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS,
  USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_TYPES,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_REQUEST_SOURCES
};
