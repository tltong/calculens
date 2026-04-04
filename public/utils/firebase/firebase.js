import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "/config/firebase/firebase_config.js";

let app = null;

function initFirebase() {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    console.log("[Firebase] Initialized");
  }
  return app;
}

function getFirebaseApp() {
  if (!app) {
    throw new Error("[Firebase] Not initialized. Call initFirebase() first.");
  }
  return app;
}

export {
  initFirebase,
  getFirebaseApp
};