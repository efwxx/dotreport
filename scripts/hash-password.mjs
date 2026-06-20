// Prints a bcrypt hash line for SCHEDULE_PASSWORD_HASH.
// Run: node scripts/hash-password.mjs "your password"
// Copy the output into .env.local and restart `next dev`.

import bcrypt from "bcryptjs";

const password = process.argv.slice(2).join(" ");
if (!password) {
  console.error('usage: node scripts/hash-password.mjs "your password"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
// Escape `$` so Next.js dotenv does not eat parts of the hash.
const escaped = hash.replace(/\$/g, "\\$");
console.log(`SCHEDULE_PASSWORD_HASH=${escaped}`);
