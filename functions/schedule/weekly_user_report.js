// functions/schedule/weekly_user_report.js

const firebaseOps = require("../utils/firebase/firebase_ops");
const userAnalysisHandler = require("../handlers/user_analysis_handler");
const {
  USER_COLLECTION,
  USER_FIELDS,
  buildUserAnalysisLink,
} = require("../config/firebase/firebase_user_schema");
const {
  USER_ANALYSIS_STATUSES,
} = require("../config/firebase/user_analysis_schema");
const {
  USER_ANALYSIS_SCHEDULE,
} = require("../config/firebase/analysis_schedule");
const {
  buildWeeklyUserAnalysisMessage,
} = require("../config/usability/user_analysis_message");
const {
  sendWhatsAppMessage,
} = require("../utils/twilio/twilio_send_whatsapp");

class WeeklyUserReport {
  /**
   * Run weekly analysis for all registered users and send each completed
   * report through WhatsApp.
   *
   * @param {Object} params
   * @param {Object} params.twilioConfig
   * @param {string} params.twilioConfig.accountSid
   * @param {string} params.twilioConfig.authToken
   * @param {string} params.twilioConfig.messagingServiceSid
   * @returns {Promise<Object>}
   */
  async run({
    twilioConfig,
  }) {
    validateTwilioConfig(twilioConfig);

    console.log("[WeeklyUserReport] Starting weekly analysis run.");

    const users = await firebaseOps.listDocuments(USER_COLLECTION);
    const summary = buildEmptySummary(users.length);

    for (const user of users) {
      try {
        const result = await this.processUser({
          user,
          twilioConfig,
        });

        applyUserResultToSummary({
          summary,
          result,
        });
      } catch (error) {
        summary.failedUsers += 1;
        console.error(
            "[WeeklyUserReport] User analysis failed:",
            user?.id,
            error
        );
      }
    }

    console.log("[WeeklyUserReport] Completed weekly analysis run:", summary);

    return summary;
  }

  /**
   * Run analysis for one user and send the report link by WhatsApp.
   *
   * @param {Object} params
   * @param {Object} params.user
   * @param {Object} params.twilioConfig
   * @returns {Promise<Object>}
   */
  async processUser({
    user,
    twilioConfig,
  }) {
    const userDocumentId = user?.id;
    const phoneNumber = user?.[USER_FIELDS.PHONE_NUMBER];

    if (!userDocumentId) {
      console.warn("[WeeklyUserReport] Skipping user with missing ID.");
      return {skipped: true};
    }

    if (!phoneNumber) {
      console.warn(
          "[WeeklyUserReport] Skipping user with missing phone number:",
          userDocumentId
      );
      return {skipped: true};
    }

    const analysisRunResult =
      await userAnalysisHandler.createAndProcessUserAnalysisRun({
        userDocumentId,
        requestedBy: USER_ANALYSIS_SCHEDULE.REQUESTED_BY,
      });

    if (analysisRunResult.status !== USER_ANALYSIS_STATUSES.COMPLETED) {
      console.warn(
          "[WeeklyUserReport] Analysis did not complete:",
          userDocumentId,
          analysisRunResult.analysisRunId
      );
      return {completed: false};
    }

    const userAnalysisLink = buildUserAnalysisLink({
      userDocumentId,
      analysisRunId: analysisRunResult.analysisRunId,
    });
    const message = buildWeeklyUserAnalysisMessage({
      userName: user[USER_FIELDS.NAME],
      userAnalysisLink,
    });

    await sendWhatsAppMessage({
      accountSid: twilioConfig.accountSid,
      authToken: twilioConfig.authToken,
      messagingServiceSid: twilioConfig.messagingServiceSid,
      to: phoneNumber,
      body: message,
    });

    console.log(
        "[WeeklyUserReport] Analysis message sent:",
        userDocumentId,
        analysisRunResult.analysisRunId
    );

    return {
      completed: true,
      messageSent: true,
    };
  }
}

function buildEmptySummary(totalUsers) {
  return {
    totalUsers,
    completedUsers: 0,
    skippedUsers: 0,
    failedUsers: 0,
    messagesSent: 0,
  };
}

function applyUserResultToSummary({
  summary,
  result,
}) {
  if (result.skipped) {
    summary.skippedUsers += 1;
    return;
  }

  if (result.completed) {
    summary.completedUsers += 1;
  } else {
    summary.failedUsers += 1;
  }

  if (result.messageSent) {
    summary.messagesSent += 1;
  }
}

function validateTwilioConfig(twilioConfig) {
  if (!twilioConfig || typeof twilioConfig !== "object") {
    throw new Error("twilioConfig is required.");
  }

  if (!twilioConfig.accountSid || typeof twilioConfig.accountSid !== "string") {
    throw new Error("twilioConfig.accountSid is required.");
  }

  if (!twilioConfig.authToken || typeof twilioConfig.authToken !== "string") {
    throw new Error("twilioConfig.authToken is required.");
  }

  if (
    !twilioConfig.messagingServiceSid ||
    typeof twilioConfig.messagingServiceSid !== "string"
  ) {
    throw new Error("twilioConfig.messagingServiceSid is required.");
  }
}

module.exports = new WeeklyUserReport();
module.exports.WeeklyUserReport = WeeklyUserReport;
