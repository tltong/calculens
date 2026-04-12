// functions/handlers/user_analysis_handler.js

const foodProcessingHandler = require("./food_processing_handler");
const {
  getGeminiFoodConsumptionReviewer,
} = require("../utils/llm/gemini/gemini_food_consumption_review");
const firebaseOps = require("../utils/firebase/firebase_ops");
const {
  USER_COLLECTION,
  USER_FIELDS,
  USER_SUBCOLLECTIONS,
} = require("../config/firebase/firebase_user_schema");
const {
  FOOD_ANALYSIS_FIELDS,
  FOOD_ITEM_FIELDS,
  FOOD_LOG_FIELDS,
  FOOD_DAILY_SUMMARY_FIELDS,
  FOOD_LOG_SUBCOLLECTIONS,
  FOOD_LOG_PROCESSING_STATUS,
} = require("../config/firebase/food_data_schema");
const {
  USER_ANALYSIS_SUBCOLLECTIONS,
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_DAILY_RESULT_FIELDS,
  USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS,
  USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_TYPES,
} = require("../config/firebase/user_analysis_schema");
const {
  USER_ANALYSIS_CONFIG,
} = require("../config/analysis/user_analysis");

class UserAnalysisHandler {
  /**
   * Process a queued analysis run and persist lifecycle updates.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {string} params.analysisRunId
   * @param {Object} params.analysisRun
   * @returns {Promise<Object>}
   */
  async processUserAnalysisRun({
    userDocumentId,
    analysisRunId,
    analysisRun,
  }) {
    validateProcessUserAnalysisRunInput({
      userDocumentId,
      analysisRunId,
      analysisRun,
    });

    const status = analysisRun[USER_ANALYSIS_FIELDS.STATUS];

    if (status !== USER_ANALYSIS_STATUSES.QUEUED) {
      console.log(
        "[UserAnalysisHandler] Ignoring non-queued analysis run:",
        analysisRunId
      );
      return {
        ignored: true,
        status,
      };
    }

    const analysisRunRef = this.getUserAnalysisRunRef({
      userDocumentId,
      analysisRunId,
    });
    const timestamp = firebaseOps.getTimestamp();

    try {
      await analysisRunRef.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.PROCESSING,
        [USER_ANALYSIS_FIELDS.STARTED_AT]: timestamp,
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: timestamp,
      });

      const result = await this.runUserAnalysis({
        userDocumentId,
        analysisRun,
      });

      const completedTimestamp = firebaseOps.getTimestamp();

      await analysisRunRef.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.COMPLETED,
        [USER_ANALYSIS_FIELDS.RESULT]: result,
        [USER_ANALYSIS_FIELDS.COMPLETED_AT]: completedTimestamp,
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: completedTimestamp,
      });

      console.log(
        "[UserAnalysisHandler] Completed analysis run:",
        analysisRunId
      );

      return {
        ignored: false,
        status: USER_ANALYSIS_STATUSES.COMPLETED,
        result,
      };
    } catch (error) {
      const failedTimestamp = firebaseOps.getTimestamp();

      console.error("[UserAnalysisHandler] Analysis failed:", error);

      await analysisRunRef.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.FAILED,
        [USER_ANALYSIS_FIELDS.ERROR]: {
          [USER_ANALYSIS_ERROR_FIELDS.MESSAGE]: error.message,
        },
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: failedTimestamp,
      });

      return {
        ignored: false,
        status: USER_ANALYSIS_STATUSES.FAILED,
        error,
      };
    }
  }

  /**
   * Build a reference to one user's analysis run document.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {string} params.analysisRunId
   * @returns {FirebaseFirestore.DocumentReference}
   */
  getUserAnalysisRunRef({
    userDocumentId,
    analysisRunId,
  }) {
    return firebaseOps
        .getFirestore()
        .collection(USER_COLLECTION)
        .doc(userDocumentId)
        .collection(USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS)
        .doc(analysisRunId);
  }

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
    const foodConsumptionEntries =
      await this.getFoodConsumptionEntriesForLogDates({
        userDocumentId,
        logDates: getDailySummaryLogDates(dailyCalorieSummaries),
      });
    const foodConsumptionReview = await buildFoodConsumptionReview({
      foodConsumptionEntries,
      dailyCalorieSummaries,
      dailyCaloriesRequired,
      averageSummary,
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
      [USER_ANALYSIS_RESULT_FIELDS.FOOD_CONSUMPTION_REVIEW]:
        foodConsumptionReview,
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

  /**
   * Load successful food log entries for a set of user-local food log dates.
   *
   * @param {Object} params
   * @param {string} params.userDocumentId
   * @param {string[]} params.logDates
   * @returns {Promise<Object[]>}
   */
  async getFoodConsumptionEntriesForLogDates({
    userDocumentId,
    logDates,
  }) {
    const uniqueLogDates = Array.from(new Set(logDates || []))
        .filter(isValidLogDateString);

    if (uniqueLogDates.length === 0) {
      return [];
    }

    const db = firebaseOps.getFirestore();
    const dailyEntries = await Promise.all(
      uniqueLogDates.map(async (logDate) => {
        const entriesSnapshot = await db
            .collection(USER_COLLECTION)
            .doc(userDocumentId)
            .collection(USER_SUBCOLLECTIONS.FOOD_LOGS)
            .doc(logDate)
            .collection(FOOD_LOG_SUBCOLLECTIONS.ENTRIES)
            .orderBy(FOOD_LOG_FIELDS.LOG_TIME)
            .get();

        return entriesSnapshot.docs
            .map((entrySnapshot) => {
              return mapFoodConsumptionEntryForReview(
                  entrySnapshot.data() || {}
              );
            })
            .filter(Boolean);
      })
    );

    return dailyEntries
        .flat()
        .sort(compareFoodConsumptionEntriesForReview)
        .slice(-USER_ANALYSIS_CONFIG.FOOD_CONSUMPTION_REVIEW_MAX_ENTRIES);
  }
}

function validateRunUserAnalysisInput({
  userDocumentId,
  analysisRun,
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }

  if (
    !analysisRun ||
    typeof analysisRun !== "object" ||
    Array.isArray(analysisRun)
  ) {
    throw new Error("analysisRun is required and must be an object.");
  }

  const analysisType = analysisRun[USER_ANALYSIS_FIELDS.TYPE];

  if (!analysisType || typeof analysisType !== "string") {
    throw new Error("Analysis type is required and must be a string.");
  }
}

function validateProcessUserAnalysisRunInput({
  userDocumentId,
  analysisRunId,
  analysisRun,
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }

  if (!analysisRunId || typeof analysisRunId !== "string") {
    throw new Error("analysisRunId is required and must be a string.");
  }

  if (
    !analysisRun ||
    typeof analysisRun !== "object" ||
    Array.isArray(analysisRun)
  ) {
    throw new Error("analysisRun is required and must be an object.");
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

function getDailySummaryLogDates(dailyCalorieSummaries) {
  if (!Array.isArray(dailyCalorieSummaries)) {
    return [];
  }

  return dailyCalorieSummaries
      .map((dailySummary) => {
        return dailySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.FOOD_LOG_DATE];
      })
      .filter(isValidLogDateString);
}

async function buildFoodConsumptionReview({
  foodConsumptionEntries,
  dailyCalorieSummaries,
  dailyCaloriesRequired,
  averageSummary,
}) {
  if (
    !Array.isArray(foodConsumptionEntries) ||
    foodConsumptionEntries.length === 0
  ) {
    return {
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS.ASSESSMENT]:
        "No successful food consumption entries were available for this analysis period.",
      [USER_ANALYSIS_FOOD_CONSUMPTION_REVIEW_FIELDS.SUGGESTED_IMPROVEMENTS]: [
        "Collect more meal logs before drawing eating-habit conclusions.",
      ],
    };
  }

  const geminiFoodConsumptionReviewer = getGeminiFoodConsumptionReviewer();

  return geminiFoodConsumptionReviewer.reviewFoodConsumption({
    foodConsumptionEntries,
    dailyCalorieSummaries,
    dailyCaloriesRequired,
    dailyAverageCaloriesConsumed:
      averageSummary[
        USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED
      ],
    dailyAverageCalorieDifference:
      averageSummary[
        USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE
      ],
  });
}

function mapFoodConsumptionEntryForReview(foodLogData) {
  if (
    foodLogData?.[FOOD_LOG_FIELDS.PROCESSING_STATUS] !==
    FOOD_LOG_PROCESSING_STATUS.SUCCESS
  ) {
    return null;
  }

  const foodDescription = foodLogData[FOOD_LOG_FIELDS.FOOD_DESCRIPTION] || {};
  const calorieCalculated =
    foodLogData[FOOD_LOG_FIELDS.CALORIE_CALCULATED] || {};
  const foodItems = getFoodAnalysisItems(foodDescription);
  const calorieItems = getFoodAnalysisItems(calorieCalculated);
  const maxItemCount = Math.max(foodItems.length, calorieItems.length);
  const items = Array.from({length: maxItemCount}, (_, index) => {
    return mapFoodConsumptionItemForReview({
      foodItem: foodItems[index] || {},
      calorieItem: calorieItems[index] || {},
    });
  }).filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return {
    [FOOD_LOG_FIELDS.LOG_DATE]:
      safeString(foodLogData[FOOD_LOG_FIELDS.LOG_DATE]),
    [FOOD_LOG_FIELDS.LOG_TIME]:
      safeString(foodLogData[FOOD_LOG_FIELDS.LOG_TIME]),
    [FOOD_LOG_FIELDS.GMT]: safeString(foodLogData[FOOD_LOG_FIELDS.GMT]),
    [FOOD_ANALYSIS_FIELDS.ITEMS]: items,
    [FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES]:
      toNullableNonNegativeNumber(
          calorieCalculated[FOOD_ANALYSIS_FIELDS.TOTAL_ESTIMATED_CALORIES]
      ),
  };
}

function getFoodAnalysisItems(foodAnalysisData) {
  if (!foodAnalysisData || typeof foodAnalysisData !== "object") {
    return [];
  }

  return Array.isArray(foodAnalysisData[FOOD_ANALYSIS_FIELDS.ITEMS]) ?
    foodAnalysisData[FOOD_ANALYSIS_FIELDS.ITEMS] :
    [];
}

function mapFoodConsumptionItemForReview({
  foodItem,
  calorieItem,
}) {
  const name = safeString(
      foodItem?.[FOOD_ITEM_FIELDS.NAME] ||
      calorieItem?.[FOOD_ITEM_FIELDS.NAME]
  );
  const quantityText = safeString(
      foodItem?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT] ||
      calorieItem?.[FOOD_ITEM_FIELDS.QUANTITY_TEXT]
  );

  if (!name && !quantityText) {
    return null;
  }

  return {
    [FOOD_ITEM_FIELDS.NAME]: name,
    [FOOD_ITEM_FIELDS.QUANTITY_TEXT]: quantityText,
    [FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]:
      toNullableNonNegativeNumber(
          foodItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS] ??
          calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_GRAMS]
      ),
    [FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]:
      toNullableNonNegativeNumber(
          calorieItem?.[FOOD_ITEM_FIELDS.ESTIMATED_CALORIES]
      ),
  };
}

function compareFoodConsumptionEntriesForReview(leftEntry, rightEntry) {
  const leftSortKey = [
    leftEntry[FOOD_LOG_FIELDS.LOG_DATE],
    leftEntry[FOOD_LOG_FIELDS.LOG_TIME],
  ].join(" ");
  const rightSortKey = [
    rightEntry[FOOD_LOG_FIELDS.LOG_DATE],
    rightEntry[FOOD_LOG_FIELDS.LOG_TIME],
  ].join(" ");

  return leftSortKey.localeCompare(rightSortKey);
}

function toNonNegativeNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function toNullableNonNegativeNumber(value) {
  const numberValue = toNullableFiniteNumber(value);

  if (numberValue === null || numberValue < 0) {
    return null;
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

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

module.exports = new UserAnalysisHandler();
module.exports.UserAnalysisHandler = UserAnalysisHandler;
