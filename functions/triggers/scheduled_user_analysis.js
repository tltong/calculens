// functions/triggers/scheduled_user_analysis.js

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");

const weeklyUserReport = require("../schedule/weekly_user_report");
const {
  USER_ANALYSIS_SCHEDULE,
} = require("../config/firebase/analysis_schedule");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = defineSecret(
    "TWILIO_MESSAGING_SERVICE_SID"
);

const scheduledUserAnalysis = onSchedule(
    {
      schedule: USER_ANALYSIS_SCHEDULE.SCHEDULE,
      timeZone: USER_ANALYSIS_SCHEDULE.TIME_ZONE,
      timeoutSeconds: USER_ANALYSIS_SCHEDULE.TIMEOUT_SECONDS,
      memory: USER_ANALYSIS_SCHEDULE.MEMORY,
      secrets: [
        GEMINI_API_KEY,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_MESSAGING_SERVICE_SID,
      ],
    },
    async () => {
      await weeklyUserReport.run({
        twilioConfig: {
          accountSid: TWILIO_ACCOUNT_SID.value(),
          authToken: TWILIO_AUTH_TOKEN.value(),
          messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
        },
      });
    }
);

module.exports = {
  scheduledUserAnalysis,
};
