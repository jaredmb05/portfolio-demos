// Compare the Preview & Copy HTML captured by two desk_capture.sh runs, byte for byte.
//   node tests/compare_emails.js audit/before audit/after
// Exits 1 if any template's HTML differs or is missing from either run.
import fs from 'node:fs';
import path from 'node:path';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: node tests/compare_emails.js <run-dir-1> <run-dir-2>'); process.exit(2); }
const load = d => JSON.parse(fs.readFileSync(path.join(d, 'capture.json'), 'utf8')).emails || {};
const A = load(a), B = load(b);
const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
let bad = 0;
for (const k of keys) {
  const same = k in A && k in B && A[k] === B[k];
  if (!same) bad++;
  console.log(`${same ? 'same' : 'DIFF'}  ${k}${!(k in A) ? ` (missing in ${a})` : !(k in B) ? ` (missing in ${b})` : ''}`);
}
console.log(`\n${keys.length - bad}/${keys.length} templates identical`);
process.exit(bad ? 1 : 0);
