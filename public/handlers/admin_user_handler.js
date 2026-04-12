import {
  USER_COLLECTION,
  USER_SUBCOLLECTIONS
} from "/config/firebase/firebase_user_schema.js?v=client-delete-1";

import {
  USER_ANALYSIS_SUBCOLLECTIONS
} from "/config/firebase/user_analysis_schema.js?v=client-delete-1";

import {
  FOOD_LOG_SUBCOLLECTIONS
} from "/config/firebase/food_data_schema.js?v=client-delete-1";

import {
  deleteDocument,
  deleteDocumentByPath,
  getCollectionDocumentsByPath,
  getDocument
} from "/utils/firebase/firebase_ops.js?v=client-delete-1";

async function deleteUserAndBackendData({
  userDocumentId
}) {
  validateDeleteUserInput({
    userDocumentId
  });

  const user = await getDocument(USER_COLLECTION, userDocumentId);

  if (!user) {
    return {
      deleted: false,
      userDocumentId,
      notFound: true
    };
  }

  await deleteUserFoodLogs(userDocumentId);
  await deleteUserAnalysisRuns(userDocumentId);
  await deleteDocument(USER_COLLECTION, userDocumentId);

  return {
    deleted: true,
    userDocumentId,
    notFound: false
  };
}

async function deleteUserFoodLogs(userDocumentId) {
  const foodLogDays = await getCollectionDocumentsByPath([
    USER_COLLECTION,
    userDocumentId,
    USER_SUBCOLLECTIONS.FOOD_LOGS
  ]);

  for (const foodLogDay of foodLogDays) {
    await deleteFoodLogDay({
      userDocumentId,
      foodLogDate: foodLogDay.id
    });
  }
}

async function deleteFoodLogDay({
  userDocumentId,
  foodLogDate
}) {
  const foodLogEntryPath = [
    USER_COLLECTION,
    userDocumentId,
    USER_SUBCOLLECTIONS.FOOD_LOGS,
    foodLogDate,
    FOOD_LOG_SUBCOLLECTIONS.ENTRIES
  ];
  const foodLogEntries = await getCollectionDocumentsByPath(foodLogEntryPath);

  for (const foodLogEntry of foodLogEntries) {
    await deleteDocumentByPath([
      ...foodLogEntryPath,
      foodLogEntry.id
    ]);
  }

  await deleteDocumentByPath([
    USER_COLLECTION,
    userDocumentId,
    USER_SUBCOLLECTIONS.FOOD_LOGS,
    foodLogDate
  ]);
}

async function deleteUserAnalysisRuns(userDocumentId) {
  const analysisRunPath = [
    USER_COLLECTION,
    userDocumentId,
    USER_ANALYSIS_SUBCOLLECTIONS.ANALYSIS_RUNS
  ];
  const analysisRuns = await getCollectionDocumentsByPath(analysisRunPath);

  for (const analysisRun of analysisRuns) {
    await deleteDocumentByPath([
      ...analysisRunPath,
      analysisRun.id
    ]);
  }
}

function validateDeleteUserInput({
  userDocumentId
}) {
  if (!userDocumentId || typeof userDocumentId !== "string") {
    throw new Error("userDocumentId is required and must be a string.");
  }
}

export {
  deleteUserAndBackendData
};
