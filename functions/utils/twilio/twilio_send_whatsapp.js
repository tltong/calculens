// functions/utils/twilio/twilio_send_whatsapp.js

const {createTwilioClient} = require("./twilio_client");

/**
 * Normalize phone number into Twilio WhatsApp format
 * Example: +60123456789 -> whatsapp:+60123456789
 * @param {string} phoneNumber
 * @returns {string}
 */
function normalizeWhatsAppTo(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== "string") {
    throw new Error("Invalid destination phone number.");
  }

  const trimmed = phoneNumber.trim();

  if (trimmed.startsWith("whatsapp:")) {
    return trimmed;
  }

  return `whatsapp:${trimmed}`;
}

/**
 * Send WhatsApp message using Twilio Messaging Service
 * @param {Object} params
 * @param {string} params.accountSid
 * @param {string} params.authToken
 * @param {string} params.messagingServiceSid
 * @param {string} params.to
 * @param {string} params.body
 * @returns {Promise<Object>}
 */
async function sendWhatsAppMessage({
  accountSid,
  authToken,
  messagingServiceSid,
  to,
  body
}) {
  if (!messagingServiceSid || typeof messagingServiceSid !== "string") {
    throw new Error("Invalid Twilio messaging service SID.");
  }

  if (!body || typeof body !== "string") {
    throw new Error("Invalid WhatsApp message body.");
  }

  const client = createTwilioClient(accountSid, authToken);

  const message = await client.messages.create({
    messagingServiceSid,
    to: normalizeWhatsAppTo(to),
    body
  });

  return {
    sid: message.sid,
    status: message.status,
    to: message.to
  };
}

module.exports = {
  normalizeWhatsAppTo,
  sendWhatsAppMessage
};