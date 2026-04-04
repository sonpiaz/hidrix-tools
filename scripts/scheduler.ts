#!/usr/bin/env bun
/**
 * hidrix-tools Scheduler — runs scrape jobs on schedule.
 *
 * Usage:
 *   bun run scripts/scheduler.ts                    # Run scheduler daemon
 *   bun run scripts/scheduler.ts --list             # List all jobs
 *   bun run scripts/scheduler.ts --run-now <job_id> # Run a job immediately
 *   bun run scripts/scheduler.ts --add              # Add job interactively (see below)
 *
 * Add job via JSON:
 *   bun run scripts/scheduler.ts --add '{
 *     "name": "weekly-reddit-ml",
 *     "tool": "reddit_subreddit_top",
 *     "params": {"subreddit":"MachineLearning","time":"week","count":50},
 *     "schedule": "weekly"
 *   }'
 *
 * Schedules: "hourly", "daily", "weekly", "monthly", or cron-like "0 9 * * 1" (every Monday 9am)
 *
 * Config: ~/.hidrix-tools/jobs.json (auto-synced to SQLite)
 * Data: ~/.hidrix-tools/data.db
 * Logs: ~/.hidrix-tools/scheduler.log
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { getJobs, saveJob, updateJobRun, logRun, savePosts, type StoredPost } from "../lib/storage.js";
import { notify, hasNotifier } from "../lib/notifier.js";
import { createHash } from "node:crypto";

const DATA_DIR = join(homedir(), ".hidrix-tools");
const JOBS_FILE = join(DATA_DIR, "jobs.json");
const LOG_FILE = join(DATA_DIR, "scheduler.log");

// ── Logging ────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

// ── Schedule parsing ───────────────────────────────────────

function getIntervalMs(schedule: string): number {
  switch (schedule) {
    case "hourly": return 60 * 60 * 1000;
    case "daily": return 24 * 60 * 60 * 1000;
    case "weekly": return 7 * 24 * 60 * 60 * 1000;
    case "monthly": return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000; // default daily
  }
}

function isDue(job: any): boolean {
  if (!job.next_run) return true;
  return new Date(job.next_run).getTime() <= Date.now();
}

function calcNextRun(schedule: string): string {
  const next = new Date(Date.now() + getIntervalMs(schedule));
  return next.toISOString();
}

// ── Job execution ──────────────────────────────────────────

async function executeJob(job: any): Promise<void> {
  const runId = createHash("md5").update(`${job.id}-${Date.now()}`).digest("hex").slice(0, 12);
  const startMs = Date.now();

  log(`Running job: ${job.name} (${job.tool})`);

  try {
    // Dynamically load the tool
    const toolDir = job.tool.replace(/_/g, "-");
    const toolPath = join(import.meta.dir, "..", "tools", toolDir, "index.ts");
    const mod = await import(toolPath);
    const def = mod.definition;

    if (!def?.execute) throw new Error(`Tool ${job.tool} has no execute function`);

    // Parse params
    const params = typeof job.params === "string" ? JSON.parse(job.params) : job.params;

    // Execute tool
    const result = await def.execute(params);
    const elapsed = Date.now() - startMs;

    // Try to extract posts from result for storage
    let itemsCount = 0;
    let newItems = 0;

    // If result contains structured data, try to save it
    const jsonMatch = result.match(/<json>\n([\s\S]*?)\n<\/json>/);
    if (jsonMatch) {
      try {
        const posts = JSON.parse(jsonMatch[1]);
        if (Array.isArray(posts)) {
          const storedPosts: StoredPost[] = posts.map((p: any) => ({
            id: p.id || createHash("md5").update(`${p.url || ""}|${p.text?.slice(0, 100) || ""}`).digest("hex").slice(0, 16),
            platform: p.source_type || p.platform || job.tool.split("_")[0],
            source: p.source || "",
            source_type: p.source_type || "",
            author: p.author || "",
            text: p.text || "",
            url: p.url || "",
            timestamp: p.timestamp || "",
            reactions: Number(p.reactions) || 0,
            comments: Number(p.comments) || 0,
            shares: Number(p.shares) || 0,
            score: p.score || (Number(p.reactions) || 0) + (Number(p.comments) || 0) * 3 + (Number(p.shares) || 0) * 5,
            job_id: job.id,
          }));
          const saveResult = savePosts(storedPosts);
          itemsCount = storedPosts.length;
          newItems = saveResult.saved;
        }
      } catch {}
    }

    // Log the run
    logRun({ id: runId, job_id: job.id, tool: job.tool, status: "ok", items_count: itemsCount, new_items: newItems, duration_ms: elapsed });
    updateJobRun(job.id, true);

    // Update next run
    saveJob({ ...job, last_run: new Date().toISOString(), next_run: calcNextRun(job.schedule) });

    log(`✅ Job ${job.name} completed: ${itemsCount} items (${newItems} new) in ${elapsed}ms`);

    // Notify if new items found and notifier configured
    if (newItems > 0 && hasNotifier()) {
      await notify({
        title: `📊 ${job.name}`,
        body: `${newItems} new posts found (${itemsCount} total). Tool: ${job.tool}`,
        priority: newItems > 10 ? "high" : "normal",
      });
    }
  } catch (e: any) {
    const elapsed = Date.now() - startMs;
    log(`❌ Job ${job.name} failed: ${e.message}`);
    logRun({ id: runId, job_id: job.id, tool: job.tool, status: "error", items_count: 0, new_items: 0, duration_ms: elapsed, error: e.message });
    updateJobRun(job.id, false, e.message);
    saveJob({ ...job, last_run: new Date().toISOString(), next_run: calcNextRun(job.schedule) });

    if (hasNotifier()) {
      await notify({ title: `❌ Job failed: ${job.name}`, body: e.message, priority: "high" });
    }
  }
}

// ── Load jobs from config file ─────────────────────────────

function loadJobsFromFile(): void {
  if (!existsSync(JOBS_FILE)) return;

  try {
    const content = readFileSync(JOBS_FILE, "utf8");
    const jobs = JSON.parse(content);
    if (!Array.isArray(jobs)) return;

    for (const job of jobs) {
      if (!job.id || !job.name || !job.tool || !job.schedule) continue;
      saveJob({
        id: job.id,
        name: job.name,
        tool: job.tool,
        params: typeof job.params === "string" ? job.params : JSON.stringify(job.params),
        schedule: job.schedule,
        enabled: job.enabled ?? 1,
        last_run: job.last_run,
        next_run: job.next_run || calcNextRun(job.schedule),
      });
    }
    log(`Loaded ${jobs.length} jobs from ${JOBS_FILE}`);
  } catch (e: any) {
    log(`Error loading jobs: ${e.message}`);
  }
}

// ── CLI commands ───────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--list")) {
  const jobs = getJobs();
  if (jobs.length === 0) {
    console.log("No jobs configured. Add jobs to ~/.hidrix-tools/jobs.json");
  } else {
    console.log(`\nScheduled jobs (${jobs.length}):\n`);
    for (const j of jobs) {
      const status = j.enabled ? "✅" : "⏸️";
      console.log(`${status} ${j.id} | ${j.name} | ${j.tool} | ${j.schedule} | runs: ${j.run_count} | next: ${j.next_run || "now"}`);
    }
  }
  process.exit(0);
}

if (args.includes("--add")) {
  const jsonStr = args[args.indexOf("--add") + 1];
  if (!jsonStr) {
    console.log("Usage: bun run scripts/scheduler.ts --add '{\"name\":\"...\",\"tool\":\"...\",\"params\":{},\"schedule\":\"weekly\"}'");
    process.exit(1);
  }
  try {
    const job = JSON.parse(jsonStr);
    const id = job.id || createHash("md5").update(job.name).digest("hex").slice(0, 8);
    saveJob({
      id,
      name: job.name,
      tool: job.tool,
      params: typeof job.params === "string" ? job.params : JSON.stringify(job.params),
      schedule: job.schedule,
      enabled: 1,
      next_run: calcNextRun(job.schedule),
    });
    console.log(`✅ Job added: ${id} — ${job.name} (${job.schedule})`);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
  process.exit(0);
}

if (args.includes("--run-now")) {
  const jobId = args[args.indexOf("--run-now") + 1];
  if (!jobId) { console.log("Usage: --run-now <job_id>"); process.exit(1); }
  const jobs = getJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) { console.log(`Job not found: ${jobId}`); process.exit(1); }
  await executeJob(job);
  process.exit(0);
}

// ── Daemon mode ────────────────────────────────────────────

log("🚀 hidrix-tools scheduler starting");
log(`DB: ${join(DATA_DIR, "data.db")}`);
log(`Jobs config: ${JOBS_FILE}`);
log(`Notifications: ${hasNotifier() ? "configured" : "not configured"}`);

// Load jobs from file
loadJobsFromFile();

// Check interval: every 60 seconds
const CHECK_INTERVAL = 60_000;

async function tick() {
  const jobs = getJobs(true); // enabled only
  for (const job of jobs) {
    if (isDue(job)) {
      await executeJob(job);
    }
  }
}

// Initial check
await tick();

// Loop
log(`Scheduler running. Checking every ${CHECK_INTERVAL / 1000}s. Press Ctrl+C to stop.`);
setInterval(tick, CHECK_INTERVAL);
