// functions/config/usability/user_registration.js

const {
  USER_MESSAGES,
  buildUserNotRegisteredMessage,
  buildWelcomeRegisteredUserMessage,
} = require("./user_message");

const USER_REGISTRATION_MESSAGES = USER_MESSAGES;

/**
 * Build welcome message.
 *
 * Kept as a registration-specific wrapper so existing triggers can call the
 * same function name while all message templates live in user_message.js.
 */
function buildUserWelcomeMessage({editProfileLink = ""} = {}) {
  return buildWelcomeRegisteredUserMessage({
    editProfileLink,
  });
}

module.exports = {
  USER_REGISTRATION_MESSAGES,
  buildUserNotRegisteredMessage,
  buildUserWelcomeMessage,
};
