#!/usr/bin/env node

/**
 * Test script for session spawn functionality
 * 
 * This creates a mock task and tests the session spawning methods
 */

import { WorkerService } from './workerService.mjs';

const mockTask = {
  id: 'task-test-' + Date.now(),
  title: 'Test session spawn integration',
  problem: 'Verify that session spawning works correctly',
  scope: 'Run a simple test command and exit',
  acceptanceCriteria: [
    'Session spawns successfully',
    'Session ID is tracked',
    'Heartbeat updates with session info'
  ],
  workingDir: '/home/openclaw/.openclaw/workspace/',
  timeoutMs: 60000 // 1 minute timeout for test
};

async function test() {
  console.log('🧪 Testing session spawn integration...\n');
  
  // Create worker instance
  const worker = new WorkerService('dev-2');
  
  try {
    // Test 1: Build task prompt
    console.log('Test 1: Build task prompt');
    const prompt = worker.buildTaskPrompt(mockTask);
    console.log('✓ Prompt built successfully');
    console.log('Prompt preview:', prompt.substring(0, 200) + '...\n');
    
    // Test 2: Initialize worker
    console.log('Test 2: Initialize worker');
    await worker.start();
    console.log('✓ Worker started\n');
    
    // Test 3: Spawn session (dry run - just test the method exists)
    console.log('Test 3: Verify spawnSession method exists');
    if (typeof worker.spawnSession === 'function') {
      console.log('✓ spawnSession method exists');
    } else {
      throw new Error('spawnSession method not found');
    }
    
    // Test 4: Verify monitorSession method exists
    console.log('Test 4: Verify monitorSession method exists');
    if (typeof worker.monitorSession === 'function') {
      console.log('✓ monitorSession method exists');
    } else {
      throw new Error('monitorSession method not found');
    }
    
    // Test 5: Verify completeTask method exists
    console.log('Test 5: Verify completeTask method exists');
    if (typeof worker.completeTask === 'function') {
      console.log('✓ completeTask method exists');
    } else {
      throw new Error('completeTask method not found');
    }
    
    // Test 6: Verify executeTask method exists
    console.log('Test 6: Verify executeTask method exists');
    if (typeof worker.executeTask === 'function') {
      console.log('✓ executeTask method exists');
    } else {
      throw new Error('executeTask method not found');
    }
    
    console.log('\n✅ All tests passed!');
    
    // Clean up
    await worker.stop();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await worker.stop();
    process.exit(1);
  }
}

test();
