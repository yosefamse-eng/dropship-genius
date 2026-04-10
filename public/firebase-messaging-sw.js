importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBjbfWR3voIaEC3uu7n96t7kzplm7xD9TM",
  authDomain: "dropshipgenius.firebaseapp.com",
  projectId: "dropshipgenius",
  storageBucket: "dropshipgenius.firebasestorage.app",
  messagingSenderId: "637457547823",
  appId: "1:637457547823:web:24aa79e0561ee67b54fcda"
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

