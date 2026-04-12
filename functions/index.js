// functions/index.js

const {whatsappWebhook} = require("./whatsapp/whatsappWebhook");
const {newUserRegistration} = require("./triggers/new_user_registration");
const {uploadedFoodNotify} = require("./triggers/uploaded_food_notify");
const {userAnalysisRequested} = require("./triggers/user_analysis_requested");
const {scheduledUserAnalysis} = require("./triggers/scheduled_user_analysis");

exports.whatsappWebhook = whatsappWebhook;
exports.newUserRegistration = newUserRegistration;
exports.uploadedFoodNotify = uploadedFoodNotify;
exports.userAnalysisRequested = userAnalysisRequested;
exports.scheduledUserAnalysis = scheduledUserAnalysis;
