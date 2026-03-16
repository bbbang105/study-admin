import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

let initialized = false;

function ensureInitialized(): boolean {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return true;
  }

  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`,
    };

    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Required Firebase environment variables are missing');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });

    console.log('[Firebase] Admin SDK initialized successfully');
    initialized = true;
    return true;
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase Admin:', error);
    return false;
  }
}

export function getAdminMessaging() {
  if (!ensureInitialized()) {
    return null;
  }
  return admin.messaging();
}
