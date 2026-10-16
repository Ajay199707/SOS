import { config } from '../config.js';

// FCM wrapper: stub mode logs; production path requires FCM_SERVICE_ACCOUNT_PATH + firebase-admin install.
// Never claim delivery success until FCM acknowledges - callers record QUEUED then update on result.
export async function sendPush(tokens: string[], title: string, body: string, data: Record<string,string> = {}) {
  if (config.fcmStub || !tokens.length) {
    console.log('[FCM-STUB]', { tokens: tokens.length, title, body, data });
    return tokens.map(t => ({ token: t, status: 'STUB_QUEUED' as const }));
  }
  // Production: dynamically import firebase-admin to keep stub installs light
  // @ts-ignore - optional dependency, only needed when FCM_STUB=false
  const admin: any = await import('firebase-admin');
  if (!admin.apps.length) {
    const path = process.env.FCM_SERVICE_ACCOUNT_PATH!;
    admin.initializeApp({ credential: admin.credential.cert(path) });
  }
  const results = [];
  for (const token of tokens) {
    try {
      const id = await admin.messaging().send({ token, notification: { title, body }, data });
      results.push({ token, status: 'DELIVERED' as const, id });
    } catch (e: any) {
      results.push({ token, status: 'FAILED' as const, error: String(e.message) });
    }
  }
  return results;
}

export async function sendSmsFallback(to: string, text: string) {
  if (config.smsProvider === 'stub') {
    console.log('[SMS-STUB]', { to, text });
    return { status: 'STUB_QUEUED' as const };
  }
  // Production: plug Twilio here using TWILIO_* env vars. Keep concise alert + secure link, no auth tokens in URL.
  return { status: 'NOT_CONFIGURED' as const };
}
