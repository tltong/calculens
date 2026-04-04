// public/utils/calorie_calculator/katch_mcardle.js

function baseCaloriesPerDay({ weightKg, bodyFatPercentage }) {
  const normalizedWeightKg = Number(weightKg);
  const normalizedBodyFatPercentage = Number(bodyFatPercentage);

  if (!Number.isFinite(normalizedWeightKg) || normalizedWeightKg <= 0) {
    throw new Error("Invalid weight.");
  }

  if (
    !Number.isFinite(normalizedBodyFatPercentage) ||
    normalizedBodyFatPercentage <= 0 ||
    normalizedBodyFatPercentage >= 100
  ) {
    throw new Error("Invalid body fat percentage.");
  }

  const leanBodyMassKg =
    normalizedWeightKg * (1 - normalizedBodyFatPercentage / 100);

  return Math.round(370 + 21.6 * leanBodyMassKg);
}

export {
  baseCaloriesPerDay
};