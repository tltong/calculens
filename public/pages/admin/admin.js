// public/pages/admin/admin.js

import {
  initUserHandler,
  getRegisteredUsers
} from "/handlers/user_handler.js";

import {
  USER_FIELDS
} from "/config/firebase/firebase_user_schema.js";

const EDIT_PROFILE_PAGE_PATH = "/pages/edit_profile/edit_profile.html";

const appStatusEl = document.getElementById("app-status");
const usersSummaryEl = document.getElementById("users-summary");
const refreshUsersBtn = document.getElementById("refresh-users-btn");
const usersTableWrapEl = document.getElementById("users-table-wrap");
const usersTableBodyEl = document.getElementById("users-table-body");
const emptyStateEl = document.getElementById("empty-state");

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
  const editLink = document.createElement("a");

  editLink.className = "button-link";
  editLink.href = buildEditProfileUrl(user.id);
  editLink.textContent = "Edit Profile";

  cell.appendChild(editLink);
  row.appendChild(cell);
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

initializePage();
