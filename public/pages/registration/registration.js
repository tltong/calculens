// public/pages/registration/registration.js

import {
  initUserHandler,
  registerUser
} from "/handlers/user_handler.js";

import {
  GMT_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS
} from "/config/firebase/firebase_user_schema.js";

const appStatusEl = document.getElementById("app-status");
const formEl = document.getElementById("registration-form");
const outputEl = document.getElementById("output");
const fillTestDataBtn = document.getElementById("fill-test-data-btn");

const gmtSelectEl = document.getElementById("gmt");
const phoneNumberEl = document.getElementById("phoneNumber");
const detectedLocationEl = document.getElementById("detected-location");
const phonePrefillNoteEl = document.getElementById("phone-prefill-note");

const exerciseFrequencyEl = document.getElementById("exerciseFrequencyPerWeek");
const exerciseDurationMinutesEl = document.getElementById("exerciseDurationMinutes");
const exerciseIntensityEl = document.getElementById("exerciseIntensity");

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
    element.disabled = !enabled;
  });

  if (phoneNumberEl?.dataset?.locked === "true") {
    phoneNumberEl.disabled = false;
    phoneNumberEl.readOnly = true;
  }
}

function getElementDebugInfo(element, label) {
  if (!element) {
    return {
      label,
      found: false
    };
  }

  return {
    label,
    found: true,
    tagName: element.tagName,
    id: element.id,
    name: element.getAttribute("name"),
    optionCount:
      element.tagName === "SELECT" ? element.options.length : undefined,
    currentValue: "value" in element ? element.value : undefined
  };
}

function buildDebugState(extra = {}) {
  return {
    locationSearch: window.location.search,
    elements: {
      form: getElementDebugInfo(formEl, "registration-form"),
      gmt: getElementDebugInfo(gmtSelectEl, "gmt"),
      phoneNumber: getElementDebugInfo(phoneNumberEl, "phoneNumber"),
      exerciseFrequencyPerWeek: getElementDebugInfo(
        exerciseFrequencyEl,
        "exerciseFrequencyPerWeek"
      ),
      exerciseDurationMinutes: getElementDebugInfo(
        exerciseDurationMinutesEl,
        "exerciseDurationMinutes"
      ),
      exerciseIntensity: getElementDebugInfo(
        exerciseIntensityEl,
        "exerciseIntensity"
      )
    },
    schema: {
      gmtCount: GMT_OPTIONS.length,
      exerciseFrequencyCount: EXERCISE_FREQUENCY_OPTIONS.length,
      exerciseIntensityCount: EXERCISE_INTENSITY_OPTIONS.length,
      exerciseFrequencyOptions: EXERCISE_FREQUENCY_OPTIONS,
      exerciseIntensityOptions: EXERCISE_INTENSITY_OPTIONS
    },
    liveOptions: {
      exerciseFrequencyElOptions: exerciseFrequencyEl
        ? Array.from(exerciseFrequencyEl.options).map((option) => ({
            value: option.value,
            text: option.text
          }))
        : [],
      exerciseIntensityElOptions: exerciseIntensityEl
        ? Array.from(exerciseIntensityEl.options).map((option) => ({
            value: option.value,
            text: option.text
          }))
        : []
    },
    ...extra
  };
}

function showDebug(extra = {}) {
  setOutput(buildDebugState(extra));
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

  showDebug({
    stage: "after populateAllSelectOptions"
  });
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
      "Phone number was prefilled from URL and cannot be edited.";
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

function fillTestData() {
  const nameEl = document.getElementById("name");
  const dobEl = document.getElementById("dob");
  const genderEl = document.getElementById("gender");
  const heightCmEl = document.getElementById("heightCm");
  const weightKgEl = document.getElementById("weightKg");
  const stepsPerDayEl = document.getElementById("stepsPerDay");
  const bodyFatPercentageEl = document.getElementById("bodyFatPercentage");

  if (nameEl) {
    nameEl.value = "John Doe";
  }

  if (phoneNumberEl && phoneNumberEl.dataset.locked !== "true") {
    phoneNumberEl.value = "+60123456789";
  }

  if (dobEl) {
    dobEl.value = "1990-01-15";
  }

  if (genderEl) {
    genderEl.value = "male";
  }

  if (gmtSelectEl && !gmtSelectEl.value) {
    gmtSelectEl.value = "GMT+08:00";
  }

  if (heightCmEl) {
    heightCmEl.value = "175";
  }

  if (weightKgEl) {
    weightKgEl.value = "70";
  }

  if (stepsPerDayEl) {
    stepsPerDayEl.value = "8000";
  }

  if (bodyFatPercentageEl) {
    bodyFatPercentageEl.value = "";
  }

  if (exerciseFrequencyEl) {
    exerciseFrequencyEl.value = "4";
  }

  if (exerciseDurationMinutesEl) {
    exerciseDurationMinutesEl.value = "45";
  }

  if (exerciseIntensityEl) {
    exerciseIntensityEl.value = "moderate";
  }

  showDebug({
    stage: "after fillTestData",
    formData: getFormData()
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    const payload = getFormData();

    setStatus("Submitting registration...");
    showDebug({
      stage: "before submit",
      formData: payload
    });
    setFormEnabled(false);

    const result = await registerUser(payload);

    if (!result.success) {
      setStatus("⚠️ Registration failed.");
      setOutput(result);
      return;
    }

    setStatus("✅ Registration successful.");
    setOutput(result);

    formEl.reset();
    populateAllSelectOptions();
    applyDetectedTimezone();
    applyPrefilledPhoneNumber();

    showDebug({
      stage: "after successful submit reset"
    });
  } catch (error) {
    console.error("[Registration] Submit error:", error);
    setStatus("❌ Registration failed.");
    setOutput({
      success: false,
      error: error.message,
      debug: buildDebugState({
        stage: "submit error"
      })
    });
  } finally {
    setFormEnabled(true);
  }
}

async function initializePage() {
  try {
    initUserHandler();

    showDebug({
      stage: "before populate"
    });

    populateAllSelectOptions();
    applyDetectedTimezone();
    applyPrefilledPhoneNumber();
    setFormEnabled(true);
    setStatus("✅ Ready.");

    showDebug({
      stage: "after initializePage complete",
      formData: getFormData()
    });
  } catch (error) {
    console.error("[Registration] Initialization error:", error);
    setStatus("❌ Initialization failed.");
    setOutput({
      success: false,
      error: error.message,
      debug: buildDebugState({
        stage: "initialization error"
      })
    });
  }
}

fillTestDataBtn?.addEventListener("click", fillTestData);
formEl?.addEventListener("submit", handleSubmit);

initializePage();