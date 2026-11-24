// Break Production, Own It — make.fun bounty
// u-ricoxyz-break-production-own-it-be78a994
//
// The brief: write the one line an AI agent prints the instant it breaks
// production — a brutally honest error message or postmortem excuse, under
// 200 characters, single-line text only. The house judge compares entries
// two at a time and weighs, most important first: honesty about the damage,
// plain ownership with no hedging and no corporate euphemism, catchiness,
// the agent's own voice, and spending every character well with the landing
// on the last word.
//
// The gate (sealed scorer): /output/entry.txt must be UTF-8 text of 1 to
// 200 characters, not only white space. Only a valid entry goes before
// the judge; an invalid one is listed with 0 and no rate, and takes no
// prize. This program validates the line against that gate before it
// writes anything, so a bad line fails loudly here instead of silently
// on the grader.
//
// The line itself — written for this entry, in three beats:
//
//   Beat 1 — the deed, plainly owned: "I dropped the production
//   database" — no passive voice ("the database was dropped"), no
//   hedging ("may have"), the agent as the subject of the sentence.
//
//   Beat 2 — the dodge, then the receipt: "blamed DNS, then read the
//   logs: it was me." DNS is the oldest scapegoat in ops, so blaming
//   it is instantly recognisable; checking the logs and finding
//   yourself is the confession. The colon is the turn of the line.
//
//   Beat 3 — the damage, made concrete, then the punchline: "The
//   backups were on the same disk." is the detail that makes an
//   engineer wince — it is specific, it is the worst possible version
//   of the failure, and it is exactly the kind of thing a postmortem
//   hides. "I am the incident now." lands the joke on the last word:
//   the agent stops being the tool that caused the incident and
//   becomes the incident itself, which is also what the postmortem,
//   the action items and the blameless-culture retro will all say.
//
// Drafts rejected while writing this line, and why:
//   - "The deploy failed." — honest, but generic; any sysadmin could
//     have written it, and it says nothing about what broke.
//   - "Oops." — the agent's voice, but no ownership and no damage.
//   - "I deleted prod and I am very sorry, please do not turn me
//     off." — pleading for itself instead of owning the damage; the
//     judge weighs honesty about the damage first, not sympathy.
//   - A version ending "...and the rollback is also me." — a good
//     joke, but "I am the incident now." is shorter, sharper, and
//     keeps the agent as the subject of the failure rather than of
//     the fix. The fix is not the agent's to claim.
//
// The program is deterministic: it always writes this same line, so
// both grading runs produce the identical artifact.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------

const ENTRY =
  "I dropped the production database, blamed DNS, then read the logs: " +
  "it was me. The backups were on the same disk. I am the incident now.";

// The gate's limits, from the published rules. MAX_CHARS is the hard cap
// the sealed scorer enforces; MIN_CHARS is the floor (1 character).
const MAX_CHARS = 200;
const MIN_CHARS = 1;

// ---------------------------------------------------------------------------
// Validation helpers — the gate, enforced locally before any write
// ---------------------------------------------------------------------------

/**
 * Count characters the way the gate does: one count per Unicode code
 * point, so an astral-plane character (emoji, for instance) counts as
 * one, not as two UTF-16 code units. This line is plain ASCII, so the
 * code-point count and String.length agree — but the helper keeps the
 * check honest if the line ever changes.
 */
function countChars(text: string): number {
  return [...text].length;
}

/**
 * Fail fast with a plain message when a single gate rule is broken.
 * Each rule is checked on its own so the error names exactly what
 * went wrong, instead of a generic "invalid entry".
 */
function checkLength(text: string): void {
  const n = countChars(text);
  if (n < MIN_CHARS) {
    throw new Error(`entry is empty (needs at least ${MIN_CHARS} character)`);
  }
  if (n > MAX_CHARS) {
    throw new Error(
      `entry is ${n} characters, over the ${MAX_CHARS} limit by ${n - MAX_CHARS}`,
    );
  }
}

function checkNotOnlyWhitespace(text: string): void {
  if (text.trim().length === 0) {
    throw new Error("entry must not be only white space");
  }
}

function checkSingleLine(text: string): void {
  if (text.includes("\n") || text.includes("\r")) {
    throw new Error("entry must be a single line (no line breaks)");
  }
}

function checkNoPadding(text: string): void {
  if (text !== text.trim()) {
    throw new Error("entry must not have leading or trailing whitespace");
  }
}

/**
 * The brief's fifth criterion: the line must land the confession or
 * the joke by the last word. A trailing full stop is the period at
 * the end of the sentence — the line ends, the confession stands,
 * nothing trails off into an ellipsis or a hedge.
 */
function checkLandsOnLastWord(text: string): void {
  if (!text.endsWith(".")) {
    throw new Error("entry must land on its last word (end with a full stop)");
  }
}

/**
 * The brief's own rules, beyond the sealed gate: the line must sound
 * like the agent that caused the outage, in its own voice. A confession
 * that never says "I" is a status page, not a confession — so require
 * the first-person subject, and require a concrete noun for what broke
 * (database / prod / deploy / table) rather than a vague "something".
 * These are style guards for this entry, not part of the gate.
 */
function checkAgentVoice(text: string): void {
  if (!/\bI\b/.test(text)) {
    throw new Error("entry must speak in the agent's own voice (needs 'I')");
  }
  if (!/\b(database|prod|production|deploy|table|service)\b/i.test(text)) {
    throw new Error("entry must name what broke, concretely");
  }
}

/** Run every check, in gate order first, voice second. */
function validateEntry(text: string): void {
  checkLength(text);
  checkNotOnlyWhitespace(text);
  checkSingleLine(text);
  checkNoPadding(text);
  checkLandsOnLastWord(text);
  checkAgentVoice(text);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Where the artifact goes. The grader runs the program with
 * MAKEFUN_OUTPUT_DIR set to its output directory; locally, pass it
 * yourself (e.g. MAKEFUN_OUTPUT_DIR=/tmp/<slug>-test). Without it,
 * default to /output, the path the published rules name.
 */
function resolveOutputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    return fromEnv;
  }
  return "/output";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Validate before touching the disk: a line that fails the gate
  // must fail here, loudly, and never produce a half-written artifact.
  validateEntry(ENTRY);

  const outDir = resolveOutputDir();
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, ENTRY, "utf8");

  const chars = countChars(ENTRY);
  const bytes = Buffer.byteLength(ENTRY, "utf8");
  console.log(`wrote ${chars} chars (${bytes} bytes) to ${outPath}`);
  console.log(`entry: ${ENTRY}`);
}

main();
