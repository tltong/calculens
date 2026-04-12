// public/pages/admin/admin.js

import {
  initUserHandler,
  getRegisteredUsers
} from "/handlers/user_handler.js";

import {
  USER_COLLECTION,
  USER_FIELDS
} from "/config/firebase/firebase_user_schema.js";

import {
  USER_ANALYSIS_SUBCOLLECTIONS,
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_PAGE_QUERY_PARAMS,
  buildFoodSummaryAnalysisRunData
} from "/config/firebase/user_analysis_schema.js";

import {
  addSubcollectionDocument,
  listenToSubcollectionDocument
} from "/utils/firebase/firebase_ops.js";

const EDIT_PROFILE_PAGE_PATH = "/pages/edit_profile/edit_profile.html";
const USER_ANALYSIS_PAGE_PATH = "/pages/admin/user_analysis.html";

const appStatusEl = document.getElementById("app-status");
const usersSummaryEl = document.getElementById("users-summary");
const refreshUsersBtn = document.getElementById("refresh-users-btn");
const usersTableWrapEl = document.getElementById("users-table-wrap");
const usersTableBodyEl = document.getElementById("users-table-body");
const emptyStateEl = document.getElementById("empty-state");

const analysisRunListeners = new Map();

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setStatus(message) {
  setText(appStatusEl, message);
}

function setLoading(isLoading) {
  if (refreshUsersBtn) {
    refreshUsersBtn.disabled = isLoading;
    refreshUsersBtn.textContent = isLoading ? "Refreshing..." : "Refresh";
  }
}

function setVisible(element, isVisible) {
  if (!element) {
    return;
  }

  element.classList.toggle("hidden", !isVisible);
}

function clearAnalysisRunListeners() {
  analysisRunListeners.forEach((unsubscribe) => unsubscribe());
  analysisRunListeners.clear();
}

function clearAnalysisRunListenersForUser(userId) {
  analysisRunListeners.forEach((unsubscribe, listenerKey) => {
    if (listenerKey.startsWith(`${userId}:`)) {
      unsubscribe();
      analysisRunListeners.delete(listenerKey);
    }
  });
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

  return `${numericValue}${suffix}`;
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function buildEditProfileUrl(userId) {
  const editProfileUrl = new URL(EDIT_PROFILE_PAGE_PATH, window.location.origin);
  editProfileUrl.searchParams.set("userId", userId);

  return editProfileUrl.toString();
}

function buildUserAnalysisUrl(userId, analysisRunId) {
  const userAnalysisUrl = new URL(USER_ANALYSIS_PAGE_PATH, window.location.origin);
  userAnalysisUrl.searchParams.set(
    USER_ANALYSIS_PAGE_QUERY_PARAMS.USER_ID,
    userId
  );
  userAnalysisUrl.searchParams.set(
    USER_ANALYSIS_PAGE_QUERY_PARAMS.ANALYSIS_RUN_ID,
    analysisRunId
  );

  return userAnalysisUrl.toString();
}

function appendCell(row, text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;

  if (className) {
    cell.className = className;
  }

  row.appendChild(cell);

  return cell;
}

function appendActionCell(row, user) {
  const cell = document.createElement("td");
  const actionsWrap = document.createElement("div");
  const editLink = document.createElement("a");
  const runAnalysisBtn = document.createElement("button");
  const analysisStatus = document.createElement("span");
  const resultLink = document.createElement("a");

  actionsWrap.className = "row-actions";

  editLink.className = "button-link";
  editLink.href = buildEditProfileUrl(user.id);
  editLink.textContent = "Edit Profile";

  runAnalysisBtn.type = "button";
  runAnalysisBtn.className = "secondary";
  runAnalysisBtn.textContent = "Run Analysis";

  analysisStatus.className = "analysis-status";
  analysisStatus.textContent = "Not run";

  resultLink.className = "button-link secondary hidden";
  resultLink.textContent = "View Result";

  actionsWrap.appendChild(editLink);
  actionsWrap.appendChild(runAnalysisBtn);
  actionsWrap.appendChild(analysisStatus);
  actionsWrap.appendChild(resultLink);
  cell.appendChild(actionsWrap);
  row.appendChild(cell);

  runAnalysisBtn.addEventListener("click", () => {
    runUserAnalysis({
      user,
      runAnalysisBtn,
      analysisStatus,
      resultLink
    });
  });
}

function handleAnalysisRunUpdate({
  user,
  analysisRun,
  runAnalysisBtn,
  analysisStatus,
  resultLink
}) {
  if (!analysisRun) {
    runAnalysisBtn.disabled = false;
    analysisStatus.textContent = "Not found";
    setVisible(resultLink, false);
    return;
  }

  const status = analysisRun[USER_ANALYSIS_FIELDS.STATUS];
  analysisStatus.textContent = formatValue(status);

  if (
    status === USER_ANALYSIS_STATUSES.QUEUED ||
    status === USER_ANALYSIS_STATUSES.PROCESSING
  ) {
    runAnalysisBtn.disabled = true;
    setVisible(resultLink, false);
    return;
  }

  runAnalysisBtn.disabled = false;

  if (status === USER_ANALYSIS_STATUSES.COMPLETED) {
    resultLink.href = buildUserAnalysisUrl(user.id, analysisRun.id);
    setVisible(resultLink, true);
    return;
  }

  if (status === USER_ANALYSIS_STATUSES.FAILED) {
    const error = analysisRun[USER_ANALYSIS_FIELDS.ERROR] || {};
    analysisStatus.textContent =
      error[USER_ANALYSIS_ERROR_FIELDS.MESSAGE] || "Failed";
  }

  setVisible(resultLink, false);
}

async function runUserAnalysis({
  user,
  runAnalysisBtn,
  analysisStatus,
  resultLink
}) {
  try {
    clearAnalysisRunListenersForUser(user.id);
    runAnalysisBtn.disabled = true;
    analysisStatus.textContent = "Queueing";
    setVisible(resultLink, false);

    const analysisRunId = await addSubcollectionDocument(
      USER_COLLECTION,
      user.id,
      USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS,
      buildFoodSummaryAnalysisRunData()
    );

    analysisStatus.textContent = "Queued";
    setStatus(`Analysis queued for ${formatValue(user[USER_FIELDS.NAME])}.`);

    const listenerKey = `${user.id}:${analysisRunId}`;
    const unsubscribe = listenToSubcollectionDocument(
      USER_COLLECTION,
      user.id,
      USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS,
      analysisRunId,
      (analysisRun) => {
        handleAnalysisRunUpdate({
          user,
          analysisRun,
          runAnalysisBtn,
          analysisStatus,
          resultLink
        });
      },
      (error) => {
        console.error("[AdminUsers] analysis listener error:", error);
        runAnalysisBtn.disabled = false;
        analysisStatus.textContent = "Failed";
        setVisible(resultLink, false);
      }
    );

    analysisRunListeners.set(listenerKey, unsubscribe);
  } catch (error) {
    console.error("[AdminUsers] runUserAnalysis error:", error);
    runAnalysisBtn.disabled = false;
    analysisStatus.textContent = "Failed";
    setVisible(resultLink, false);
    setStatus(`Failed to queue analysis. ${error.message}`);
  }
}

function renderUserRow(user) {
  const row = document.createElement("tr");

  appendCell(row, formatValue(user[USER_FIELDS.NAME]), "user-name");
  appendCell(row, formatValue(user[USER_FIELDS.PHONE_NUMBER]), "nowrap");
  appendCell(row, formatValue(user[USER_FIELDS.GENDER]));
  appendCell(row, formatValue(user[USER_FIELDS.GMT]), "nowrap");
  appendCell(row, formatNumber(user[USER_FIELDS.WEIGHT_KG], " kg"), "nowrap");
  appendCell(
    row,
    formatNumber(user[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY], " kcal"),
    "nowrap"
  );
  appendCell(row, formatTimestamp(user[USER_FIELDS.UPDATED_AT]), "muted nowrap");
  appendActionCell(row, user);

  return row;
}

function renderUsers(users) {
  if (!usersTableBodyEl) {
    return;
  }

  clearAnalysisRunListeners();
  usersTableBodyEl.replaceChildren();

  users.forEach((user) => {
    usersTableBodyEl.appendChild(renderUserRow(user));
  });

  const hasUsers = users.length > 0;
  setVisible(usersTableWrapEl, hasUsers);

  if (emptyStateEl) {
    emptyStateEl.style.display = hasUsers ? "none" : "block";
  }

  setText(
    usersSummaryEl,
    hasUsers
      ? `${users.length} registered user${users.length === 1 ? "" : "s"}`
      : "No registered users yet."
  );
}

async function loadRegisteredUsers() {
  try {
    setLoading(true);
    setStatus("Loading registered users...");

    const users = await getRegisteredUsers();
    renderUsers(users);
    setStatus("Ready.");
  } catch (error) {
    console.error("[AdminUsers] loadRegisteredUsers error:", error);
    renderUsers([]);
    setStatus(`Failed to load registered users. ${error.message}`);
  } finally {
    setLoading(false);
  }
}

async function initializePage() {
  try {
    initUserHandler();
    await loadRegisteredUsers();
  } catch (error) {
    console.error("[AdminUsers] initialization error:", error);
    setStatus(`Initialization failed. ${error.message}`);
    setLoading(false);
  }
}

refreshUsersBtn?.addEventListener("click", loadRegisteredUsers);

window.addEventListener("beforeunload", clearAnalysisRunListeners);

initializePage();
