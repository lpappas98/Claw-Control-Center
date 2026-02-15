#!/usr/bin/env node

/**
 * Comprehensive test runner for Claw Control Center
 * 
 * Runs all Playwright tests and:
 * 1. Parses JSON reporter output
 * 2. Extracts pass/fail/skip counts
 * 3. POSTs results to work data API
 * 4. Displays summary
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '..');
const resultsFile = path.join(workspaceRoot, 'test-results', 'results.json');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureDirectories() {
  const dirs = [
    path.join(workspaceRoot, 'test-results'),
    path.join(workspaceRoot, 'test-results', 'screenshots'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function runTests() {
  log('\n🧪 Running Playwright tests...\n', 'cyan');
  
  try {
    execSync('npx playwright test', {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
    
    return true;
  } catch (error) {
    // Tests may fail, but we still want to parse results
    log('\n⚠️  Some tests failed, but continuing to parse results...\n', 'yellow');
    return false;
  }
}

function parseResults() {
  log('\n📊 Parsing test results...\n', 'blue');
  
  if (!fs.existsSync(resultsFile)) {
    log(`❌ Results file not found: ${resultsFile}`, 'red');
    return null;
  }
  
  const rawData = fs.readFileSync(resultsFile, 'utf-8');
  const results = JSON.parse(rawData);
  
  // Parse Playwright JSON format
  const summary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    suites: [],
  };
  
  if (results.suites) {
    results.suites.forEach(suite => {
      processSuite(suite, summary);
    });
  }
  
  summary.total = summary.passed + summary.failed + summary.skipped;
  
  return summary;
}

function processSuite(suite, summary) {
  if (suite.specs) {
    suite.specs.forEach(spec => {
      if (spec.tests) {
        spec.tests.forEach(test => {
          if (test.results) {
            test.results.forEach(result => {
              summary.duration += result.duration || 0;
              
              if (result.status === 'passed') {
                summary.passed++;
              } else if (result.status === 'failed') {
                summary.failed++;
              } else if (result.status === 'skipped') {
                summary.skipped++;
              }
            });
          }
        });
      }
    });
  }
  
  if (suite.suites) {
    suite.suites.forEach(subSuite => {
      processSuite(subSuite, summary);
    });
  }
  
  summary.suites.push({
    title: suite.title,
    file: suite.file,
  });
}

function displaySummary(summary) {
  log('\n' + '='.repeat(60), 'cyan');
  log('  TEST RESULTS SUMMARY', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  log(`  Total Tests:    ${summary.total}`, 'blue');
  log(`  ✅ Passed:      ${summary.passed}`, 'green');
  log(`  ❌ Failed:      ${summary.failed}`, summary.failed > 0 ? 'red' : 'reset');
  log(`  ⊘  Skipped:     ${summary.skipped}`, 'yellow');
  log(`  ⏱  Duration:    ${(summary.duration / 1000).toFixed(2)}s\n`, 'blue');
  
  const successRate = summary.total > 0 
    ? ((summary.passed / summary.total) * 100).toFixed(1)
    : 0;
  
  log(`  Success Rate:   ${successRate}%`, successRate >= 80 ? 'green' : 'red');
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

function postToWorkDataAPI(summary, taskId) {
  log('📤 Posting results to Work Data API...\n', 'blue');
  
  const apiUrl = `http://localhost:8787/api/tasks/${taskId}/work`;
  
  const workData = {
    testResults: {
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      total: summary.total,
      duration: summary.duration,
      timestamp: new Date().toISOString(),
    },
  };
  
  try {
    execSync(`curl -X PUT "${apiUrl}" -H "Content-Type: application/json" -d '${JSON.stringify(workData)}'`, {
      stdio: 'inherit',
    });
    
    log('\n✅ Results posted successfully!\n', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Failed to post results: ${error.message}\n`, 'red');
    return false;
  }
}

function main() {
  const taskId = process.argv[2] || 'task-43a1360af58ac-1771198970208';
  
  log('\n' + '='.repeat(60), 'cyan');
  log('  CLAW CONTROL CENTER - COMPREHENSIVE TEST SUITE', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  // Ensure directories exist
  ensureDirectories();
  
  // Run tests
  const testsPass = runTests();
  
  // Parse results
  const summary = parseResults();
  
  if (!summary) {
    log('❌ Failed to parse test results', 'red');
    process.exit(1);
  }
  
  // Display summary
  displaySummary(summary);
  
  // Post to API
  const posted = postToWorkDataAPI(summary, taskId);
  
  // Exit with appropriate code
  if (summary.failed > 0) {
    log('⚠️  Tests completed with failures', 'yellow');
    process.exit(1);
  } else {
    log('🎉 All tests passed!', 'green');
    process.exit(0);
  }
}

main();
