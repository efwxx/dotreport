// Server-only storage and types for /schedule.
// Each schedule is a JSON file at data/schedules/{id}.json.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data", "schedules");

// Slot length in minutes. Any integer 5..240.
export type SlotSizeMinutes = number;

export interface Question {
  id: string;
  prompt: string;
}

export interface Response {
  id: string;
  name: string;
  // ISO timestamp of last write.
  submittedAt: string;
  // questionId -> answer text.
  answers: Record<string, string>;
  // Sorted slot indices the player picked.
  picks: number[];
}

export interface Schedule {
  id: string;
  // Required to view the creator page.
  creatorToken: string;
  title: string;
  note?: string;
  // YYYY-MM-DD, in order.
  dates: string[];
  // "HH:MM" 24h.
  startTime: string;
  endTime: string;
  slotMinutes: SlotSizeMinutes;
  // Max responses, 2..12.
  playerCount: number;
  questions: Question[];
  responses: Response[];
  createdAt: string;
}

// Colors live in a separate file so client code can import them
// without pulling node modules into the browser bundle.
export { PLAYER_COLORS, colorForPlayer } from "./schedule-colors";

export function isValidPlayerCount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 2 && n <= 12;
}

// ---------- IDs ----------

export function newScheduleId(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function newCreatorToken(): string {
  return randomBytes(24).toString("hex");
}

export function newResponseId(): string {
  return randomBytes(8).toString("hex");
}

export function newQuestionId(): string {
  return randomBytes(4).toString("hex");
}

// ---------- Password ----------

export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = process.env.SCHEDULE_PASSWORD_HASH;
  if (!hash) return false;
  if (typeof plain !== "string" || plain.length === 0) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function isPasswordConfigured(): boolean {
  return Boolean(process.env.SCHEDULE_PASSWORD_HASH);
}

// ---------- Filesystem ----------

function fileFor(id: string): string {
  if (!/^[a-z0-9]{4,32}$/i.test(id)) {
    throw new Error("invalid schedule id");
  }
  return path.join(DATA_DIR, `${id}.json`);
}

export async function loadSchedule(id: string): Promise<Schedule | null> {
  try {
    const raw = await readFile(fileFor(id), "utf8");
    type LegacyResponse = Partial<Response> & { primarySlot?: number };
    const parsed = JSON.parse(raw) as Partial<Schedule> & {
      id: string;
      responses?: LegacyResponse[];
    };
    // Fill in defaults for older files.
    return {
      ...parsed,
      playerCount:
        typeof parsed.playerCount === "number" ? parsed.playerCount : 12,
      responses: (parsed.responses ?? []).map((r: LegacyResponse) => {
        // Old files had a separate primarySlot. Merge it into picks.
        const picks = new Set<number>(r.picks ?? []);
        if (typeof r.primarySlot === "number") picks.add(r.primarySlot);
        return {
          id: r.id!,
          name: r.name!,
          submittedAt: r.submittedAt!,
          answers: r.answers ?? {},
          picks: [...picks].sort((a, b) => a - b),
        } as Response;
      }),
    } as Schedule;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// Lists every schedule, newest first.
export async function listSchedules(): Promise<Schedule[]> {
  const { readdir, stat } = await import("node:fs/promises");
  let entries: string[];
  try {
    entries = await readdir(DATA_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const ids = entries
    .filter((e) => e.endsWith(".json"))
    .map((e) => e.replace(/\.json$/, ""));
  const withMtime = await Promise.all(
    ids.map(async (id) => {
      const s = await stat(path.join(DATA_DIR, `${id}.json`));
      return { id, mtimeMs: s.mtimeMs };
    }),
  );
  withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const out: Schedule[] = [];
  for (const { id } of withMtime) {
    const s = await loadSchedule(id);
    if (s) out.push(s);
  }
  return out;
}

// End of the schedule's last day. Used for cookie expiry.
export function scheduleExpiresAt(s: Schedule): Date {
  if (s.dates.length === 0) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  const lastDate = s.dates[s.dates.length - 1];
  return new Date(lastDate + "T23:59:59");
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(fileFor(schedule.id), JSON.stringify(schedule, null, 2));
}

// ---------- Slot math ----------

export interface SlotGrid {
  slotsPerDay: number;
  rowLabels: string[];
}

function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`bad time: ${s}`);
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) throw new Error(`bad time: ${s}`);
  return h * 60 + mm;
}

function fmtHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeGrid(s: Schedule): SlotGrid {
  const start = parseHHMM(s.startTime);
  let end = parseHHMM(s.endTime);
  // If end is at or before start, wrap to next day.
  if (end <= start) end += 24 * 60;
  const span = end - start;
  const slotsPerDay = Math.max(1, Math.floor(span / s.slotMinutes));
  const rowLabels: string[] = [];
  for (let i = 0; i < slotsPerDay; i++) {
    rowLabels.push(fmtHHMM(start + i * s.slotMinutes));
  }
  return { slotsPerDay, rowLabels };
}

// ---------- Aggregation ----------

export interface AggregatedSlot {
  slotIndex: number;
  count: number;
  names: string[];
}

export function aggregate(schedule: Schedule): AggregatedSlot[] {
  const { slotsPerDay } = computeGrid(schedule);
  const total = slotsPerDay * schedule.dates.length;
  const out: AggregatedSlot[] = [];
  for (let i = 0; i < total; i++) out.push({ slotIndex: i, count: 0, names: [] });
  for (const r of schedule.responses) {
    for (const p of r.picks) {
      if (p < 0 || p >= total) continue;
      out[p].count += 1;
      out[p].names.push(r.name);
    }
  }
  return out;
}

// ---------- Validators ----------

export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isValidSlotSize(n: unknown): n is SlotSizeMinutes {
  return typeof n === "number" && Number.isInteger(n) && n >= 5 && n <= 240;
}
