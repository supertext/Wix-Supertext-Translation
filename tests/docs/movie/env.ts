/**
 * The demo for the movies: the stand-in Wix and Supertext APIs (real translations of the sample
 * site, tests/standin/samples.json) and the app in-process, set up like tests/docs/screenshots.ts.
 * Nothing reaches Wix, Supertext or the Commando Center.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { AddressInfo } from 'node:net';
import { signInstance } from '../../../src/auth/instance.js';
import { createApp } from '../../../src/app.js';
import { loadConfig } from '../../../src/config.js';
import { MemoryStore } from '../../../src/store/store.js';
import { createSupertextStandin } from '../../standin/supertext.js';
import { createWixStandin } from '../../standin/wix.js';

const listen = (fetch: (request: Request) => Response | Promise<Response>, port = 0) =>
  new Promise<string>((resolve) => {
    const server = serve({ fetch, port, hostname: '127.0.0.1' }, () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });

const SECRET = 'movie-secret';
const INSTANCE = '7c3e1d2a-5b4f-4e6a-9c8d-0f1e2d3c4b5a';

/**
 * Starts the stand-ins and the app on MOVIE_PORT (default 8798) and returns a function that builds
 * the dashboard page's URL the way Wix opens it (signed instance, dashboard language English).
 * `statusDelayMs` holds every status answer of the Supertext stand-in, so the waiting state is
 * visible (the movie cuts the wait).
 */
export async function startDemo({ statusDelayMs = 0 } = {}) {
  const wix = createWixStandin();
  const supertext = createSupertextStandin();
  const supertextHandle = async (request: Request) => {
    if (statusDelayMs && /\/status$/.test(new URL(request.url).pathname)) await new Promise((r) => setTimeout(r, statusDelayMs));
    return supertext.handle(request);
  };
  const wixUrl = await listen((request) => wix.handle(request));
  const supertextUrl = await listen(supertextHandle);
  // Translation review: a second stand-in address, never Supertext's real review service.
  const reviewUrl = await listen(supertextHandle);
  const store = new MemoryStore();
  const app = createApp({
    config: loadConfig({
      WIX_APP_ID: 'movie',
      WIX_APP_SECRET: SECRET,
      WIX_API_BASE: wixUrl,
      SUPERTEXT_API_ENDPOINT: `${supertextUrl}/v1/`,
      SUPERTEXT_REVIEW_URL: `${reviewUrl}/v1/`,
      // Version reports go to the stand-in, never to the live Commando Center.
      SUPERTEXT_REPORT_URL: `${supertextUrl}/report`,
    }),
    store,
  });
  app.use('/static/*', serveStatic({ root: new URL('../../../public/', import.meta.url).pathname, rewriteRequestPath: (path) => path.replace(/^\/static/, '') }));
  const appUrl = await listen(app.fetch, Number(process.env.MOVIE_PORT || 8798));
  const instance = signInstance({ instanceId: INSTANCE, uid: 'editor', permissions: 'OWNER', siteOwnerId: 'editor' }, SECRET);
  const url = (path: string, params: Record<string, string> = {}) =>
    `${appUrl}${path}?${new URLSearchParams({ instance, locale: 'en', ...params })}`;
  return { url, wix, store };
}
