// functions/triggers/new_user_registration.js

const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");

const {
  USER_COLLECTION,
  USER_FIELDS,
  buildUserEditProfileLink
} = require("../config/firebase/firebase_user_schema");

const {
  buildUserWelcomeMessage
} = require("../config/usability/user_registration");

const {
  sendWhatsAppMessage
} = require("../utils/twilio/twilio_send_whatsapp");

// Twilio secrets
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = defineSecret("TWILIO_MESSAGING_SERVICE_SID");

/**
 * Trigger: New user registration
 */
exports.newUserRegistration = onDocumentCreated(
  {
    document: `${USER_COLLECTION}/{userId}`,
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_SERVICE_SID
    ]
  },
  async (event) => {
    try {
      const snapshot = event.data;

      if (!snapshot) {
        console.warn("[newUserRegistration] No snapshot");
        return;
      }

      const userData = snapshot.data();
      const userDocumentId = event.params?.userId || snapshot.id;

      const phoneNumber = userData[USER_FIELDS.PHONE_NUMBER];

      if (!phoneNumber) {
        console.warn("[newUserRegistration] Missing phone number");
        return;
      }

      console.log("[newUserRegistration] New user:", phoneNumber);

      const editProfileLink = buildUserEditProfileLink(userDocumentId);
      const message = buildUserWelcomeMessage({
        editProfileLink
      });

      await sendWhatsAppMessage({
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
        to: phoneNumber,
        body: message
      });

      console.log("[newUserRegistration] Welcome message sent");
    } catch (error) {
      console.error("[newUserRegistration] Error:", error);
    }
  }
);
