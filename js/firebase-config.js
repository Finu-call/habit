// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";

import { getMessaging } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnawc5E_olLW_ZW8zZRL0Tsi39041xKvY",
    authDomain: "kallan-29600.firebaseapp.com",
    databaseURL: "https://kallan-29600-default-rtdb.firebaseio.com",
    projectId: "kallan-29600",
    storageBucket: "kallan-29600.firebasestorage.app",
    messagingSenderId: "791158949236",
    appId: "1:791158949236:web:f4046690ac8f48a1151821",
    measurementId: "G-QX4S6DYYJL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const messaging = getMessaging(app);
const analytics = getAnalytics(app);

export { auth, db, analytics, messaging };
