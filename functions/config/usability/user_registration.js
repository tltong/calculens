// functions/config/usability/user_registration.js

const USER_REGISTRATION_MESSAGES = {
  USER_NOT_REGISTERED_TEMPLATE:
    "Please register first using this link:\n{registrationLink}",

  USER_REGISTERED: "user registered",

  USER_WELCOME_TEMPLATE:
    "Welcome 🎉\n\nYou're successfully registered.\nYou can now start tracking your calories.  Usage instruction: Just upload photos of your food.",

  USER_EDIT_PROFILE_LINK_TEMPLATE:
    "Edit your profile here:\n{editProfileLink}"
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
function buildUserWelcomeMessage({editProfileLink = ""} = {}) {
  const editProfileLine =
    USER_REGISTRATION_MESSAGES.USER_EDIT_PROFILE_LINK_TEMPLATE.replace(
      "{editProfileLink}",
      editProfileLink
    );

  return `${USER_REGISTRATION_MESSAGES.USER_WELCOME_TEMPLATE}\n\n${editProfileLine}`;
}

module.exports = {
  USER_REGISTRATION_MESSAGES,
  buildUserNotRegisteredMessage,
  buildUserWelcomeMessage
};
