const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json"); // Download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://ding-app-fe465.firebasestorage.app", // Change this to your Firebase Storage Bucket
});

const bucket = admin.storage().bucket();
module.exports = bucket;
