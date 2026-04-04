// public/utils/calorie_calculator/tef.js

const DEFAULT_TEF_RATE = 0.15;

/**
 * Estimate Thermic Effect of Food (TEF) calories per day
 *
 * Formula:
 * tefCaloriesPerDay = preTefCaloriesPerDay × 0.1
 *
 * @param {Object} params
 * @param {number|string} params.preTefCaloriesPerDay
 * @returns {number}
 */
function tefCaloriesPerDay({ preTefCaloriesPerDay }) {
  const normalizedPreTefCaloriesPerDay = Number(preTefCaloriesPerDay);

  if (
    !Number.isFinite(normalizedPreTefCaloriesPerDay) ||
    normalizedPreTefCaloriesPerDay < 0
  ) {
    throw new Error("Invalid pre-TEF calories.");
  }

  return Math.round(normalizedPreTefCaloriesPerDay * DEFAULT_TEF_RATE);
}

export {
  tefCaloriesPerDay
};