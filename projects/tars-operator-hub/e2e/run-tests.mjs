#!/usr/bin/env node

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);

console.log('🎭 Playwright E2E Tests Runner');
console.log('=============================\n');

// Function to start a server
function startServer(command, port, name) {
  return new Promise((resolve) => {
    console.log(`🚀 Starting ${name} on port ${port}...`);
    
    const proc = spawn('sh', ['-c', command], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let isReady = false;
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      if (
        output.includes('listening') ||
        output.includes('Local:') ||
        output.includes('ready') ||
        output.includes('started')
      ) {
        if (!isReady) {
          isReady = true;
          console.log(`✅ ${name} is ready!`);
          resolve(proc);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`[${name}]`, data.toString());
    });

    // If server doesn't respond to startup signals within timeout, assume it's running
    setTimeout(() => {
      if (!isReady) {
        console.log(`✅ ${name} started (timeout)`);
        resolve(proc);
      }
    }, 5000);

    proc.on('error', (err) => {
      console.error(`Error starting ${name}:`, err.message);
    });
  });
}

// Function to check if port is listening
async function isPortListening(port) {
  try {
    const result = execSync(`netstat -an | grep -E ":${port}" | grep LISTEN || true`, { encoding: 'utf-8' });
    return result.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  try {
    // Check if ports are already in use
    const bridgeReady = await isPortListening(3000);
    const uiReady = await isPortListening(5173);

    let bridgeProc, uiProc;

    if (!bridgeReady) {
      bridgeProc = await startServer('npm run bridge', 3000, 'Bridge Server');
    } else {
      console.log('✅ Bridge Server already running on :3000');
    }

    if (!uiReady) {
      uiProc = await startServer('npm run dev', 5173, 'Dev Server');
    } else {
      console.log('✅ UI Server already running on :5173');
    }

    // Give servers time to fully initialize
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n🧪 Running Playwright E2E Tests...\n');

    // Run playwright tests
    const testProc = spawn('npx', ['-y', '@playwright/test', 'test', 'e2e/'], {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    testProc.on('exit', (code) => {
      console.log(`\n📊 Test run completed with code: ${code}`);
      
      // Cleanup
      if (bridgeProc) {
        console.log('\n🛑 Stopping Bridge Server...');
        bridgeProc.kill();
      }
      if (uiProc) {
        console.log('🛑 Stopping Dev Server...');
        uiProc.kill();
      }
      
      process.exit(code);
    });
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
