import { execSync } from 'child_process';
import path from 'path';

const testFiles = [
  { name: 'Step 3: Real-Time Engine', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step3_engine.js', tests: 5 },
  { name: 'Step 4: Turn Guidance & Voice', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step4_integration.js', tests: 6 },
  { name: 'Step 5: Visual Navigation HUD', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step5_visual.js', tests: 14 },
  { name: 'Step 6: Advanced Layer', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step6_advanced.js', tests: 14 },
  { name: 'Step 7: Reliability & Recovery', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step7_reliability.js', tests: 32 },
  { name: 'Step 8: TFT Synchronization', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step8_sync.js', tests: 9 },
  { name: 'Step 9: Hardware Validation', file: 'C:/Users/AKASH/.gemini/antigravity-ide/brain/f7e288e2-7390-44cf-87bb-507d7920e750/scratch/test_step9_hardware_sync.js', tests: 17 },
  { name: 'Step 10: Navigation Accuracy', file: 'scratch/test_step10_navigation_accuracy.js', tests: 27 },
  { name: 'Step 11: Edge-Case Hardening', file: 'scratch/test_step11_edge_cases.js', tests: 25 },
  { name: 'Step 12: Production Hardening', file: 'scratch/test_step12_production.js', tests: 20 },
];

console.log('================================================================');
console.log('🚀 RUNNING COMPLETE SMART BIKE MASTER SUITE (STEPS 3 TO 12)');
console.log('================================================================\n');

let totalPassedTests = 0;
let totalExpectedTests = 0;
let allSuitesPassed = true;

for (const suite of testFiles) {
  process.stdout.write(`⏳ Running ${suite.name} (${suite.tests} tests)... `);
  try {
    execSync(`node "${suite.file}"`, { cwd: 'c:/Users/AKASH/Desktop/Bike', stdio: 'pipe' });
    console.log(`✅ PASS (${suite.tests}/${suite.tests})`);
    totalPassedTests += suite.tests;
    totalExpectedTests += suite.tests;
  } catch (err) {
    console.log(`❌ FAIL!`);
    console.error(err.stdout ? err.stdout.toString() : err.message);
    allSuitesPassed = false;
    totalExpectedTests += suite.tests;
  }
}

console.log('\n================================================================');
console.log(`🏁 MASTER SUITE SUMMARY: ${totalPassedTests}/${totalExpectedTests} AUTOMATED TESTS PASS`);
console.log(`STATUS: ${allSuitesPassed ? '100% ALL TESTS PASSING' : 'SOME TESTS FAILED'}`);
console.log('================================================================\n');

if (!allSuitesPassed) {
  process.exit(1);
}
