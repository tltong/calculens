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
  USER_ANALYSIS_PARAMETER_FIELDS,
  USER_ANALYSIS_RESULT_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_STATUSES
} from "/config/firebase/user_analysis_schema.js";

import {
  getSubcollectionDocument,
  listenToSubcollectionDocument
} from "/utils/firebase/firebase_ops.js";

const pageSummaryEl = document.getElementById("page-summary");
const appStatusEl = document.getElementById("app-status");
const refreshAnalysisBtn = document.getElementById("refresh-analysis-btn");

const userNameEl = document.getElementById("user-name");
const userPhoneEl = document.getElementById("user-phone");
const analysisStatusEl = document.getElementById("analysis-status");
const analysisCompletedAtEl = document.getElementById("analysis-completed-at");

const resultFoodLogDateEl = document.getElementById("result-food-log-date");
const resultPhotoCountEl = document.getElementById("result-photo-count");
const resultCountedPhotoCountEl =
  document.getElementById("result-counted-photo-count");
const resultSkippedPhotoCountEl =
  document.getElementById("result-skipped-photo-count");
const resultTotalCaloriesEl = document.getElementById("result-total-calories");

const analysisRunIdEl = document.getElementById("analysis-run-id");
const analysisTypeEl = document.getElementById("analysis-type");
const analysisRequestedAtEl = document.getElementById("analysis-requested-at");
const analysisStartedAtEl = document.getElementById("analysis-started-at");
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
  return getUrlParam("userId");
}

function getAnalysisRunIdFromUrl() {
  return getUrlParam("analysisRunId");
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

function formatTimestamp(value) {
  const date = toDate(value);

  if (!date) {
    return "-";
  }

  return date.toLocaleString();
}

function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (Number.isFinite(Number(value?.seconds))) {
    const milliseconds =
      Number(value.seconds) * 1000 +
      Math.floor(Number(value.nanoseconds || 0) / 1000000);
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function getAnalysisRunLogDate(analysisRun) {
  const result = analysisRun?.[USER_ANALYSIS_FIELDS.RESULT] || {};
  const parameters = analysisRun?.[USER_ANALYSIS_FIELDS.PARAMETERS] || {};

  return (
    result[USER_ANALYSIS_RESULT_FIELDS.FOOD_LOG_DATE] ||
    parameters[USER_ANALYSIS_PARAMETER_FIELDS.LOG_DATE] ||
    "-"
  );
}

function getAnalysisRunResultValue(analysisRun, fieldName) {
  const result = analysisRun?.[USER_ANALYSIS_FIELDS.RESULT] || {};
  return result[fieldName];
}

function renderUser(user) {
  setText(userNameEl, formatValue(user?.[USER_FIELDS.NAME]));
  setText(userPhoneEl, formatValue(user?.[USER_FIELDS.PHONE_NUMBER]));

  setText(
    pageSummaryEl,
    user?.[USER_FIELDS.NAME]
      ? `Food summary result for ${user[USER_FIELDS.NAME]}`
      : "Food summary result"
  );
}

function clearResult() {
  setText(resultFoodLogDateEl, "-");
  setText(resultPhotoCountEl, "-");
  setText(resultCountedPhotoCountEl, "-");
  setText(resultSkippedPhotoCountEl, "-");
  setText(resultTotalCaloriesEl, "-");
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

function renderAnalysisRun(analysisRun) {
  const analysisRunId = getAnalysisRunIdFromUrl();

  if (!analysisRun) {
    setStatus("Analysis run not found.");
    setText(analysisStatusEl, "-");
    clearResult();
    return;
  }

  const status = analysisRun[USER_ANALYSIS_FIELDS.STATUS];

  setText(analysisRunIdEl, analysisRunId);
  setText(analysisTypeEl, formatValue(analysisRun[USER_ANALYSIS_FIELDS.TYPE]));
  setText(analysisStatusEl, formatValue(status));
  setText(
    analysisRequestedAtEl,
    formatTimestamp(analysisRun[USER_ANALYSIS_FIELDS.REQUESTED_AT])
  );
  setText(
    analysisStartedAtEl,
    formatTimestamp(analysisRun[USER_ANALYSIS_FIELDS.STARTED_AT])
  );
  setText(
    analysisCompletedAtEl,
    formatTimestamp(analysisRun[USER_ANALYSIS_FIELDS.COMPLETED_AT])
  );

  if (status === USER_ANALYSIS_STATUSES.COMPLETED) {
    setText(resultFoodLogDateEl, getAnalysisRunLogDate(analysisRun));
    setText(
      resultPhotoCountEl,
      formatNumber(
        getAnalysisRunResultValue(
          analysisRun,
          USER_ANALYSIS_RESULT_FIELDS.PHOTO_COUNT
        )
      )
    );
    setText(
      resultCountedPhotoCountEl,
      formatNumber(
        getAnalysisRunResultValue(
          analysisRun,
          USER_ANALYSIS_RESULT_FIELDS.COUNTED_PHOTO_COUNT
        )
      )
    );
    setText(
      resultSkippedPhotoCountEl,
      formatNumber(
        getAnalysisRunResultValue(
          analysisRun,
          USER_ANALYSIS_RESULT_FIELDS.SKIPPED_PHOTO_COUNT
        )
      )
    );
    setText(
      resultTotalCaloriesEl,
      formatNumber(
        getAnalysisRunResultValue(
          analysisRun,
          USER_ANALYSIS_RESULT_FIELDS.TOTAL_CALORIES_CONSUMED
        ),
        " kcal"
      )
    );
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
    setStatus("Missing userId or analysisRunId in URL.");
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
        "Missing URL parameters. Open this page with ?userId=USER_DOCUMENT_ID&analysisRunId=ANALYSIS_RUN_ID"
      );
      return;
    }

    setText(analysisRunIdEl, analysisRunId);
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
