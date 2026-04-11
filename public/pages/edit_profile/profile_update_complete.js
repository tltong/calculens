// public/pages/edit_profile/profile_update_complete.js

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

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function getUrlParams() {
  return new URLSearchParams(window.location.search);
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

async function initializePage() {
  try {
    initUserHandler();

    const userId = getUserIdFromUrl();
    const fallbackUser = getFallbackUserFromUrl();

    if (!userId) {
      setText(appStatusEl, "Your profile update is complete.");
      renderUser(fallbackUser);
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      setText(appStatusEl, "Your profile update is complete.");
      renderUser(fallbackUser);
      return;
    }

    renderUser(user);
    setText(appStatusEl, "Your profile update is complete.");
  } catch (error) {
    console.error("[ProfileUpdateComplete] Initialization error:", error);
    setText(appStatusEl, "Could not load profile details.");
    renderUser(getFallbackUserFromUrl());
  }
}

initializePage();
