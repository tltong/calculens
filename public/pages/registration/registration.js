// public/pages/registration/registration.js

import {
  initUserHandler,
  registerUser
} from "/handlers/user_handler.js";

import {
  USER_FIELDS,
  GMT_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS
} from "/config/firebase/firebase_user_schema.js";

const appStatusEl = document.getElementById("app-status");
const formEl = document.getElementById("registration-form");
const debugOutputEl = document.getElementById("debug-output");

const gmtSelectEl = document.getElementById("gmt");
const phoneNumberEl = document.getElementById("phoneNumber");
const detectedLocationEl = document.getElementById("detected-location");
const phonePrefillNoteEl = document.getElementById("phone-prefill-note");

const exerciseFrequencyEl = document.getElementById("exerciseFrequencyPerWeek");
const exerciseDurationMinutesEl = document.getElementById("exerciseDurationMinutes");
const exerciseIntensityEl = document.getElementById("exerciseIntensity");

const REGISTRATION_COMPLETE_PAGE_PATH =
  "/pages/registration/registration_complete.html";

function setStatus(message) {
  if (!appStatusEl) {
    return;
  }

  appStatusEl.textContent = message;
}

function setDebugOutput(data) {
  if (!debugOutputEl) {
    return;
  }

  debugOutputEl.textContent = JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      ...data
    },
    null,
    2
  );
}

function setFormEnabled(enabled) {
  if (!formEl) {
    return;
  }

  const elements = formEl.querySelectorAll("input, select, button");

  elements.forEach((element) => {
    element.disabled = !enabled;
  });

  if (phoneNumberEl?.dataset?.locked === "true") {
    phoneNumberEl.disabled = false;
    phoneNumberEl.readOnly = true;
  }
}

function populateGmtOptions() {
  if (!gmtSelectEl) {
    return;
  }

  gmtSelectEl.innerHTML = `
    <option value="">Select GMT</option>
    ${GMT_OPTIONS.map(
      (value) => `<option value="${value}">${value}</option>`
    ).join("")}
  `;
}

function populateExerciseFrequencyOptions() {
  if (!exerciseFrequencyEl) {
    return;
  }

  exerciseFrequencyEl.innerHTML = `
    <option value="">Select frequency</option>
    ${EXERCISE_FREQUENCY_OPTIONS.map(
      (value) => `<option value="${value}">${value}</option>`
    ).join("")}
  `;
}

function populateExerciseIntensityOptions() {
  if (!exerciseIntensityEl) {
    return;
  }

  exerciseIntensityEl.innerHTML = `
    <option value="">Select intensity</option>
    ${EXERCISE_INTENSITY_OPTIONS.map(
      (value) => `<option value="${value}">${value}</option>`
    ).join("")}
  `;
}

function populateAllSelectOptions() {
  populateGmtOptions();
  populateExerciseFrequencyOptions();
  populateExerciseIntensityOptions();
}

function getDetectedTimezoneGmtLabel() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
    const minutes = String(absoluteMinutes % 60).padStart(2, "0");

    return {
      timezone,
      gmt: `GMT${sign}${hours}:${minutes}`
    };
  } catch (error) {
    console.error("[Registration] Failed to detect timezone:", error);
    return {
      timezone: "",
      gmt: ""
    };
  }
}

function applyDetectedTimezone() {
  const detected = getDetectedTimezoneGmtLabel();

  if (detected.gmt && GMT_OPTIONS.includes(detected.gmt) && gmtSelectEl) {
    gmtSelectEl.value = detected.gmt;
  }

  if (detectedLocationEl) {
    detectedLocationEl.textContent = detected.timezone
      ? `Detected location/timezone: ${detected.timezone}`
      : "Detected location/timezone unavailable.";
  }
}

function normalizePrefilledPhoneNumber(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return "";
  }

  const trimmed = decodeURIComponent(rawValue).trim();

  if (!/^p/i.test(trimmed)) {
    return "";
  }

  const withoutPrefix = trimmed.slice(1).trim();
  if (!withoutPrefix) {
    return "";
  }

  const normalized = withoutPrefix.startsWith("+")
    ? withoutPrefix
    : `+${withoutPrefix}`;

  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function getPrefilledPhoneNumberFromUrl() {
  const rawSearch = window.location.search.replace(/^\?/, "").trim();
  return normalizePrefilledPhoneNumber(rawSearch);
}

function applyPrefilledPhoneNumber() {
  const prefilledPhoneNumber = getPrefilledPhoneNumberFromUrl();

  if (!prefilledPhoneNumber || !phoneNumberEl) {
    if (phonePrefillNoteEl) {
      phonePrefillNoteEl.textContent = "";
    }
    return;
  }

  phoneNumberEl.value = prefilledPhoneNumber;
  phoneNumberEl.readOnly = true;
  phoneNumberEl.dataset.locked = "true";

  if (phonePrefillNoteEl) {
    phonePrefillNoteEl.textContent =
      "Phone number was prefilled.";
  }
}

function getFormData() {
  const formData = new FormData(formEl);

  const heightCmRaw = formData.get("heightCm")?.toString().trim() ?? "";
  const weightKgRaw = formData.get("weightKg")?.toString().trim() ?? "";
  const stepsPerDayRaw = formData.get("stepsPerDay")?.toString().trim() ?? "";
  const bodyFatPercentageRaw =
    formData.get("bodyFatPercentage")?.toString().trim() ?? "";
  const exerciseFrequencyRaw =
    formData.get("exerciseFrequencyPerWeek")?.toString().trim() ?? "";
  const exerciseDurationMinutesRaw =
    formData.get("exerciseDurationMinutes")?.toString().trim() ?? "";

  return {
    name: formData.get("name")?.toString().trim() ?? "",
    phoneNumber: phoneNumberEl?.value?.trim() ?? "",
    dob: formData.get("dob")?.toString().trim() ?? "",
    gender: formData.get("gender")?.toString().trim() ?? "",
    gmt: formData.get("gmt")?.toString().trim() ?? "",
    heightCm: heightCmRaw === "" ? "" : Number(heightCmRaw),
    weightKg: weightKgRaw === "" ? "" : Number(weightKgRaw),
    stepsPerDay: stepsPerDayRaw === "" ? "" : Number(stepsPerDayRaw),
    bodyFatPercentage: bodyFatPercentageRaw,
    exerciseFrequencyPerWeek:
      exerciseFrequencyRaw === "" ? "" : Number(exerciseFrequencyRaw),
    exerciseDurationMinutes:
      exerciseDurationMinutesRaw === "" ? "" : Number(exerciseDurationMinutesRaw),
    exerciseIntensity:
      formData.get("exerciseIntensity")?.toString().trim().toLowerCase() ?? ""
  };
}

function buildRegistrationCompletePageUrl(result) {
  const completePageUrl = new URL(
    REGISTRATION_COMPLETE_PAGE_PATH,
    window.location.origin
  );
  const userId = result?.userId?.toString().trim() ?? "";
  const registeredUser = result?.data || {};

  if (userId) {
    completePageUrl.searchParams.set("userId", userId);
  }

  if (registeredUser[USER_FIELDS.NAME]) {
    completePageUrl.searchParams.set(
      "name",
      registeredUser[USER_FIELDS.NAME]
    );
  }

  if (registeredUser[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] !== undefined) {
    completePageUrl.searchParams.set(
      "totalCaloriesRequiredPerDay",
      String(registeredUser[USER_FIELDS.TOTAL_CALORIES_REQUIRED_PER_DAY] ?? "")
    );
  }

  return completePageUrl.toString();
}

async function handleSubmit(event) {
  event.preventDefault();
  let shouldEnableFormAfterSubmit = true;

  try {
    const payload = getFormData();

    setStatus("Submitting registration...");
    setDebugOutput({
      stage: "submit_started",
      href: window.location.href,
      payload
    });
    setFormEnabled(false);

    const result = await registerUser(payload);
    setDebugOutput({
      stage: "register_user_result",
      result
    });

    if (!result.success) {
      const errorMessage = Array.isArray(result.errors) ?
        result.errors.join(" ") :
        "Please check your details and try again.";

      setStatus(`Registration failed. ${errorMessage}`);
      return;
    }

    const redirectUrl = buildRegistrationCompletePageUrl(result);

    setStatus("Registration successful. Redirecting...");
    setDebugOutput({
      stage: "redirecting_to_registration_complete",
      result,
      redirectUrl
    });

    shouldEnableFormAfterSubmit = false;
    window.location.replace(redirectUrl);
  } catch (error) {
    console.error("[Registration] Submit error:", error);
    setStatus(`Registration failed. ${error.message}`);
    setDebugOutput({
      stage: "submit_error",
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  } finally {
    if (shouldEnableFormAfterSubmit) {
      setFormEnabled(true);
    }
  }
}

async function initializePage() {
  try {
    initUserHandler();

    populateAllSelectOptions();
    applyDetectedTimezone();
    applyPrefilledPhoneNumber();
    setFormEnabled(true);
    setStatus("Ready.");
    setDebugOutput({
      stage: "initialized",
      href: window.location.href,
      completePagePath: REGISTRATION_COMPLETE_PAGE_PATH
    });

  } catch (error) {
    console.error("[Registration] Initialization error:", error);
    setStatus(`Initialization failed. ${error.message}`);
    setDebugOutput({
      stage: "initialization_error",
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
}

formEl?.addEventListener("submit", handleSubmit);

initializePage();
