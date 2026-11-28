/**
 * Runs the stand-in Wix API (port 8766) and the stand-in Supertext API (port
 * 8765) for local development, CI and the screenshots, and prints a signed
 * dashboard URL for the app.
 *
 *   npm run standin
 *   WIX_APP_ID=app WIX_APP_SECRET=standin-secret WIX_API_BASE=http://127.0.0.1:8766 \
 *   SUPERTEXT_API_ENDPOINT=http://127.0.0.1:8765/v1/ SUPERTEXT_API_KEY=any \
 *   SUPERTEXT_REPORT_URL=http://127.0.0.1:8765/report npm run dev
 *
 * (SUPERTEXT_REPORT_URL keeps version reports away from the live Commando Center.)
 */
import { serve } from '@hono/node-server';
import { signInstance } from '../../src/auth/instance.js';
import { createSupertextStandin } from './supertext.js';
import { createWixStandin } from './wix.js';

const wix = createWixStandin();
const supertext = createSupertextStandin();
const wixPort = Number(process.env.WIX_STANDIN_PORT || 8766);
const supertextPort = Number(process.env.SUPERTEXT_STANDIN_PORT || 8765);
const secret = process.env.WIX_APP_SECRET || 'standin-secret';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:8080';

serve({ fetch: (request) => wix.handle(request), port: wixPort, hostname: '127.0.0.1' });
serve({ fetch: (request) => supertext.handle(request), port: supertextPort, hostname: '127.0.0.1' });

const instance = signInstance(
  { instanceId: '7c3e1d2a-5b4f-4e6a-9c8d-0f1e2d3c4b5a', uid: 'standin-user', permissions: 'OWNER', siteOwnerId: 'standin-user', signDate: new Date().toISOString() },
  secret,
);
console.log(`Stand-in Wix API on http://127.0.0.1:${wixPort}, stand-in Supertext API on http://127.0.0.1:${supertextPort}/v1/ (reports: /report)`);
console.log(`Dashboard page: ${appUrl}/?instance=${instance}&locale=en`);
