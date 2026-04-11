// functions/whatsapp/whatsappWebhook.js

const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const {
  buildUserRegistrationStatusReply,
  normalizeWhatsAppNumber,
} = require("../handlers/user_handler");
const {
  sendWhatsAppMessage,
} = require("../utils/twilio/twilio_send_whatsapp");
const {
  processWhatsAppFoodPhoto,
} = require("./whatsapp_photo_handler");

const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = defineSecret("TWILIO_MESSAGING_SERVICE_SID");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

exports.whatsappWebhook = onRequest(
  {
    secrets: [
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_SERVICE_SID,
      GEMINI_API_KEY,
    ],
  },
  async (req, res) => {
    try {
      const from = req.body?.From || req.query?.From || "";
      const normalizedPhoneNumber = normalizeWhatsAppNumber(from);

      if (!normalizedPhoneNumber) {
        res.status(400).send("Missing sender phone number.");
        return;
      }

      const numMedia = req.body?.NumMedia || req.query?.NumMedia || "0";
      const mediaUrl0 = req.body?.MediaUrl0 || req.query?.MediaUrl0 || "";
      const mediaContentType0 =
        req.body?.MediaContentType0 || req.query?.MediaContentType0 || "";

      const hasIncomingImage =
        Number(numMedia || 0) > 0 &&
        typeof mediaContentType0 === "string" &&
        mediaContentType0.startsWith("image/");

      if (hasIncomingImage) {
        await processWhatsAppFoodPhoto({
          from,
          numMedia,
          mediaUrl: mediaUrl0,
          mediaContentType: mediaContentType0,
          twilioAccountSid: TWILIO_ACCOUNT_SID.value(),
          twilioAuthToken: TWILIO_AUTH_TOKEN.value(),
          twilioMessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
        });

        res.status(200).send("OK");
        return;
      }

      const replyMessage = await buildUserRegistrationStatusReply(
        normalizedPhoneNumber
      );

      await sendWhatsAppMessage({
        accountSid: TWILIO_ACCOUNT_SID.value(),
        authToken: TWILIO_AUTH_TOKEN.value(),
        messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID.value(),
        to: normalizedPhoneNumber,
        body: replyMessage,
      });

      res.status(200).send("OK");
    } catch (error) {
      console.error("[whatsappWebhook] Error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);