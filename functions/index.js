// functions/index.js

const {whatsappWebhook} = require("./whatsapp/whatsappWebhook");
const {newUserRegistration} = require("./triggers/new_user_registration");
const {uploadedFoodNotify} = require("./triggers/uploaded_food_notify");

exports.whatsappWebhook = whatsappWebhook;
exports.newUserRegistration = newUserRegistration;
exports.uploadedFoodNotify = uploadedFoodNotify;