importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDikjCEyALqPpQVGsXgS6Ot00FyvUc7QKM",
  authDomain: "gen-lang-client-0721128056.firebaseapp.com",
  projectId: "gen-lang-client-0721128056",
  storageBucket: "gen-lang-client-0721128056.firebasestorage.app",
  messagingSenderId: "265538834732",
  appId: "1:265538834732:web:e0f5d9ab9dad9d210bdc89"
});

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (error) {
  console.warn("[firebase-messaging-sw.js] Firebase Messaging is not supported in this browser:", error);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/favicon.ico'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

