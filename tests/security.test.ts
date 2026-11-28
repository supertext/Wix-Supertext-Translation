import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, PERMISSIONS_POLICY } from '../src/app.js';
import { Secrets } from '../src/store/store.js';
import { setup } from './helpers.js';

describe('security headers', () => {
  it('sends a strict Content-Security-Policy that still lets Wix frame the dashboard page', async () => {
    const env = setup();
    const response = await env.page('/');
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toBe(CONTENT_SECURITY_POLICY);
    for (const part of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'none'", 'https://manage.wix.com']) {
      expect(csp).toContain(part);
    }
    expect(csp).not.toContain('unsafe-inline');
    expect(response.headers.get('permissions-policy')).toBe(PERMISSIONS_POLICY);
    expect(response.headers.get('cache-control')).toBe('no-cache, private');
  });
});

describe('Secrets', () => {
  const secrets = new Secrets('test secret');
  it('reads back what it encrypted and refuses shortened or changed tags', () => {
    const stored = secrets.encrypt('api-key-value');
    expect(secrets.decrypt(stored)).toBe('api-key-value');
    const [version, iv, tag, data] = stored.split(':');
    const short = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(secrets.decrypt([version, iv, short, data].join(':'))).toBe('');
    const changed = Buffer.from(tag, 'base64');
    changed[0] ^= 1;
    expect(secrets.decrypt([version, iv, changed.toString('base64'), data].join(':'))).toBe('');
  });
});
