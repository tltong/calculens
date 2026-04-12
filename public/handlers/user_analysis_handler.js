// public/handlers/user_analysis_handler.js

import {
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_TYPES,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_REQUEST_SOURCES
} from "/config/firebase/user_analysis_schema.js";

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
  buildFoodSummaryAnalysisRunData
};
