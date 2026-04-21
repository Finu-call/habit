// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBnawc5E_olLW_ZW8zZRL0Tsi39041xKvY",
    authDomain: "kallan-29600.firebaseapp.com",
    databaseURL: "https://kallan-29600-default-rtdb.firebaseio.com",
    projectId: "kallan-29600",
    storageBucket: "kallan-29600.firebasestorage.app",
    messagingSenderId: "791158949236",
    appId: "1:791158949236:web:f4046690ac8f48a1151821"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
