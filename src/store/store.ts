import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ErrorInfo } from '../i18n/error.js';
import type { Politeness } from '../supertext/index.js';

/** Per-site settings, keyed by the Wix app instance ID. */
export interface SiteSettings {
  instanceId: string;
  /** The site's own Supertext API key ('' = use SUPERTEXT_API_KEY). */
  apiKey: string;
  tone: Politeness;
  /** Mark translations as ready to publish (true) or leave them for review in the Translation Manager. */
  publish: boolean;
  /** Wix locale ID → Supertext code (Settings → Languages); one mapping for both directions. */
  languageCodes: Record<string, string>;
  /** Wix locale IDs with *Translation review* on (Settings → Languages): translated through Supertext's review service. */
  reviewLocales: string[];
  /** "Send version information to Supertext" (on by default; SUPERTEXT_VERSION_REPORTS=0 turns it off for all sites). */
  versionReports: boolean;
}

export const defaultSettings = (instanceId: string): SiteSettings => ({
  instanceId,
  apiKey: '',
  tone: 'default',
  publish: true,
  languageCodes: {},
  reviewLocales: [],
  versionReports: true,
});

export type ItemState = 'translated' | 'unchanged' | 'failed';

export interface JobItem {
  entityId: string;
  title: string;
  locale: string;
  state: ItemState;
  written: number;
  kept: number;
  tooLong: number;
  error?: ErrorInfo;
}

export interface Job {
  id: string;
  instanceId: string;
  status: 'running' | 'done' | 'failed';
  schemaId: string;
  entityIds: string[];
  locales: string[];
  overwrite: boolean;
  total: number;
  items: JobItem[];
  /** Set when the whole job stopped (authentication, limit, Wix errors). */
  error?: ErrorInfo;
  createdAt: string;
  finishedAt?: string;
}

export interface Store {
  getSettings(instanceId: string): Promise<SiteSettings>;
  saveSettings(settings: SiteSettings): Promise<void>;
  deleteSite(instanceId: string): Promise<void>;
  /** The Commando Center reporter's state of a site (plain JSON, as the SDK returns it); null if none yet. */
  getReporterState(instanceId: string): Promise<unknown>;
  saveReporterState(instanceId: string, state: unknown): Promise<void>;
  saveJob(job: Job): Promise<void>;
  getJob(instanceId: string, id: string): Promise<Job | undefined>;
  latestJob(instanceId: string): Promise<Job | undefined>;
  /** Jobs still "running" after a restart are marked failed. */
  failRunningJobs(error: ErrorInfo): Promise<void>;
}

export const newJobId = (): string => randomUUID();

/** AES-256-GCM for stored API keys. */
export class Secrets {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret) throw new Error('An encryption key or the Wix app secret is required.');
    this.key = createHash('sha256').update(`supertext-wix:${secret}`).digest();
  }

  encrypt(value: string): string {
    if (!value) return '';
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  decrypt(value: string): string {
    if (!value) return '';
    const [version, iv, tag, data] = value.split(':');
    if (version !== 'v1' || !iv || !tag || !data) return '';
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      return '';
    }
  }
}

/** In-memory store: tests, local development without a database, screenshots. */
export class MemoryStore implements Store {
  private readonly settings = new Map<string, SiteSettings>();
  private readonly jobs = new Map<string, Job>();
  private readonly reporter = new Map<string, unknown>();

  async getSettings(instanceId: string): Promise<SiteSettings> {
    return structuredClone(this.settings.get(instanceId) ?? defaultSettings(instanceId));
  }

  async saveSettings(settings: SiteSettings): Promise<void> {
    this.settings.set(settings.instanceId, structuredClone(settings));
  }

  async getReporterState(instanceId: string): Promise<unknown> {
    return structuredClone(this.reporter.get(instanceId) ?? null);
  }

  async saveReporterState(instanceId: string, state: unknown): Promise<void> {
    this.reporter.set(instanceId, structuredClone(state));
  }

  async deleteSite(instanceId: string): Promise<void> {
    this.settings.delete(instanceId);
    this.reporter.delete(instanceId);
    for (const [id, job] of this.jobs) if (job.instanceId === instanceId) this.jobs.delete(id);
  }

  async saveJob(job: Job): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
  }

  async getJob(instanceId: string, id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    return job && job.instanceId === instanceId ? structuredClone(job) : undefined;
  }

  async latestJob(instanceId: string): Promise<Job | undefined> {
    const jobs = [...this.jobs.values()].filter((job) => job.instanceId === instanceId);
    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return jobs[0] ? structuredClone(jobs[0]) : undefined;
  }

  async failRunningJobs(error: ErrorInfo): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.status === 'running') Object.assign(job, { status: 'failed', error, finishedAt: new Date().toISOString() });
    }
  }
}
