const {setGlobalOptions} = require("firebase-functions");

setGlobalOptions({maxInstances: 10});

exports.whatsappWebhook = require("./whatsapp/whatsappWebhook").whatsappWebhook;
exports.newUserRegistration = require("./triggers/new_user_registration").newUserRegistration;