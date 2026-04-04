// public/utils/calorie_calculator/neat.js

/**
 * Calorie cost per step per kg
 *
 * Tuned to reflect real-life movement (not just walking),
 * including minor non-step NEAT.
 *
 * Unit: kcal per step per kg
 */
const KCAL_PER_STEP_PER_KG = 0.00057;

/**
 * Estimate NEAT calories from steps and body weight
 *
 * Formula:
 * kcal = steps × weightKg × constant
 *
 * @param {Object} params
 * @param {number|string} params.steps
 * @param {number|string} params.weightKg
 * @returns {number}
 */
function neatCaloriesExpended({ steps, weightKg }) {
  const normalizedSteps = Number(steps);
  const normalizedWeightKg = Number(weightKg);

  if (!Number.isFinite(normalizedSteps) || normalizedSteps < 0) {
    throw new Error("Invalid steps.");
  }

  if (!Number.isFinite(normalizedWeightKg) || normalizedWeightKg <= 0) {
    throw new Error("Invalid weight.");
  }

  const calories =
    normalizedSteps *
    normalizedWeightKg *
    KCAL_PER_STEP_PER_KG;

  return Math.round(calories);
}

export {
  neatCaloriesExpended
};