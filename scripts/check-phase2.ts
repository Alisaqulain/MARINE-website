// Phase 2 blueprint self-test from the command line: npm run check:phase2
// The same checks run on /test.
import { runPhase2SelfTest } from "../lib/ai/selftest.ts";

const results = runPhase2SelfTest();
let section = "";
for (const result of results) {
  if (result.section !== section) {
    section = result.section;
    console.log(`\n${section}`);
  }
  console.log(`  ${result.pass ? "PASS" : "FAIL"} ${result.name}${result.pass ? "" : ` — ${result.detail}`}`);
}
const failed = results.filter((result) => !result.pass).length;
console.log(`\nTOTAL ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
