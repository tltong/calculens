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
  TOTAL_CALORIES_CONSUMED: "totalCaloriesConsumed"
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
  ADMIN_PAGE: "admin_page"
};

function buildFoodSummaryAnalysisRunData({
  logDate = "",
  requestedAt = Date.now()
} = {}) {
  const parameters = {};
  const normalizedLogDate = logDate?.toString().trim() ?? "";

  if (normalizedLogDate) {
    parameters[USER_ANALYSIS_PARAMETER_FIELDS.LOG_DATE] = normalizedLogDate;
  }

  return {
    [USER_ANALYSIS_FIELDS.TYPE]: USER_ANALYSIS_TYPES.FOOD_SUMMARY,
    [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.QUEUED,
    [USER_ANALYSIS_FIELDS.PARAMETERS]: parameters,
    [USER_ANALYSIS_FIELDS.REQUESTED_BY]:
      USER_ANALYSIS_REQUEST_SOURCES.ADMIN_PAGE,
    [USER_ANALYSIS_FIELDS.REQUESTED_AT]: requestedAt,
    [USER_ANALYSIS_FIELDS.UPDATED_AT]: requestedAt
  };
}

export {
  USER_ANALYSIS_SUBCOLLECTIONS,
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_TYPES,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_REQUEST_SOURCES,
  buildFoodSummaryAnalysisRunData
};
