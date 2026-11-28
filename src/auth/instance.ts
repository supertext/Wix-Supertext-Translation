import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Wix appends a signed app instance to every dashboard page URL
 * (`?instance=<signature>.<data>`): the data is base64url JSON, the signature
 * an HMAC-SHA256 of the data part with the app secret, base64url encoded.
 * https://dev.wix.com/docs/build-apps/develop-your-app/auth/app-instances/about-app-instances
 */

export interface AppInstance {
  instanceId: string;
  /** The Wix user who opened the dashboard. */
  uid?: string;
  /** "OWNER" or the collaborator's permission set. */
  permissions?: string;
  siteOwnerId?: string;
  signDate?: string;
  /** Set for anonymous visitors: never allowed into the dashboard. */
  aid?: string;
}

export class InstanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstanceError';
  }
}

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

/**
 * How long a signed instance opens the app: Wix signs a fresh one (`signDate`) every time it opens
 * the dashboard page, so an older one is a copied or leaked URL, or a tab left open for a day.
 */
export const INSTANCE_MAX_AGE_MS = 24 * 3600 * 1000;

/** Verifies and decodes a signed instance. Throws InstanceError if it isn't from Wix or too old. */
export function verifyInstance(signed: string | null | undefined, appSecret: string, now = Date.now()): AppInstance {
  if (!appSecret) {
    throw new InstanceError('WIX_APP_SECRET is not set.');
  }
  const value = (signed ?? '').trim();
  const dot = value.indexOf('.');
  if (dot <= 0 || dot === value.length - 1) {
    throw new InstanceError('Missing or malformed instance.');
  }
  const signature = value.slice(0, dot);
  const data = value.slice(dot + 1);
  const expected = base64url(createHmac('sha256', appSecret).update(data).digest());
  const given = Buffer.from(signature.replace(/=+$/, ''));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    throw new InstanceError('Invalid instance signature.');
  }
  let payload: AppInstance;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as AppInstance;
  } catch {
    throw new InstanceError('Unreadable instance data.');
  }
  if (!payload.instanceId) {
    throw new InstanceError('The instance has no instanceId.');
  }
  if (payload.aid && !payload.uid) {
    throw new InstanceError('Anonymous visitors cannot open the dashboard.');
  }
  // Wix always sets signDate; the signature covers it, so it can't be removed or changed.
  if (payload.signDate !== undefined) {
    const signed = Date.parse(payload.signDate);
    if (Number.isNaN(signed) || now - signed > INSTANCE_MAX_AGE_MS || signed - now > 5 * 60 * 1000) {
      throw new InstanceError('The instance has expired.');
    }
  }
  return payload;
}

/** Creates a signed instance, as Wix does. Used by tests, the stand-in and the screenshot script. */
export function signInstance(payload: AppInstance, appSecret: string): string {
  const data = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = base64url(createHmac('sha256', appSecret).update(data).digest());
  return `${signature}.${data}`;
}
