import pg from 'pg';
import type { ErrorInfo } from '../i18n/error.js';
import { defaultSettings, type Job, type Secrets, type SiteSettings, type Store } from './store.js';

/**
 * PostgreSQL store (the shared Railway Postgres; its own database, created on
 * first start). Two tables: site settings (with the Commando Center reporter's
 * state per site in `reporter_state`) and translation jobs. Columns added later
 * are added with ALTER TABLE … IF NOT EXISTS, so existing databases migrate on start.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS site_settings (
  instance_id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'default',
  publish BOOLEAN NOT NULL DEFAULT TRUE,
  language_codes JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS translation_jobs (
  id UUID PRIMARY KEY,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_jobs_instance ON translation_jobs (instance_id, created_at DESC);
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS version_reports BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS reporter_state JSONB;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS review_locales JSONB NOT NULL DEFAULT '[]'::jsonb;
`;

/** Creates the database named in the URL if it doesn't exist (the shared server has several). */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name || name === 'postgres') return;
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
      console.log(`Created database ${name}.`);
    }
  } finally {
    await admin.end();
  }
}

export class PostgresStore implements Store {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string, private readonly secrets: Secrets) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  }

  async migrate(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async getSettings(instanceId: string): Promise<SiteSettings> {
    const { rows } = await this.pool.query(
      'SELECT api_key, tone, publish, language_codes, review_locales, version_reports FROM site_settings WHERE instance_id = $1',
      [instanceId],
    );
    if (rows.length === 0) return defaultSettings(instanceId);
    const row = rows[0];
    return {
      instanceId,
      apiKey: this.secrets.decrypt(row.api_key),
      tone: row.tone,
      publish: row.publish,
      languageCodes: row.language_codes ?? {},
      reviewLocales: Array.isArray(row.review_locales) ? row.review_locales : [],
      versionReports: row.version_reports ?? true,
    };
  }

  async saveSettings(settings: SiteSettings): Promise<void> {
    await this.pool.query(
      `INSERT INTO site_settings (instance_id, api_key, tone, publish, language_codes, version_reports, review_locales, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (instance_id) DO UPDATE SET api_key = $2, tone = $3, publish = $4, language_codes = $5, version_reports = $6, review_locales = $7, updated_at = now()`,
      [
        settings.instanceId,
        this.secrets.encrypt(settings.apiKey),
        settings.tone,
        settings.publish,
        settings.languageCodes,
        settings.versionReports,
        JSON.stringify(settings.reviewLocales ?? []),
      ],
    );
  }

  async getReporterState(instanceId: string): Promise<unknown> {
    const { rows } = await this.pool.query('SELECT reporter_state FROM site_settings WHERE instance_id = $1', [instanceId]);
    return rows[0]?.reporter_state ?? null;
  }

  /** Only the reporter's column; a site that never saved its settings gets a row with the defaults. */
  async saveReporterState(instanceId: string, state: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO site_settings (instance_id, reporter_state) VALUES ($1, $2)
       ON CONFLICT (instance_id) DO UPDATE SET reporter_state = $2`,
      [instanceId, JSON.stringify(state)],
    );
  }

  async deleteSite(instanceId: string): Promise<void> {
    await this.pool.query('DELETE FROM site_settings WHERE instance_id = $1', [instanceId]);
    await this.pool.query('DELETE FROM translation_jobs WHERE instance_id = $1', [instanceId]);
  }

  async saveJob(job: Job): Promise<void> {
    await this.pool.query(
      `INSERT INTO translation_jobs (id, instance_id, status, data, created_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET status = $3, data = $4`,
      [job.id, job.instanceId, job.status, job, job.createdAt],
    );
  }

  async getJob(instanceId: string, id: string): Promise<Job | undefined> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
    const { rows } = await this.pool.query('SELECT data FROM translation_jobs WHERE id = $1 AND instance_id = $2', [
      id,
      instanceId,
    ]);
    return rows[0]?.data;
  }

  async latestJob(instanceId: string): Promise<Job | undefined> {
    const { rows } = await this.pool.query(
      'SELECT data FROM translation_jobs WHERE instance_id = $1 ORDER BY created_at DESC LIMIT 1',
      [instanceId],
    );
    return rows[0]?.data;
  }

  async failRunningJobs(error: ErrorInfo): Promise<void> {
    const { rows } = await this.pool.query("SELECT data FROM translation_jobs WHERE status = 'running'");
    for (const row of rows) {
      const job = row.data as Job;
      await this.saveJob({ ...job, status: 'failed', error, finishedAt: new Date().toISOString() });
    }
  }
}
