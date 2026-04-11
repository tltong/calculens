// public/pages/edit_profile/edit_profile.js

import {
  initUserHandler,
  getUserById,
  updateUserProfileMetrics
} from "/handlers/user_handler.js";

import {
  USER_FIELDS,
  EXERCISE_FREQUENCY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS
} from "/config/firebase/firebase_user_schema.js";

const appStatusEl = document.getElementById("app-status");
const formEl = document.getElementById("edit-profile-form");
const saveBtn = document.getElementById("save-btn");

const userPhoneEl = document.getElementById("user-phone");
const userDobEl = document.getElementById("user-dob");
const userGenderEl = document.getElementById("user-gender");
const userGmtEl = document.getElementById("user-gmt");
const userHeightEl = document.getElementById("user-height");

const nameEl = document.getElementById("name");
const weightKgEl = document.getElementById("weightKg");
const stepsPerDayEl = document.getElementById("stepsPerDay");
const bodyFatPercentageEl = document.getElementById("bodyFatPercentage");
const exerciseFrequencyPerWeekEl = document.getElementById("exerciseFrequencyPerWeek");
const exerciseDurationMinutesEl = document.getElementById("exerciseDurationMinutes");
const exerciseIntensityEl = document.getElementById("exerciseIntensity");

let loadedUser = null;

const PROFILE_UPDATE_COMPLETE_PAGE_PATH =
  "/pages/edit_profile/profile_update_complete.html";

function setTextSafely(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setValueSafely(element, value) {
  if (element) {
    element.value = value;
  }
}

function setStatus(message) {
  if (!appStatusEl) {
    return;
  }

  appStatusEl.textContent = message;
}

function setFormEnabled(enabled) {
  if (!formEl) {
    return;
  }

  const elements = formEl.querySelectorAll("input, select, button");
  elements.forEach((element) => {
    element.disabled = !enabled;
  });

  if (saveBtn) {
    saveBtn.disabled = !enabled;
  }
}

function getUserIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("userId")?.trim() ?? "";
}

function getCurrentUserId() {
  return getUserIdFromUrl();
}

function formatHeightCm(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const heightCm = Number(value);

  if (!Number.isFinite(heightCm)) {
    return "-";
  }

  return `${heightCm} cm`;
}

function populateSelectOptions() {
  if (exerciseFrequencyPerWeekEl) {
    exerciseFrequencyPerWeekEl.innerHTML = `
      <option value="">Select frequency</option>
      ${EXERCISE_FREQUENCY_OPTIONS.map(
        (value) => `<option value="${value}">${value}</option>`
      ).join("")}
    `;
  }

  if (exerciseIntensityEl) {
    exerciseIntensityEl.innerHTML = `
      <option value="">Select intensity</option>
      ${EXERCISE_INTENSITY_OPTIONS.map(
        (value) => `<option value="${value}">${value}</option>`
      ).join("")}
    `;
  }
}

function clearUserHeader() {
  setTextSafely(userPhoneEl, "-");
  setTextSafely(userDobEl, "-");
  setTextSafely(userGenderEl, "-");
  setTextSafely(userGmtEl, "-");
  setTextSafely(userHeightEl, "-");
}

function populateUserHeader(user) {
  setTextSafely(userPhoneEl, user?.[USER_FIELDS.PHONE_NUMBER] ?? "-");
  setTextSafely(userDobEl, user?.[USER_FIELDS.DOB] ?? "-");
  setTextSafely(userGenderEl, user?.[USER_FIELDS.GENDER] ?? "-");
  setTextSafely(userGmtEl, user?.[USER_FIELDS.GMT] ?? "-");
  setTextSafely(userHeightEl, formatHeightCm(user?.[USER_FIELDS.HEIGHT_CM]));
}

function clearForm() {
  setValueSafely(nameEl, "");
  setValueSafely(weightKgEl, "");
  setValueSafely(stepsPerDayEl, "");
  setValueSafely(bodyFatPercentageEl, "");
  setValueSafely(exerciseFrequencyPerWeekEl, "");
  setValueSafely(exerciseDurationMinutesEl, "");
  setValueSafely(exerciseIntensityEl, "");
}

function populateForm(user) {
  setValueSafely(nameEl, user?.[USER_FIELDS.NAME] ?? "");
  setValueSafely(weightKgEl, user?.[USER_FIELDS.WEIGHT_KG] ?? "");
  setValueSafely(stepsPerDayEl, user?.[USER_FIELDS.STEPS_PER_DAY] ?? "");
  setValueSafely(
    bodyFatPercentageEl,
    user?.[USER_FIELDS.BODY_FAT_PERCENTAGE] ?? ""
  );
  setValueSafely(
    exerciseFrequencyPerWeekEl,
    user?.[USER_FIELDS.EXERCISE_FREQUENCY_PER_WEEK] ?? ""
  );
  setValueSafely(
    exerciseDurationMinutesEl,
    user?.[USER_FIELDS.EXERCISE_DURATION_MINUTES] ?? ""
  );
  setValueSafely(exerciseIntensityEl, user?.[USER_FIELDS.EXERCISE_INTENSITY] ?? "");
}

function getFormData() {
  return {
    name: nameEl?.value ?? "",
    weightKg: weightKgEl?.value ?? "",
    stepsPerDay: stepsPerDayEl?.value ?? "",
    bodyFatPercentage: bodyFatPercentageEl?.value ?? "",
    exerciseFrequencyPerWeek: exerciseFrequencyPerWeekEl?.value ?? "",
    exerciseDurationMinutes: exerciseDurationMinutesEl?.value ?? "",
    exerciseIntensity: exerciseIntensityEl?.value ?? ""
  };
}

function buildProfileUpdateCompletePageUrl({
  userId,
  user,
}) {
  const completePageUrl = new URL(
    PROFILE_UPDATE_COMPLETE_PAGE_PATH,
    window.location.origin
  );

  if (userId) {
    completePageUrl.searchParams.set("userId", userId);
  }

  if (user?.[USER_FIELDS.NAME]) {
    completePageUrl.searchParams.set("name", user[USER_FIELDS.NAME]);
  }

  if (user?.[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] !== undefined) {
    completePageUrl.searchParams.set(
      "totalCaloriesRequiredPerDay",
      String(user[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? "")
    );
  }

  return completePageUrl.toString();
}

function redirectToProfileUpdateCompletePage({ userId, user }) {
  window.location.replace(
    buildProfileUpdateCompletePageUrl({
      userId,
      user
    })
  );
}

async function loadUserByUrlId() {
  const userId = getCurrentUserId();

  if (!userId) {
    loadedUser = null;
    clearUserHeader();
    clearForm();
    setFormEnabled(false);
    setStatus("⚠️ Missing userId in URL. Open this page with ?userId=USER_DOCUMENT_ID");
    return;
  }

  try {
    setStatus("Loading user...");
    setFormEnabled(false);

    const user = await getUserById(userId);

    if (!user) {
      loadedUser = null;
      clearUserHeader();
      clearForm();
      setStatus("⚠️ User not found.");
      return;
    }

    loadedUser = user;
    populateUserHeader(user);
    populateForm(user);
    setFormEnabled(true);
    setStatus("✅ You can now edit the allowed fields.");
  } catch (error) {
    console.error("[EditProfile] loadUserByUrlId error:", error);
    loadedUser = null;
    clearUserHeader();
    clearForm();
    setFormEnabled(false);
    setStatus("❌ Failed to load user.");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (formEl && !formEl.reportValidity()) {
    return;
  }

  const userId = getCurrentUserId();

  if (!userId) {
    setStatus("Missing userId in URL.");
    return;
  }

  try {
    setStatus("Saving profile update...");

    if (saveBtn) {
      saveBtn.disabled = true;
    }

    const result = await updateUserProfileMetrics(userId, getFormData());

    if (!result.success) {
      setStatus("⚠️ Update failed.");
      return;
    }

    loadedUser = result.user ?? loadedUser;

    if (loadedUser) {
      populateUserHeader(loadedUser);
      populateForm(loadedUser);
    }

    setStatus("✅ Profile updated and snapshot saved.");
    setStatus("Profile updated. Redirecting...");
    redirectToProfileUpdateCompletePage({
      userId: result.userId || userId,
      user: loadedUser || result.data || {}
    });
  } catch (error) {
    console.error("[EditProfile] handleSubmit error:", error);
    setStatus("❌ Failed to update profile.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
    }
  }
}

async function initializePage() {
  try {
    initUserHandler();
    populateSelectOptions();
    clearUserHeader();
    clearForm();
    setFormEnabled(false);

    const userIdFromUrl = getUserIdFromUrl();

    if (!userIdFromUrl) {
      setStatus("⚠️ Missing userId in URL. Open this page with ?userId=USER_DOCUMENT_ID");
      return;
    }

    await loadUserByUrlId();
  } catch (error) {
    console.error("[EditProfile] Initialization error:", error);
    setStatus("❌ Initialization failed.");
  }
}

if (formEl) {
  formEl.addEventListener("submit", handleSubmit);
}

if (saveBtn) {
  saveBtn.addEventListener("click", handleSubmit);
}

initializePage();
