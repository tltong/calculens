// functions/config/usability/user_message.js

const {
  USER_ANALYSIS_SCHEDULE,
} = require("../firebase/analysis_schedule");

const USER_MESSAGE_PLACEHOLDERS = {
  REGISTRATION_LINK: "{registrationLink}",
  WEEKLY_REPORT_TIME: "{weeklyReportTime}",
  EDIT_PROFILE_LINK: "{editProfileLink}",
  REGISTERED_USER_INSTRUCTION_MESSAGE: "{registeredUserInstructionMessage}",
};

const USER_MESSAGES = {
  USER_NOT_REGISTERED_TEMPLATE:
    "Please register first using this link:\n{registrationLink}",

  REGISTERED_USER_INSTRUCTION_TEMPLATE:
    "Just upload photos of your food before eating " +
    "so your calorie consumption can be tracked.\n\n" +
    "At {weeklyReportTime}, you will get a weekly report.\n\n" +
    "Use this link to update your profile:\n{editProfileLink}",

  WELCOME_REGISTERED_USER_TEMPLATE:
    "Welcome\n\n{registeredUserInstructionMessage}",
};

function buildUserNotRegisteredMessage({registrationLink}) {
  return USER_MESSAGES.USER_NOT_REGISTERED_TEMPLATE.replace(
      USER_MESSAGE_PLACEHOLDERS.REGISTRATION_LINK,
      registrationLink || ""
  );
}

function buildRegisteredUserInstructionMessage({
  editProfileLink = "",
  weeklyReportTime = USER_ANALYSIS_SCHEDULE.REPORT_TIME_LABEL,
} = {}) {
  return USER_MESSAGES.REGISTERED_USER_INSTRUCTION_TEMPLATE
      .replace(
          USER_MESSAGE_PLACEHOLDERS.WEEKLY_REPORT_TIME,
          weeklyReportTime || ""
      )
      .replace(
          USER_MESSAGE_PLACEHOLDERS.EDIT_PROFILE_LINK,
          editProfileLink || ""
      );
}

function buildWelcomeRegisteredUserMessage({
  editProfileLink = "",
  weeklyReportTime = USER_ANALYSIS_SCHEDULE.REPORT_TIME_LABEL,
} = {}) {
  const instructionMessage = buildRegisteredUserInstructionMessage({
    editProfileLink,
    weeklyReportTime,
  });

  return USER_MESSAGES.WELCOME_REGISTERED_USER_TEMPLATE.replace(
      USER_MESSAGE_PLACEHOLDERS.REGISTERED_USER_INSTRUCTION_MESSAGE,
      instructionMessage
  );
}

module.exports = {
  USER_MESSAGE_PLACEHOLDERS,
  USER_MESSAGES,
  buildUserNotRegisteredMessage,
  buildRegisteredUserInstructionMessage,
  buildWelcomeRegisteredUserMessage,
};
