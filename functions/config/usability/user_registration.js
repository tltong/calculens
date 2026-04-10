// functions/config/usability/user_registration.js

const USER_REGISTRATION_MESSAGES = {
  USER_NOT_REGISTERED_TEMPLATE:
    "Please register first using this link:\n{registrationLink}",

  USER_REGISTERED: "user registered",

  USER_WELCOME_TEMPLATE:
    "Welcome to Calculens 🎉\n\nYou're successfully registered.\nYou can now start tracking your calories."
};

/**
 * Build user-not-registered reply message
 */
function buildUserNotRegisteredMessage({registrationLink}) {
  return USER_REGISTRATION_MESSAGES.USER_NOT_REGISTERED_TEMPLATE.replace(
    "{registrationLink}",
    registrationLink || ""
  );
}

/**
 * Build welcome message
 */
function buildUserWelcomeMessage() {
  return USER_REGISTRATION_MESSAGES.USER_WELCOME_TEMPLATE;
}

module.exports = {
  USER_REGISTRATION_MESSAGES,
  buildUserNotRegisteredMessage,
  buildUserWelcomeMessage
};