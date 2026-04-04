// public/handlers/user_calorie_handler.js

import { USER_FIELDS } from "/config/firebase/firebase_user_schema.js";
import {
  baseCaloriesPerDay as calculateMifflinStJeorBaseCaloriesPerDay
} from "/utils/calorie_calculator/mifflin_st_jeor.js";
import {
  baseCaloriesPerDay as calculateKatchMcardleBaseCaloriesPerDay
} from "/utils/calorie_calculator/katch_mcardle.js";
import {
  neatCaloriesExpended as calculateNeatCaloriesExpended
} from "/utils/calorie_calculator/neat.js";
import {
  eatCaloriesPerDay as calculateEatCaloriesPerDay
} from "/utils/calorie_calculator/eat.js";
import {
  tefCaloriesPerDay as calculateTefCaloriesPerDay
} from "/utils/calorie_calculator/tef.js";

const CALORIE_METHODS = {
  MIFFLIN_ST_JEOR: "mifflin_st_jeor",
  KATCH_MCARDLE: "katch_mcardle"
};

const LOWER_ACTIVITY_OVERLAP_FACTOR = 0.7;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isUsableBodyFatPercentage(value) {
  const numericValue = toNumberOrNull(value);
  return numericValue !== null && numericValue > 0 && numericValue < 100;
}

function calculateAgeFromDob(dobString) {
  if (!dobString || typeof dobString !== "string") {
    return null;
  }

  const dob = new Date(dobString);

  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();
  const dayDifference = today.getDate() - dob.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function baseCaloriesPerDay(user) {
  try {
    if (!user || typeof user !== "object") {
      return {
        baseCaloriesPerDay: null,
        calorieMethod: ""
      };
    }

    const weightKg = toNumberOrNull(user[USER_FIELDS.WEIGHT_KG]);
    const bodyFatPercentage = toNumberOrNull(user[USER_FIELDS.BODY_FAT_PERCENTAGE]);

    if (
      weightKg !== null &&
      weightKg > 0 &&
      isUsableBodyFatPercentage(bodyFatPercentage)
    ) {
      const calories = calculateKatchMcardleBaseCaloriesPerDay({
        weightKg,
        bodyFatPercentage
      });

      if (isFiniteNumber(calories)) {
        return {
          baseCaloriesPerDay: calories,
          calorieMethod: CALORIE_METHODS.KATCH_MCARDLE
        };
      }
    }

    const gender = user[USER_FIELDS.GENDER];
    const heightCm = toNumberOrNull(user[USER_FIELDS.HEIGHT_CM]);
    const age = calculateAgeFromDob(user[USER_FIELDS.DOB]);

    if (
      typeof gender === "string" &&
      weightKg !== null &&
      weightKg > 0 &&
      heightCm !== null &&
      heightCm > 0 &&
      age !== null
    ) {
      const calories = calculateMifflinStJeorBaseCaloriesPerDay({
        gender,
        heightCm,
        weightKg,
        age
      });

      if (isFiniteNumber(calories)) {
        return {
          baseCaloriesPerDay: calories,
          calorieMethod: CALORIE_METHODS.MIFFLIN_ST_JEOR
        };
      }
    }

    return {
      baseCaloriesPerDay: null,
      calorieMethod: ""
    };
  } catch (error) {
    console.warn("[UserCalorieHandler] Failed to calculate base calories:", error);
    return {
      baseCaloriesPerDay: null,
      calorieMethod: ""
    };
  }
}

function neatCaloriesPerDay(user) {
  try {
    if (!user || typeof user !== "object") {
      return {
        neatCaloriesPerDay: null
      };
    }

    const steps = toNumberOrNull(user[USER_FIELDS.STEPS_PER_DAY]);
    const weightKg = toNumberOrNull(user[USER_FIELDS.WEIGHT_KG]);

    if (
      steps === null ||
      steps < 0 ||
      weightKg === null ||
      weightKg <= 0
    ) {
      return {
        neatCaloriesPerDay: null
      };
    }

    const calories = calculateNeatCaloriesExpended({
      steps,
      weightKg
    });

    if (!isFiniteNumber(calories)) {
      return {
        neatCaloriesPerDay: null
      };
    }

    return {
      neatCaloriesPerDay: calories
    };
  } catch (error) {
    console.warn("[UserCalorieHandler] Failed to calculate NEAT calories:", error);
    return {
      neatCaloriesPerDay: null
    };
  }
}

function eatCaloriesPerDay(user) {
  try {
    if (!user || typeof user !== "object") {
      return {
        eatCaloriesPerDay: null
      };
    }

    const exerciseFrequencyPerWeek = toNumberOrNull(
      user[USER_FIELDS.EXERCISE_FREQUENCY_PER_WEEK]
    );
    const exerciseDurationMinutes = toNumberOrNull(
      user[USER_FIELDS.EXERCISE_DURATION_MINUTES]
    );
    const exerciseIntensity = user[USER_FIELDS.EXERCISE_INTENSITY];
    const weightKg = toNumberOrNull(user[USER_FIELDS.WEIGHT_KG]);

    if (
      exerciseFrequencyPerWeek === null ||
      exerciseFrequencyPerWeek < 0 ||
      exerciseFrequencyPerWeek > 7 ||
      exerciseDurationMinutes === null ||
      exerciseDurationMinutes < 0 ||
      typeof exerciseIntensity !== "string" ||
      !exerciseIntensity.trim() ||
      weightKg === null ||
      weightKg <= 0
    ) {
      return {
        eatCaloriesPerDay: null
      };
    }

    const calories = calculateEatCaloriesPerDay({
      exerciseFrequencyPerWeek,
      exerciseDurationMinutes,
      exerciseIntensity,
      weightKg
    });

    if (!isFiniteNumber(calories)) {
      return {
        eatCaloriesPerDay: null
      };
    }

    return {
      eatCaloriesPerDay: calories
    };
  } catch (error) {
    console.warn("[UserCalorieHandler] Failed to calculate EAT calories:", error);
    return {
      eatCaloriesPerDay: null
    };
  }
}

function tefCaloriesPerDay(user) {
  try {
    if (!user || typeof user !== "object") {
      return {
        tefCaloriesPerDay: null
      };
    }

    const baseResult = baseCaloriesPerDay(user);
    const neatResult = neatCaloriesPerDay(user);
    const eatResult = eatCaloriesPerDay(user);

    const baseCalories = toNumberOrNull(baseResult.baseCaloriesPerDay);
    const neatCalories = toNumberOrNull(neatResult.neatCaloriesPerDay);
    const eatCalories = toNumberOrNull(eatResult.eatCaloriesPerDay);

    if (baseCalories === null || baseCalories <= 0) {
      return {
        tefCaloriesPerDay: null
      };
    }

    let preTefCaloriesPerDay = baseCalories;

    if (neatCalories !== null && eatCalories !== null) {
      const higherCalories = Math.max(neatCalories, eatCalories);
      const lowerCalories = Math.min(neatCalories, eatCalories);

      preTefCaloriesPerDay =
        baseCalories +
        higherCalories +
        lowerCalories * LOWER_ACTIVITY_OVERLAP_FACTOR;
    } else if (neatCalories !== null) {
      preTefCaloriesPerDay = baseCalories + neatCalories;
    } else if (eatCalories !== null) {
      preTefCaloriesPerDay = baseCalories + eatCalories;
    }

    const tefCalories = calculateTefCaloriesPerDay({
      preTefCaloriesPerDay
    });

    return {
      tefCaloriesPerDay: isFiniteNumber(tefCalories) ? tefCalories : null
    };
  } catch (error) {
    console.warn("[UserCalorieHandler] Failed to calculate TEF calories:", error);
    return {
      tefCaloriesPerDay: null
    };
  }
}

function totalCaloriesRequiredPerDay(user) {
  try {
    if (!user || typeof user !== "object") {
      return {
        totalCaloriesRequiredPerDay: null
      };
    }

    const baseResult = baseCaloriesPerDay(user);
    const neatResult = neatCaloriesPerDay(user);
    const eatResult = eatCaloriesPerDay(user);
    const tefResult = tefCaloriesPerDay(user);

    const baseCalories = toNumberOrNull(baseResult.baseCaloriesPerDay);
    const neatCalories = toNumberOrNull(neatResult.neatCaloriesPerDay);
    const eatCalories = toNumberOrNull(eatResult.eatCaloriesPerDay);
    const tefCalories = toNumberOrNull(tefResult.tefCaloriesPerDay);

    if (baseCalories === null || baseCalories <= 0) {
      return {
        totalCaloriesRequiredPerDay: null
      };
    }

    let preTefCaloriesPerDay = baseCalories;

    if (neatCalories !== null && eatCalories !== null) {
      const higherCalories = Math.max(neatCalories, eatCalories);
      const lowerCalories = Math.min(neatCalories, eatCalories);

      preTefCaloriesPerDay =
        baseCalories +
        higherCalories +
        lowerCalories * LOWER_ACTIVITY_OVERLAP_FACTOR;
    } else if (neatCalories !== null) {
      preTefCaloriesPerDay = baseCalories + neatCalories;
    } else if (eatCalories !== null) {
      preTefCaloriesPerDay = baseCalories + eatCalories;
    }

    return {
      totalCaloriesRequiredPerDay: Math.round(
        preTefCaloriesPerDay + (tefCalories ?? 0)
      )
    };
  } catch (error) {
    console.warn(
      "[UserCalorieHandler] Failed to calculate total calories required per day:",
      error
    );
    return {
      totalCaloriesRequiredPerDay: null
    };
  }
}

function calculateDailyCalorieFields(user) {
  const baseResult = baseCaloriesPerDay(user);
  const neatResult = neatCaloriesPerDay(user);
  const eatResult = eatCaloriesPerDay(user);

  const mergedUser = {
    ...user,
    [USER_FIELDS.BASE_CALORIES_PER_DAY]: baseResult.baseCaloriesPerDay ?? null,
    [USER_FIELDS.NEAT_CALORIES_PER_DAY]: neatResult.neatCaloriesPerDay ?? null,
    [USER_FIELDS.EAT_CALORIES_PER_DAY]: eatResult.eatCaloriesPerDay ?? null
  };

  const tefResult = tefCaloriesPerDay(mergedUser);
  const totalResult = totalCaloriesRequiredPerDay(mergedUser);

  return {
    baseCaloriesPerDay: baseResult.baseCaloriesPerDay ?? null,
    calorieMethod: baseResult.calorieMethod ?? "",
    neatCaloriesPerDay: neatResult.neatCaloriesPerDay ?? null,
    eatCaloriesPerDay: eatResult.eatCaloriesPerDay ?? null,
    tefCaloriesPerDay: tefResult.tefCaloriesPerDay ?? null,
    totalCaloriesRequiredPerDay: totalResult.totalCaloriesRequiredPerDay ?? null
  };
}

export {
  baseCaloriesPerDay,
  neatCaloriesPerDay,
  eatCaloriesPerDay,
  tefCaloriesPerDay,
  totalCaloriesRequiredPerDay,
  calculateDailyCalorieFields,
  calculateAgeFromDob
};