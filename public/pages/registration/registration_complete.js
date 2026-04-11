// public/pages/registration/registration_complete.js

import {
  initUserHandler,
  getUserById
} from "/handlers/user_handler.js";

import {
  USER_FIELDS
} from "/config/firebase/firebase_user_schema.js";

const appStatusEl = document.getElementById("app-status");
const userNameEl = document.getElementById("user-name");
const dailyCaloriesEl = document.getElementById("daily-calories");
const debugOutputEl = document.getElementById("debug-output");

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

function getUrlParamsObject() {
  return Object.fromEntries(getUrlParams().entries());
}

function getUserIdFromUrl() {
  return getUrlParams().get("userId")?.trim() ?? "";
}

function getFallbackUserFromUrl() {
  const params = getUrlParams();

  return {
    [USER_FIELDS.NAME]: params.get("name")?.trim() ?? "",
    [USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]:
      params.get("totalCaloriesRequiredPerDay")?.trim() ?? ""
  };
}

function formatCaloriesPerDay(value) {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  const calories = Number(value);

  if (!Number.isFinite(calories)) {
    return "Unavailable";
  }

  return `${Math.round(calories)} kcal/day`;
}

function renderUser(user) {
  setText(userNameEl, user?.[USER_FIELDS.NAME] || "-");
  setText(
    dailyCaloriesEl,
    formatCaloriesPerDay(user?.[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY])
  );
}

function setDebugOutput(data) {
  if (!debugOutputEl) {
    return;
  }

  debugOutputEl.textContent = JSON.stringify(data, null, 2);
}

async function initializePage() {
  try {
    initUserHandler();

    const userId = getUserIdFromUrl();
    const fallbackUser = getFallbackUserFromUrl();
    const debugBase = {
      href: window.location.href,
      search: window.location.search,
      params: getUrlParamsObject(),
      userId,
      fallbackUser,
      userFields: {
        name: USER_FIELDS.NAME,
        totalCaloriesRequiredPerDay:
          USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY
      }
    };

    if (!userId) {
      setText(appStatusEl, "You can now start tracking your meals.");
      renderUser(fallbackUser);
      setDebugOutput({
        ...debugBase,
        stage: "missing_user_id",
        renderedUser: fallbackUser
      });
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      setText(appStatusEl, "You can now start tracking your meals.");
      renderUser(fallbackUser);
      setDebugOutput({
        ...debugBase,
        stage: "user_not_found",
        loadedUser: null,
        renderedUser: fallbackUser
      });
      return;
    }

    renderUser(user);
    setText(appStatusEl, "You can now start tracking your meals.");
    setDebugOutput({
      ...debugBase,
      stage: "user_loaded",
      loadedUser: user,
      renderedUser: {
        [USER_FIELDS.NAME]: user?.[USER_FIELDS.NAME] || "-",
        [USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY]:
          user?.[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? null
      }
    });
  } catch (error) {
    console.error("[RegistrationComplete] Initialization error:", error);
    setText(appStatusEl, "Could not load registration details.");
    const fallbackUser = getFallbackUserFromUrl();

    renderUser(fallbackUser);
    setDebugOutput({
      href: window.location.href,
      search: window.location.search,
      params: getUrlParamsObject(),
      userId: getUserIdFromUrl(),
      fallbackUser,
      stage: "error",
      error: {
        message: error.message,
        stack: error.stack
      },
      renderedUser: fallbackUser
    });
  }
}

initializePage();
