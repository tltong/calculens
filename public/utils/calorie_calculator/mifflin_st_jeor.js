// public/utils/calorie_calculator/mifflin_st_jeor.js

function baseCaloriesPerDay({ gender, heightCm, weightKg, age }) {
  const normalizedGender = gender?.toString().trim().toLowerCase();
  const normalizedHeightCm = Number(heightCm);
  const normalizedWeightKg = Number(weightKg);
  const normalizedAge = Number(age);

  if (normalizedGender !== "male" && normalizedGender !== "female") {
    throw new Error("Invalid gender.");
  }

  if (!Number.isFinite(normalizedHeightCm) || normalizedHeightCm <= 0) {
    throw new Error("Invalid height.");
  }

  if (!Number.isFinite(normalizedWeightKg) || normalizedWeightKg <= 0) {
    throw new Error("Invalid weight.");
  }

  if (!Number.isFinite(normalizedAge) || normalizedAge < 0) {
    throw new Error("Invalid age.");
  }

  if (normalizedGender === "male") {
    return Math.round(
      10 * normalizedWeightKg +
      6.25 * normalizedHeightCm -
      5 * normalizedAge +
      5
    );
  }

  return Math.round(
    10 * normalizedWeightKg +
    6.25 * normalizedHeightCm -
    5 * normalizedAge -
    161
  );
}

export {
  baseCaloriesPerDay
};