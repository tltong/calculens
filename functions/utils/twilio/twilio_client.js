// functions/utils/twilio/twilio_client.js

const twilio = require("twilio");

function createTwilioClient(accountSid, authToken) {
  if (!accountSid || typeof accountSid !== "string") {
    throw new Error("Invalid Twilio account SID.");
  }

  if (!authToken || typeof authToken !== "string") {
    throw new Error("Invalid Twilio auth token.");
  }

  return twilio(accountSid, authToken);
}

module.exports = {
  createTwilioClient
};