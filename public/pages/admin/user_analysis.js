// public/pages/admin/user_analysis.js

import {
  initUserHandler,
  getUserById
} from "/handlers/user_handler.js";

import {
  USER_COLLECTION,
  USER_FIELDS
} from "/config/firebase/firebase_user_schema.js";

import {
  USER_ANALYSIS_SUBCOLLECTIONS,
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_DAILY_RESULT_FIELDS,
  USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_PAGE_QUERY_PARAMS
} from "/config/firebase/user_analysis_schema.js";

import {
  getSubcollectionDocument,
  listenToSubcollectionDocument
} from "/utils/firebase/firebase_ops.js";

const pageSummaryEl = document.getElementById("page-summary");
const appStatusEl = document.getElementById("app-status");
const refreshAnalysisBtn = document.getElementById("refresh-analysis-btn");

const dailyCaloriesTableBodyEl =
  document.getElementById("daily-calories-table-body");
const weightProjectionTableBodyEl =
  document.getElementById("weight-projection-table-body");

const dailyCaloriesRequiredEl = document.getElementById("daily-calories-required");
const intakeDailyAverageConsumedEl =
  document.getElementById("intake-daily-average-consumed");
const dailySurplusDeficitEl = document.getElementById("daily-surplus-deficit");
const currentWeightEl = document.getElementById("current-weight");
const analysisErrorEl = document.getElementById("analysis-error");

let unsubscribeAnalysisRun = null;

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setStatus(message) {
  setText(appStatusEl, message);
}

function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name)?.trim() ?? "";
}

function getUserIdFromUrl() {
  return getUrlParam(USER_ANALYSIS_PAGE_QUERY_PARAMS.USER_ID);
}

function getAnalysisRunIdFromUrl() {
  return getUrlParam(USER_ANALYSIS_PAGE_QUERY_PARAMS.ANALYSIS_RUN_ID);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return `${Math.round(numericValue)}${suffix}`;
}

function appendCell(row, text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;

  if (className) {
    cell.className = className;
  }

  row.appendChild(cell);
}

function renderUser(user) {
  setText(
    pageSummaryEl,
    user?.[USER_FIELDS.NAME]
      ? `Food summary result for ${user[USER_FIELDS.NAME]}`
      : "Food summary result"
  );
}

function clearResult() {
  setText(dailyCaloriesRequiredEl, "-");
  setText(intakeDailyAverageConsumedEl, "-");
  setText(dailySurplusDeficitEl, "-");
  setText(currentWeightEl, "-");

  if (dailyCaloriesTableBodyEl) {
    dailyCaloriesTableBodyEl.replaceChildren();
  }

  if (weightProjectionTableBodyEl) {
    weightProjectionTableBodyEl.replaceChildren();
  }
}

function renderAnalysisError(analysisRun) {
  const error = analysisRun?.[USER_ANALYSIS_FIELDS.ERROR] || {};
  const message = error[USER_ANALYSIS_ERROR_FIELDS.MESSAGE] || "";

  if (!analysisErrorEl) {
    return;
  }

  if (!message) {
    analysisErrorEl.textContent = "";
    analysisErrorEl.style.display = "none";
    return;
  }

  analysisErrorEl.textContent = message;
  analysisErrorEl.style.display = "block";
}

function renderDailyCaloriesSummary(analysisRun) {
  const result = analysisRun?.[USER_ANALYSIS_FIELDS.RESULT] || {};
  const dailySummaries = Array.isArray(
    result[USER_ANALYSIS_RESULT_FIELDS.DAILY_CALORIE_SUMMARIES]
  )
    ? result[USER_ANALYSIS_RESULT_FIELDS.DAILY_CALORIE_SUMMARIES]
    : [];

  if (!dailyCaloriesTableBodyEl) {
    return;
  }

  dailyCaloriesTableBodyEl.replaceChildren();

  if (dailySummaries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No daily calorie data found.";
    row.appendChild(cell);
    dailyCaloriesTableBodyEl.appendChild(row);
    return;
  }

  dailySummaries.forEach((dailySummary) => {
    const hasData =
      dailySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.HAS_DATA] === true;
    const dailyCalorieDifference = toFiniteNumber(
      dailySummary[
        USER_ANALYSIS_DAILY_RESULT_FIELDS.CALORIE_DIFFERENCE
      ]
    );
    const row = document.createElement("tr");

    appendCell(
      row,
      formatValue(dailySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.FOOD_LOG_DATE])
    );
    appendCell(
      row,
      hasData
        ? formatNumber(
            dailySummary[
              USER_ANALYSIS_DAILY_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED
            ],
            " kcal"
          )
        : "-"
    );
    appendCell(
      row,
      hasData
        ? formatCalorieDifference(dailyCalorieDifference)
        : "-"
    );
    appendCell(
      row,
      hasData
        ? formatNumber(
            dailySummary[USER_ANALYSIS_DAILY_RESULT_FIELDS.PHOTO_COUNT]
          )
        : "-"
    );
    appendCell(row, hasData ? "Yes" : "No data");

    dailyCaloriesTableBodyEl.appendChild(row);
  });
}

function renderCalorieIntake(analysisRun) {
  const result = analysisRun?.[USER_ANALYSIS_FIELDS.RESULT] || {};
  const dailyCaloriesRequired = toFiniteNumber(
    result[USER_ANALYSIS_RESULT_FIELDS.DAILY_CALORIES_REQUIRED]
  );
  const dailyAverageConsumed = toFiniteNumber(
    result[USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIES_CONSUMED]
  );
  const dailyAverageCalorieDifference = toFiniteNumber(
    result[USER_ANALYSIS_RESULT_FIELDS.DAILY_AVERAGE_CALORIE_DIFFERENCE]
  );

  setText(
    dailyCaloriesRequiredEl,
    formatNumber(dailyCaloriesRequired, " kcal")
  );
  setText(
    intakeDailyAverageConsumedEl,
    formatNumber(dailyAverageConsumed, " kcal")
  );
  setText(
    dailySurplusDeficitEl,
    formatCalorieDifference(dailyAverageCalorieDifference)
  );
}

function renderWeightChangeProjections(analysisRun) {
  const result = analysisRun?.[USER_ANALYSIS_FIELDS.RESULT] || {};
  const currentWeightKg = toFiniteNumber(
    result[USER_ANALYSIS_RESULT_FIELDS.CURRENT_WEIGHT_KG]
  );
  const projections = Array.isArray(
    result[USER_ANALYSIS_RESULT_FIELDS.WEIGHT_CHANGE_PROJECTIONS]
  )
    ? result[USER_ANALYSIS_RESULT_FIELDS.WEIGHT_CHANGE_PROJECTIONS]
    : [];

  setText(currentWeightEl, formatWeightKg(currentWeightKg));

  if (!weightProjectionTableBodyEl) {
    return;
  }

  weightProjectionTableBodyEl.replaceChildren();

  if (projections.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No weight change projection available.";
    row.appendChild(cell);
    weightProjectionTableBodyEl.appendChild(row);
    return;
  }

  projections.forEach((projection) => {
    const row = document.createElement("tr");

    appendCell(
      row,
      formatValue(
        projection[USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PERIOD_LABEL]
      )
    );
    appendCell(
      row,
      formatWeightChangeKg(
        projection[
          USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PROJECTED_WEIGHT_CHANGE_KG
        ]
      )
    );
    appendCell(
      row,
      formatWeightKg(
        projection[
          USER_ANALYSIS_WEIGHT_PROJECTION_FIELDS.PROJECTED_WEIGHT_KG
        ]
      )
    );

    weightProjectionTableBodyEl.appendChild(row);
  });
}

function formatCalorieDifference(calorieDifference) {
  if (calorieDifference === null) {
    return "-";
  }

  const difference = Number(calorieDifference);

  if (!Number.isFinite(difference)) {
    return "-";
  }

  if (difference > 0) {
    return `${Math.round(difference)} kcal surplus`;
  }

  if (difference < 0) {
    return `${Math.round(Math.abs(difference))} kcal deficit`;
  }

  return "Balanced";
}

function formatWeightChangeKg(value) {
  const weightChangeKg = toFiniteNumber(value);

  if (weightChangeKg === null) {
    return "-";
  }

  const roundedWeightChangeKg = Math.abs(weightChangeKg).toFixed(1);

  if (weightChangeKg > 0) {
    return `+${roundedWeightChangeKg} kg`;
  }

  if (weightChangeKg < 0) {
    return `-${roundedWeightChangeKg} kg`;
  }

  return "0.0 kg";
}

function formatWeightKg(value) {
  const weightKg = toFiniteNumber(value);

  if (weightKg === null) {
    return "-";
  }

  return `${weightKg.toFixed(1)} kg`;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function renderAnalysisRun(analysisRun) {
  if (!analysisRun) {
    setStatus("Analysis run not found.");
    clearResult();
    return;
  }

  const status = analysisRun[USER_ANALYSIS_FIELDS.STATUS];

  if (status === USER_ANALYSIS_STATUSES.COMPLETED) {
    renderDailyCaloriesSummary(analysisRun);
    renderCalorieIntake(analysisRun);
    renderWeightChangeProjections(analysisRun);
    setStatus("Analysis complete.");
  } else {
    clearResult();
    setStatus(`Analysis status: ${formatValue(status)}.`);
  }

  renderAnalysisError(analysisRun);
}

async function refreshAnalysisRun() {
  const userId = getUserIdFromUrl();
  const analysisRunId = getAnalysisRunIdFromUrl();

  if (!userId || !analysisRunId) {
    setStatus("Missing analysis result URL parameters.");
    return;
  }

  try {
    setStatus("Refreshing analysis result...");

    const analysisRun = await getSubcollectionDocument(
      USER_COLLECTION,
      userId,
      USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS,
      analysisRunId
    );

    renderAnalysisRun(analysisRun);
  } catch (error) {
    console.error("[UserAnalysisResult] refreshAnalysisRun error:", error);
    setStatus(`Failed to refresh analysis result. ${error.message}`);
  }
}

function startAnalysisRunListener(userId, analysisRunId) {
  if (unsubscribeAnalysisRun) {
    unsubscribeAnalysisRun();
    unsubscribeAnalysisRun = null;
  }

  unsubscribeAnalysisRun = listenToSubcollectionDocument(
    USER_COLLECTION,
    userId,
    USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS,
    analysisRunId,
    renderAnalysisRun,
    (error) => {
      console.error("[UserAnalysisResult] analysis listener error:", error);
      setStatus(`Failed to listen for analysis result. ${error.message}`);
    }
  );
}

async function initializePage() {
  try {
    initUserHandler();
    clearResult();

    const userId = getUserIdFromUrl();
    const analysisRunId = getAnalysisRunIdFromUrl();

    if (!userId || !analysisRunId) {
      setStatus(
        "Missing URL parameters. Open this page from the completed admin analysis link."
      );
      return;
    }

    setStatus("Loading user...");

    const user = await getUserById(userId);

    if (!user) {
      renderUser(null);
      setStatus("User not found.");
      return;
    }

    renderUser(user);
    setStatus("Loading analysis result...");
    startAnalysisRunListener(userId, analysisRunId);
  } catch (error) {
    console.error("[UserAnalysisResult] initialization error:", error);
    setStatus(`Initialization failed. ${error.message}`);
  }
}

refreshAnalysisBtn?.addEventListener("click", refreshAnalysisRun);

window.addEventListener("beforeunload", () => {
  if (unsubscribeAnalysisRun) {
    unsubscribeAnalysisRun();
  }
});

initializePage();
