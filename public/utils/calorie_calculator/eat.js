// public/utils/calorie_calculator/eat.js

/**
 * MET values based on exercise intensity
 * Source: Compendium of Physical Activities (simplified mapping)
 */
const INTENSITY_TO_MET = {
  low: 3.0,        // light activity (walking, light cycling)
  moderate: 5.5,   // jogging, moderate gym work
  hard: 8.0        // running, intense training
};

/**
 * Estimate EAT (Exercise Activity Thermogenesis) calories per day
 *
 * Formula:
 * kcal = MET × weightKg × durationHours × frequencyPerWeek / 7
 *
 * This distributes weekly exercise calories into a daily average.
 *
 * @param {Object} params
 * @param {number|string} params.exerciseFrequencyPerWeek
 * @param {number|string} params.exerciseDurationMinutes
 * @param {string} params.exerciseIntensity
 * @param {number|string} params.weightKg
 * @returns {number}
 */
function eatCaloriesPerDay({
  exerciseFrequencyPerWeek,
  exerciseDurationMinutes,
  exerciseIntensity,
  weightKg
}) {
  const freq = Number(exerciseFrequencyPerWeek);
  const durationMin = Number(exerciseDurationMinutes);
  const weight = Number(weightKg);

  if (!Number.isFinite(freq) || freq < 0 || freq > 7) {
    throw new Error("Invalid exercise frequency.");
  }

  if (!Number.isFinite(durationMin) || durationMin < 0) {
    throw new Error("Invalid exercise duration.");
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Invalid weight.");
  }

  const intensityKey = exerciseIntensity?.toLowerCase();
  const met = INTENSITY_TO_MET[intensityKey];

  if (!met) {
    throw new Error("Invalid exercise intensity.");
  }

  // Convert minutes → hours
  const durationHours = durationMin / 60;

  // Total weekly calories
  const weeklyCalories = met * weight * durationHours * freq;

  // Convert to daily average
  const dailyCalories = weeklyCalories / 7;

  return Math.round(dailyCalories);
}

export {
  eatCaloriesPerDay
};