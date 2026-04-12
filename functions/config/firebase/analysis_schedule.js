// functions/config/firebase/analysis_schedule.js

const {
  USER_ANALYSIS_REQUEST_SOURCES,
} = require("./user_analysis_schema");

const USER_ANALYSIS_SCHEDULE = {
  SCHEDULE: "0 22 * * 0",
  TIME_ZONE: "Asia/Kuala_Lumpur",
  REPORT_TIME_LABEL: "22:00 every Sunday evening",
  TIMEOUT_SECONDS: 540,
  MEMORY: "1GiB",
  REQUESTED_BY: USER_ANALYSIS_REQUEST_SOURCES.SCHEDULED_WEEKLY,
};

module.exports = {
  USER_ANALYSIS_SCHEDULE,
};
