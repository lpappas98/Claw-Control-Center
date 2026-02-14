#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkServer = () => {
      const req = http.request(`http://localhost:${port}/`, (res) => {
        log(`✅ Server is listening on port ${port}`, 'green');
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server on port ${port} did not start within ${timeout}ms`));
        } else {
          setTimeout(checkServer, 500);
        }
      });

      req.end();
    };

    checkServer();
  });
}

async function runTests() {
  log('\n🎭 Claw Control Center - E2E Test Suite', 'blue');
  log('========================================\n', 'blue');

  // Start bridge server
  log('🚀 Starting Bridge Server...', 'yellow');
  const bridgeProc = spawn('npm', ['run', 'bridge'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let bridgeError = '';
  bridgeProc.stderr.on('data', (data) => {
    bridgeError += data.toString();
  });

  try {
    await waitForServer(8787);
    log('✓ Bridge Server ready\n', 'green');
  } catch (error) {
    log(`✗ Bridge Server failed to start: ${error.message}`, 'red');
    bridgeProc.kill();
    process.exit(1);
  }

  // Run tests
  let testsFailed = false;

  try {
    log('🧪 Running API Integration Tests...', 'yellow');

    await new Promise((resolve, reject) => {
      const testProc = spawn('node', ['--test', 'e2e/task-tests.mjs'], {
        cwd: projectRoot,
        stdio: 'inherit',
      });

      testProc.on('exit', (code) => {
        if (code !== 0) {
          testsFailed = true;
        }
        resolve();
      });

      testProc.on('error', reject);
    });

    log('\n✓ API tests completed\n', 'green');
  } catch (error) {
    log(`✗ Tests failed: ${error.message}`, 'red');
    testsFailed = true;
  } finally {
    // Cleanup
    log('\n🛑 Cleaning up...', 'yellow');
    bridgeProc.kill();

    if (testsFailed) {
      log('\n❌ Some tests failed', 'red');
      process.exit(1);
    } else {
      log('\n✅ All tests passed!', 'green');
      process.exit(0);
    }
  }
}

// Run tests
runTests().catch((error) => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
