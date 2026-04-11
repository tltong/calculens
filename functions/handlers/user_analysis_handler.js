// functions/handlers/user_analysis_handler.js

const foodProcessingHandler = require("./food_processing_handler");
const {
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_TYPES,
} = require("../config/firebase/user_analysis_schema");

class UserAnalysisHandler {
  /**
   * Run a user analysis request.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {Object} params.analysisRun
   * @returns {Promise<Object>}
   */
  async runUserAnalysis({
    userDocumentId,
    analysisRun,
  }) {
    validateRunUserAnalysisInput({
      userDocumentId,
      analysisRun,
    });

    const analysisType = analysisRun[USER_ANALYSIS_FIELDS.TYPE];

    if (analysisType === USER_ANALYSIS_TYPES.FOOD_SUMMARY) {
      return this.runFoodSummaryAnalysis({
        userDocumentId,
        parameters: analysisRun[USER_ANALYSIS_FIELDS.PARAMETERS] || {},
      });
    }

    throw new Error(`Unsupported user analysis type: ${analysisType}`);
  }

  /**
   * Summarize a user's food photos and calories for one food log day.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {Object} [params.parameters]
   * @returns {Promise<Object>}
   */
  async runFoodSummaryAnalysis({
    userDocumentId,
    parameters = {},
  }) {
    const logDate = normalizeOptionalLogDate(
      parameters[USER_ANALYSIS_PARAMETER_FIELDS.LOG_DATE]
    );

    const dailySummary =
      await foodProcessingHandler.getUserTotalCaloriesConsumedForDay({
        userDocumentId,
        logDate,
      });

    return {
      [USER_ANALYSIS_RESULT_FIELDS.FOOD_LOG_DATE]: dailySummary.foodLogDate,
      [USER_ANALYSIS_RESULT_FIELDS.PHOTO_COUNT]: dailySummary.foodPhotoCount,
      [USER_ANALYSIS_RESULT_FIELDS.COUNTED_PHOTO_COUNT]:
        dailySummary.countedFoodPhotoCount,
      [USER_ANALYSIS_RESULT_FIELDS.SKIPPED_PHOTO_COUNT]:
        dailySummary.skippedFoodPhotoCount,
      [USER_ANALYSIS_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED]:
        dailySummary.totalCaloriesConsumed,
    };
  }
}

function validateRunUserAnalysisInput({
  userDocumentId,
  analysisRun,
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }

  if (!analysisRun || typeof analysisRun !== "object" || Array.isArray(analysisRun)) {
    throw new Error("analysisRun is required and must be an object.");
  }

  const analysisType = analysisRun[USER_ANALYSIS_FIELDS.TYPE];

  if (!analysisType || typeof analysisType !== "string") {
    throw new Error("Analysis type is required and must be a string.");
  }
}

function normalizeOptionalLogDate(logDate) {
  if (logDate === null || logDate === undefined || logDate === "") {
    return null;
  }

  if (typeof logDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    throw new Error("logDate must use YYYY-MM-DD format.");
  }

  return logDate;
}

module.exports = new UserAnalysisHandler();
module.exports.UserAnalysisHandler = UserAnalysisHandler;
