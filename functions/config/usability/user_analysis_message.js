// functions/config/usability/user_analysis_message.js

const USER_ANALYSIS_MESSAGE_PLACEHOLDERS = {
  GREETING: "{greeting}",
  USER_ANALYSIS_LINK: "{userAnalysisLink}",
};

const USER_ANALYSIS_MESSAGES = {
  WEEKLY_ANALYSIS_READY_TEMPLATE:
    "{greeting}\n\n" +
    "Your weekly analysis is ready.\n\n" +
    "View it here:\n{userAnalysisLink}",
};

function buildWeeklyUserAnalysisMessage({
  userName = "",
  userAnalysisLink = "",
} = {}) {
  const normalizedUserName = String(userName || "").trim();
  const greeting = normalizedUserName ? `Hi ${normalizedUserName},` : "Hi,";

  return USER_ANALYSIS_MESSAGES.WEEKLY_ANALYSIS_READY_TEMPLATE
      .replace(USER_ANALYSIS_MESSAGE_PLACEHOLDERS.GREETING, greeting)
      .replace(
          USER_ANALYSIS_MESSAGE_PLACEHOLDERS.USER_ANALYSIS_LINK,
          userAnalysisLink
      );
}

module.exports = {
  USER_ANALYSIS_MESSAGE_PLACEHOLDERS,
  USER_ANALYSIS_MESSAGES,
  buildWeeklyUserAnalysisMessage,
};
