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
const userIdEl = document.getElementById("user-id");
const loadUserBtn = document.getElementById("load-user-btn");
const fillSampleBtn = document.getElementById("fill-sample-btn");
const formEl = document.getElementById("edit-profile-form");
const saveBtn = document.getElementById("save-btn");
const outputEl = document.getElementById("output");

const userPhoneEl = document.getElementById("user-phone");
const userDobEl = document.getElementById("user-dob");
const userGenderEl = document.getElementById("user-gender");
const userGmtEl = document.getElementById("user-gmt");

const nameEl = document.getElementById("name");
const weightKgEl = document.getElementById("weightKg");
const stepsPerDayEl = document.getElementById("stepsPerDay");
const bodyFatPercentageEl = document.getElementById("bodyFatPercentage");
const exerciseFrequencyPerWeekEl = document.getElementById("exerciseFrequencyPerWeek");
const exerciseDurationMinutesEl = document.getElementById("exerciseDurationMinutes");
const exerciseIntensityEl = document.getElementById("exerciseIntensity");

let loadedUser = null;

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

function setOutput(data) {
  if (!outputEl) {
    return;
  }

  outputEl.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
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
    if (element.id !== "user-id") {
      element.disabled = !enabled;
    }
  });

  if (saveBtn) {
    saveBtn.disabled = !enabled;
  }
}

function getUserIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("userId")?.trim() ?? "";
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
}

function populateUserHeader(user) {
  setTextSafely(userPhoneEl, user?.[USER_FIELDS.PHONE_NUMBER] ?? "-");
  setTextSafely(userDobEl, user?.[USER_FIELDS.DOB] ?? "-");
  setTextSafely(userGenderEl, user?.[USER_FIELDS.GENDER] ?? "-");
  setTextSafely(userGmtEl, user?.[USER_FIELDS.GMT] ?? "-");
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

async function loadUserByUrlId() {
  const userId = userIdEl?.value?.trim() ?? "";

  if (!userId) {
    loadedUser = null;
    clearUserHeader();
    clearForm();
    setFormEnabled(false);
    setStatus("⚠️ Missing userId in URL. Open this page with ?userId=USER_DOCUMENT_ID");
    setOutput({
      success: false,
      error: "Missing userId in URL query string."
    });
    return;
  }

  try {
    setStatus("Loading user...");
    setOutput("Loading user document...");
    setFormEnabled(false);

    const user = await getUserById(userId);

    if (!user) {
      loadedUser = null;
      clearUserHeader();
      clearForm();
      setStatus("⚠️ User not found.");
      setOutput({
        success: false,
        error: "User not found."
      });
      return;
    }

    loadedUser = user;
    populateUserHeader(user);
    populateForm(user);
    setFormEnabled(true);
    setStatus("✅ User loaded from URL. You can now edit the allowed fields.");
    setOutput({
      success: true,
      message: "User loaded successfully.",
      user
    });
  } catch (error) {
    console.error("[EditProfile] loadUserByUrlId error:", error);
    loadedUser = null;
    clearUserHeader();
    clearForm();
    setFormEnabled(false);
    setStatus("❌ Failed to load user.");
    setOutput({
      success: false,
      error: error.message
    });
  }
}

function fillSampleData() {
  setValueSafely(nameEl, "John Doe");
  setValueSafely(weightKgEl, "71.5");
  setValueSafely(stepsPerDayEl, "8500");
  setValueSafely(bodyFatPercentageEl, "");
  setValueSafely(exerciseFrequencyPerWeekEl, "4");
  setValueSafely(exerciseDurationMinutesEl, "45");
  setValueSafely(exerciseIntensityEl, "moderate");
}

async function handleSubmit(event) {
  event.preventDefault();

  const userId = userIdEl?.value?.trim() ?? "";

  if (!userId) {
    setOutput("Missing userId in URL.");
    return;
  }

  try {
    setStatus("Saving profile update...");
    setOutput("Saving profile fields and snapshot...");

    if (saveBtn) {
      saveBtn.disabled = true;
    }

    const result = await updateUserProfileMetrics(userId, getFormData());

    if (!result.success) {
      setStatus("⚠️ Update failed.");
      setOutput(result);
      return;
    }

    loadedUser = result.user ?? loadedUser;

    if (loadedUser) {
      populateUserHeader(loadedUser);
      populateForm(loadedUser);
    }

    setStatus("✅ Profile updated and snapshot saved.");
    setOutput(result);
  } catch (error) {
    console.error("[EditProfile] handleSubmit error:", error);
    setStatus("❌ Failed to update profile.");
    setOutput({
      success: false,
      error: error.message
    });
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

    if (userIdEl) {
      userIdEl.value = userIdFromUrl;
    }

    if (!userIdFromUrl) {
      if (loadUserBtn) {
        loadUserBtn.disabled = true;
      }

      setStatus("⚠️ Missing userId in URL. Open this page with ?userId=USER_DOCUMENT_ID");
      setOutput("Example: /pages/edit_profile/edit_profile.html?userId=abc123");
      return;
    }

    if (loadUserBtn) {
      loadUserBtn.disabled = false;
    }

    await loadUserByUrlId();
  } catch (error) {
    console.error("[EditProfile] Initialization error:", error);
    setStatus("❌ Initialization failed.");
    setOutput({
      success: false,
      error: error.message
    });
  }
}

if (loadUserBtn) {
  loadUserBtn.addEventListener("click", loadUserByUrlId);
}

if (fillSampleBtn) {
  fillSampleBtn.addEventListener("click", fillSampleData);
}

if (formEl) {
  formEl.addEventListener("submit", handleSubmit);
}

initializePage();