// functions/triggers/user_analysis_requested.js

const {onDocumentCreated} = require("firebase-functions/v2/firestore");

const firebaseOps = require("../utils/firebase/firebase_ops");
const userAnalysisHandler = require("../handlers/user_analysis_handler");
const {
  USER_ANALYSIS_FIELDS,
  USER_ANALYSIS_ERROR_FIELDS,
  USER_ANALYSIS_STATUSES,
  USER_ANALYSIS_TRIGGER_PARAMS,
  USER_ANALYSIS_TRIGGER_PATHS,
} = require("../config/firebase/user_analysis_schema");

const userAnalysisRequested = onDocumentCreated(
  USER_ANALYSIS_TRIGGER_PATHS.ANALYSIS_RUN,
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      console.warn("[userAnalysisRequested] No snapshot.");
      return;
    }

    const analysisRun = snapshot.data() || {};
    const status = analysisRun[USER_ANALYSIS_FIELDS.STATUS];
    const userDocumentId =
      event.params?.[USER_ANALYSIS_TRIGGER_PARAMS.USER_DOCUMENT_ID];
    const analysisRunId =
      event.params?.[USER_ANALYSIS_TRIGGER_PARAMS.ANALYSIS_RUN_ID];

    if (status !== USER_ANALYSIS_STATUSES.QUEUED) {
      console.log(
        "[userAnalysisRequested] Ignoring non-queued analysis run:",
        analysisRunId
      );
      return;
    }

    const timestamp = firebaseOps.getTimestamp();

    try {
      await snapshot.ref.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.PROCESSING,
        [USER_ANALYSIS_FIELDS.STARTED_AT]: timestamp,
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: timestamp,
      });

      const result = await userAnalysisHandler.runUserAnalysis({
        userDocumentId,
        analysisRun,
      });

      const completedTimestamp = firebaseOps.getTimestamp();

      await snapshot.ref.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.COMPLETED,
        [USER_ANALYSIS_FIELDS.RESULT]: result,
        [USER_ANALYSIS_FIELDS.COMPLETED_AT]: completedTimestamp,
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: completedTimestamp,
      });

      console.log(
        "[userAnalysisRequested] Completed analysis run:",
        analysisRunId
      );
    } catch (error) {
      const failedTimestamp = firebaseOps.getTimestamp();

      console.error("[userAnalysisRequested] Analysis failed:", error);

      await snapshot.ref.update({
        [USER_ANALYSIS_FIELDS.STATUS]: USER_ANALYSIS_STATUSES.FAILED,
        [USER_ANALYSIS_FIELDS.ERROR]: {
          [USER_ANALYSIS_ERROR_FIELDS.MESSAGE]: error.message,
        },
        [USER_ANALYSIS_FIELDS.UPDATED_AT]: failedTimestamp,
      });
    }
  }
);

module.exports = {
  userAnalysisRequested,
};
