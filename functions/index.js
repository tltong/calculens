// functions/index.js

const {whatsappWebhook} = require("./whatsapp/whatsappWebhook");
const {newUserRegistration} = require("./triggers/new_user_registration");
const {uploadedFoodNotify} = require("./triggers/uploaded_food_notify");
const {userAnalysisRequested} = require("./triggers/user_analysis_requested");

exports.whatsappWebhook = whatsappWebhook;
exports.newUserRegistration = newUserRegistration;
exports.uploadedFoodNotify = uploadedFoodNotify;
exports.userAnalysisRequested = userAnalysisRequested;
