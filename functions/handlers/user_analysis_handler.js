// functions/handlers/user_analysis_handler.js

const foodProcessingHandler = require("./food_processing_handler");
const firebaseOps = require("../utils/firebase/firebase_ops");
const {
  USER_COLLECTION,
  USER_FIELDS,
} = require("../config/firebase/firebase_user_schema");
const {
  FOOD_DAILY_SUMMARY_FIELDS,
} = require("../config/firebase/food_data_schema");
const {
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_DAILY_RESULT_FIELDS,
  USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS,
  USER_ANALYSIS_CONFIG,
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
    const user = await firebaseOps.readDocument(USER_COLLECTION, userDocumentId);

    if (!user) {
      throw new Error(`User not found for document ID: ${userDocumentId}`);
    }

    const dailyCaloriesRequired = toNullableFiniteNumber(
      user[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]
    );
    const currentWeightKg = toNullableFiniteNumber(user[USER_FIELDS.WEIGHT_KG]);
    const logDate = normalizeOptionalLogDate(
      parameters[USER_ANALYSIS_PARAMETER_FIELDS.LOG_DATE]
    );

    const dailyCalorieSummaries =
      await this.getDailyCalorieSummariesForLastDays({
        userDocumentId,
        endLogDate: logDate,
        dayCount: USER_ANALYSIS_CONFIG.DEFAULT_DAILY_SUMMARY_DAY_COUNT,
        dailyCaloriesRequired,
      });

    const endDaySummary =
      dailyCalorieSummaries[dailyCalorieSummaries.length - 1] || {};
    const averageSummary =
      calculateDailyAverageCalories(dailyCalorieSummaries, {
        dailyCaloriesRequired,
      });

    return {
      [USER_ANALYSIS_RESULT_FIELDS.FOOD_LOG_DATE]:
        endDaySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.FOOD_LOG_DATE] || null,
      [USER_ANALYSIS_RESULT_FIELDS.PHOTO_COUNT]:
        endDaySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.PHOTO_COUNT] || 0,
      [USER_ANALYSIS_RESULT_FIELDS.COUNTED_PHOTO_COUNT]:
        endDaySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.COUNTED_PHOTO_COUNT] ||
        0,
      [USER_ANALYSIS_RESULT_FIELDS.SKIPPED_PHOTO_COUNT]:
        endDaySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.SKIPPED_PHOTO_COUNT] ||
        0,
      [USER_ANALYSIS_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED]:
        endDaySummary[
          USER_ANALYSIS_DAILY_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED
        ] || 0,
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_CALORIES_REQUIRED]:
        dailyCaloriesRequired,
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_CALORIE_SUMMARIES]:
        dailyCalorieSummaries,
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED]:
        averageSummary[
          USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED
        ],
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE]:
        averageSummary[
          USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE
        ],
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_DAY_COUNT]:
        averageSummary[USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_DAY_COUNT],
      [USER_ANALYSIS_RESULT_FIELDS.CURRENT_WEIGHT_KG]: currentWeightKg,
      [USER_ANALYSIS_RESULT_FIELDS.WEIGHT_CHANGE_PROJECTIONS]:
        buildWeightChangeProjections({
          dailyCalorieDifference:
            averageSummary[
              USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE
            ],
          currentWeightKg,
        }),
    };
  }

  /**
   * Build daily calorie summaries ending at a user-local food log date.
   *
   * If endLogDate is omitted, the user's current food log date is resolved by
   * the existing food processing handler.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {string|null} [params.endLogDate]
   * @param {number} [params.dayCount]
   * @param {number|null} [params.dailyCaloriesRequired]
   * @returns {Promise<Object[]>}
   */
  async getDailyCalorieSummariesForLastDays({
    userDocumentId,
    endLogDate = null,
    dayCount = USER_ANALYSIS_CONFIG.DEFAULT_DAILY_SUMMARY_DAY_COUNT,
    dailyCaloriesRequired = null,
  }) {
    const seededSummariesByDate = new Map();
    let resolvedEndLogDate = normalizeOptionalLogDate(endLogDate);

    if (!resolvedEndLogDate) {
      const currentDaySummary =
        await foodProcessingHandler.getUserTotalCaloriesConsumedForDay({
          userDocumentId,
        });

      resolvedEndLogDate =
        currentDaySummary[FOOD_DAILY_SUMMARY_FIELDS.FOOD_LOG_DATE];
      seededSummariesByDate.set(resolvedEndLogDate, currentDaySummary);
    }

    const logDates = buildTrailingLogDates({
      endLogDate: resolvedEndLogDate,
      dayCount,
    });

    const rawDailySummaries = await Promise.all(
      logDates.map(async (logDate) => {
        if (seededSummariesByDate.has(logDate)) {
          return seededSummariesByDate.get(logDate);
        }

        return foodProcessingHandler.getUserTotalCaloriesConsumedForDay({
          userDocumentId,
          logDate,
        });
      })
    );

    return rawDailySummaries.map((dailySummary) => {
      return mapDailySummaryResult({
        dailySummary,
        dailyCaloriesRequired,
      });
    });
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

  if (typeof logDate !== "string" || !isValidLogDateString(logDate)) {
    throw new Error("logDate must use YYYY-MM-DD format.");
  }

  return logDate;
}

function buildTrailingLogDates({
  endLogDate,
  dayCount,
}) {
  if (!isValidLogDateString(endLogDate)) {
    throw new Error("endLogDate must use YYYY-MM-DD format.");
  }

  const normalizedDayCount = Number(dayCount);

  if (
    !Number.isInteger(normalizedDayCount) ||
    normalizedDayCount < 1
  ) {
    throw new Error("dayCount must be an integer greater than 0.");
  }

  return Array.from({length: normalizedDayCount}, (_, index) => {
    const daysBeforeEndDate = normalizedDayCount - index - 1;
    return addDaysToLogDate(endLogDate, -daysBeforeEndDate);
  });
}

function addDaysToLogDate(logDate, offsetDays) {
  const [year, month, day] = logDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isValidLogDateString(logDate) {
  if (typeof logDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return false;
  }

  const [year, month, day] = logDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function mapDailySummaryResult({
  dailySummary,
  dailyCaloriesRequired,
}) {
  const photoCount = toNonNegativeNumber(
    dailySummary[FOOD_DAILY_SUMMARY_FIELDS.FOOD_PHOTO_COUNT]
  );
  const countedPhotoCount =
    toNonNegativeNumber(
      dailySummary[FOOD_DAILY_SUMMARY_FIELDS.COUNTED_FOOD_PHOTO_COUNT]
    );
  const skippedPhotoCount =
    toNonNegativeNumber(
      dailySummary[FOOD_DAILY_SUMMARY_FIELDS.SKIPPED_FOOD_PHOTO_COUNT]
    );
  const totalCaloriesConsumed =
    toNonNegativeNumber(
      dailySummary[FOOD_DAILY_SUMMARY_FIELDS.TOTAL_CALORIES_CONSUMED]
    );
  const hasData = photoCount > 0;

  return {
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.FOOD_LOG_DATE]:
      dailySummary[FOOD_DAILY_SUMMARY_FIELDS.FOOD_LOG_DATE],
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.PHOTO_COUNT]: photoCount,
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.COUNTED_PHOTO_COUNT]:
      countedPhotoCount,
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.SKIPPED_PHOTO_COUNT]:
      skippedPhotoCount,
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED]:
      totalCaloriesConsumed,
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.CALORIE_DIFFERENCE]:
      hasData ?
        calculateCalorieDifference({
          caloriesConsumed: totalCaloriesConsumed,
          caloriesRequired: dailyCaloriesRequired,
        }) :
        null,
    [USER_ANALYSIS_DAILY_RESULT_FIELDS.HAS_DATA]: hasData,
  };
}

function calculateDailyAverageCalories(
  dailyCalorieSummaries,
  {
    dailyCaloriesRequired = null,
  } = {}
) {
  const availableDailySummaries = dailyCalorieSummaries.filter(
    (dailySummary) => dailySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.HAS_DATA]
  );

  if (availableDailySummaries.length === 0) {
    return {
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED]: null,
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE]: null,
      [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_DAY_COUNT]: 0,
    };
  }

  const totalCalories = availableDailySummaries.reduce(
    (sum, dailySummary) => {
      return (
        sum +
        toNonNegativeNumber(
          dailySummary[
            USER_ANALYSIS_DAILY_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED
          ]
        )
      );
    },
    0
  );

  const dailyAverageCaloriesConsumed =
    totalCalories / availableDailySummaries.length;

  return {
    [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED]:
      dailyAverageCaloriesConsumed,
    [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE]:
      calculateCalorieDifference({
        caloriesConsumed: dailyAverageCaloriesConsumed,
        caloriesRequired: dailyCaloriesRequired,
      }),
    [USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_DAY_COUNT]:
      availableDailySummaries.length,
  };
}

function calculateCalorieDifference({
  caloriesConsumed,
  caloriesRequired,
}) {
  const normalizedCaloriesConsumed = toNullableFiniteNumber(caloriesConsumed);
  const normalizedCaloriesRequired = toNullableFiniteNumber(caloriesRequired);

  if (
    normalizedCaloriesConsumed === null ||
    normalizedCaloriesRequired === null
  ) {
    return null;
  }

  return normalizedCaloriesConsumed - normalizedCaloriesRequired;
}

function buildWeightChangeProjections({
  dailyCalorieDifference,
  currentWeightKg,
}) {
  const normalizedDailyCalorieDifference =
    toNullableFiniteNumber(dailyCalorieDifference);
  const normalizedCurrentWeightKg = toNullableFiniteNumber(currentWeightKg);

  return USER_ANALYSIS_CONFIG.WEIGHT_CHANGE_PROJECTION_PERIODS.map((period) => {
    const projectionDays =
      period[USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.DAYS];
    const projectedWeightChangeKg =
      normalizedDailyCalorieDifference === null ?
        null :
        (normalizedDailyCalorieDifference * projectionDays) /
          USER_ANALYSIS_CONFIG.CALORIES_PER_KG_BODY_WEIGHT;

    return {
      [USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PERIOD_LABEL]:
        period[USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PERIOD_LABEL],
      [USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.DAYS]: projectionDays,
      [USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PROJECTED_WEIGHT_CHANGE_KG]:
        projectedWeightChangeKg,
      [USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PROJECTED_WEIGHT_KG]:
        normalizedCurrentWeightKg === null ||
        projectedWeightChangeKg === null ?
          null :
          normalizedCurrentWeightKg + projectedWeightChangeKg,
    };
  });
}

function toNonNegativeNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function toNullableFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

module.exports = new UserAnalysisHandler();
module.exports.UserAnalysisHandler = UserAnalysisHandler;
