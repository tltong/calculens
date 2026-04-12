// functions/triggers/user_analysis_requested.js

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");

const userAnalysisHandler = require("../handlers/user_analysis_handler");
const {
  USER_ANALYSIS_TRIGGER_PARAMS,
  USER_ANALYSIS_TRIGGER_PATHS,
} = require("../config/firebase/user_analysis_schema");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const userAnalysisRequested = onDocumentCreated(
  {
    document: USER_ANALYSIS_TRIGGER_PATHS.ANALYSIS_RUN,
    secrets: [GEMINI_API_KEY],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      console.warn("[userAnalysisRequested] No snapshot.");
      return;
    }

    const analysisRun = snapshot.data() || {};
    const userDocumentId =
      event.params?.[USER_ANALYSIS_TRIGGER_PARAMS.USER_DOCUMENT_ID];
    const analysisRunId =
      event.params?.[USER_ANALYSIS_TRIGGER_PARAMS.ANALYSIS_RUN_ID];

    await userAnalysisHandler.processUserAnalysisRun({
      userDocumentId,
      analysisRunId,
      analysisRun,
    });
  }
);

module.exports = {
  userAnalysisRequested,
};
