/**
 * Persistent storage for hidrix-tools.
 *
 * SQLite-backed storage for scraped posts, job configs, and run history.
 * Uses Bun's built-in SQLite (zero dependencies).
 *
 * DB location: ~/.hidrix-tools/data.db
 */

import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DATA_DIR = join(homedir(), ".hidrix-tools");
const DB_PATH = join(DATA_DIR, "data.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  // Create tables
  _db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      source TEXT,
      source_type TEXT,
      author TEXT,
      text TEXT,
      url TEXT,
      timestamp TEXT,
      reactions INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      score REAL DEFAULT 0,
      raw_json TEXT,
      scraped_at TEXT DEFAULT (datetime('now')),
      job_id TEXT
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tool TEXT NOT NULL,
      params TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      run_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      tool TEXT NOT NULL,
      status TEXT NOT NULL,
      items_count INTEGER DEFAULT 0,
      new_items INTEGER DEFAULT 0,
      duration_ms INTEGER,
      error TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    )
  `);

  // Indexes
  _db.run("CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)");
  _db.run("CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source)");
  _db.run("CREATE INDEX IF NOT EXISTS idx_posts_scraped ON posts(scraped_at)");
  _db.run("CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score DESC)");
  _db.run("CREATE INDEX IF NOT EXISTS idx_runs_job ON runs(job_id)");

  return _db;
}

// ── Posts ───────────────────────────────────────────────────

export interface StoredPost {
  id: string;
  platform: string;
  source?: string;
  source_type?: string;
  author?: string;
  text?: string;
  url?: string;
  timestamp?: string;
  reactions: number;
  comments: number;
  shares: number;
  score: number;
  raw_json?: string;
  scraped_at?: string;
  job_id?: string;
}

export function savePosts(posts: StoredPost[]): { saved: number; skipped: number } {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO posts (id, platform, source, source_type, author, text, url, timestamp, reactions, comments, shares, score, raw_json, job_id)
    VALUES ($id, $platform, $source, $source_type, $author, $text, $url, $timestamp, $reactions, $comments, $shares, $score, $raw_json, $job_id)
  `);

  let saved = 0;
  const tx = db.transaction(() => {
    for (const p of posts) {
      const result = insert.run({
        $id: p.id,
        $platform: p.platform,
        $source: p.source || null,
        $source_type: p.source_type || null,
        $author: p.author || null,
        $text: p.text || null,
        $url: p.url || null,
        $timestamp: p.timestamp || null,
        $reactions: p.reactions || 0,
        $comments: p.comments || 0,
        $shares: p.shares || 0,
        $score: p.score || 0,
        $raw_json: p.raw_json || null,
        $job_id: p.job_id || null,
      });
      if (result.changes > 0) saved++;
    }
  });
  tx();

  return { saved, skipped: posts.length - saved };
}

export function queryPosts(opts: {
  platform?: string;
  source?: string;
  minScore?: number;
  since?: string;
  limit?: number;
  orderBy?: "score" | "timestamp" | "scraped_at";
}): StoredPost[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (opts.platform) { conditions.push("platform = $platform"); params.$platform = opts.platform; }
  if (opts.source) { conditions.push("source LIKE $source"); params.$source = `%${opts.source}%`; }
  if (opts.minScore) { conditions.push("score >= $minScore"); params.$minScore = opts.minScore; }
  if (opts.since) { conditions.push("scraped_at >= $since"); params.$since = opts.since; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = opts.orderBy === "timestamp" ? "timestamp DESC" : opts.orderBy === "scraped_at" ? "scraped_at DESC" : "score DESC";
  const limit = opts.limit || 50;

  return db.prepare(`SELECT * FROM posts ${where} ORDER BY ${order} LIMIT ${limit}`).all(params) as StoredPost[];
}

export function getPostCount(platform?: string): number {
  const db = getDb();
  if (platform) {
    return (db.prepare("SELECT COUNT(*) as count FROM posts WHERE platform = ?").get(platform) as any).count;
  }
  return (db.prepare("SELECT COUNT(*) as count FROM posts").get() as any).count;
}

// ── Jobs ───────────────────────────────────────────────────

export interface Job {
  id: string;
  name: string;
  tool: string;
  params: string;
  schedule: string;
  enabled: number;
  last_run?: string;
  next_run?: string;
  run_count: number;
  error_count: number;
  last_error?: string;
  created_at: string;
}

export function saveJob(job: Omit<Job, "run_count" | "error_count" | "created_at">): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO jobs (id, name, tool, params, schedule, enabled, last_run, next_run)
    VALUES ($id, $name, $tool, $params, $schedule, $enabled, $last_run, $next_run)
  `).run({
    $id: job.id,
    $name: job.name,
    $tool: job.tool,
    $params: job.params,
    $schedule: job.schedule,
    $enabled: job.enabled,
    $last_run: job.last_run || null,
    $next_run: job.next_run || null,
  });
}

export function getJobs(enabledOnly = false): Job[] {
  const db = getDb();
  const where = enabledOnly ? "WHERE enabled = 1" : "";
  return db.prepare(`SELECT * FROM jobs ${where} ORDER BY next_run`).all() as Job[];
}

export function updateJobRun(jobId: string, success: boolean, error?: string): void {
  const db = getDb();
  if (success) {
    db.prepare(`
      UPDATE jobs SET last_run = datetime('now'), run_count = run_count + 1 WHERE id = ?
    `).run(jobId);
  } else {
    db.prepare(`
      UPDATE jobs SET last_run = datetime('now'), error_count = error_count + 1, last_error = ? WHERE id = ?
    `).run(error || "unknown", jobId);
  }
}

// ── Runs ───────────────────────────────────────────────────

export function logRun(run: { id: string; job_id?: string; tool: string; status: string; items_count: number; new_items: number; duration_ms: number; error?: string }): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO runs (id, job_id, tool, status, items_count, new_items, duration_ms, error, finished_at)
    VALUES ($id, $job_id, $tool, $status, $items_count, $new_items, $duration_ms, $error, datetime('now'))
  `).run({
    $id: run.id,
    $job_id: run.job_id || null,
    $tool: run.tool,
    $status: run.status,
    $items_count: run.items_count,
    $new_items: run.new_items,
    $duration_ms: run.duration_ms,
    $error: run.error || null,
  });
}

export function getRecentRuns(limit = 10): any[] {
  const db = getDb();
  return db.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?").all(limit);
}

// ── Stats ──────────────────────────────────────────────────

export function getStats(): Record<string, any> {
  const db = getDb();
  const totalPosts = (db.prepare("SELECT COUNT(*) as c FROM posts").get() as any).c;
  const totalRuns = (db.prepare("SELECT COUNT(*) as c FROM runs").get() as any).c;
  const totalJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs").get() as any).c;
  const platforms = db.prepare("SELECT platform, COUNT(*) as c FROM posts GROUP BY platform ORDER BY c DESC").all();
  const recentRuns = getRecentRuns(5);

  return { totalPosts, totalRuns, totalJobs, platforms, recentRuns };
}
