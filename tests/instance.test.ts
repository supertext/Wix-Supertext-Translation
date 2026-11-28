import { describe, expect, it } from 'vitest';
import { INSTANCE_MAX_AGE_MS, signInstance, verifyInstance } from '../src/auth/instance.js';

describe('signed app instance', () => {
  const secret = 'secret';
  const payload = { instanceId: 'abc', uid: 'u1', permissions: 'OWNER' };

  it('accepts what Wix signs with the app secret', () => {
    expect(verifyInstance(signInstance(payload, secret), secret)).toMatchObject(payload);
  });

  it('rejects another secret, tampered data and garbage', () => {
    const signed = signInstance(payload, secret);
    expect(() => verifyInstance(signed, 'other')).toThrow(/signature/);
    const [signature] = signed.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, instanceId: 'xyz' })).toString('base64url');
    expect(() => verifyInstance(`${signature}.${forged}`, secret)).toThrow(/signature/);
    expect(() => verifyInstance('nonsense', secret)).toThrow(/malformed/);
    expect(() => verifyInstance(undefined, secret)).toThrow(/malformed/);
  });

  it('keeps anonymous visitors out', () => {
    expect(() => verifyInstance(signInstance({ instanceId: 'abc', aid: 'visitor' }, secret), secret)).toThrow(/Anonymous/);
  });

  it('opens the app for a day after Wix signed the instance, not longer', () => {
    const now = Date.parse('2026-12-01T09:00:00Z');
    const at = (offsetMs: number) => signInstance({ instanceId: 'abc', uid: 'u', signDate: new Date(now + offsetMs).toISOString() }, secret);
    expect(verifyInstance(at(-(INSTANCE_MAX_AGE_MS - 60_000)), secret, now)).toMatchObject({ instanceId: 'abc' });
    expect(() => verifyInstance(at(-(INSTANCE_MAX_AGE_MS + 60_000)), secret, now)).toThrow(/expired/);
    expect(() => verifyInstance(at(10 * 60_000), secret, now)).toThrow(/expired/);
    expect(() => verifyInstance(signInstance({ instanceId: 'abc', uid: 'u', signDate: 'soon' }, secret), secret, now)).toThrow(/expired/);
  });

  it('needs the app secret', () => {
    expect(() => verifyInstance(signInstance(payload, secret), '')).toThrow(/WIX_APP_SECRET/);
  });
});
