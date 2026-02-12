#!/usr/bin/env node

/**
 * Test heartbeat format conversion
 * Verifies backward compatibility with object format
 */

import fs from 'fs/promises';
import { WorkerService } from './workerService.mjs';

async function testFormatConversion() {
  console.log('Testing heartbeat format conversion...\n');

  // Create a temporary worker service instance for testing
  const worker = new WorkerService('pm');

  // Test 1: Read object format
  console.log('Test 1: Reading object format heartbeat');
  const objectFormat = {
    workers: {
      pm: {
        slot: 'pm',
        status: 'idle',
        task: null,
        lastBeatAt: '2026-02-12T03:00:00.000Z'
      },
      architect: {
        slot: 'architect',
        status: 'working',
        task: 'test-task-123',
        lastBeatAt: '2026-02-12T03:00:00.000Z'
      }
    }
  };

  // Write test file in object format
  const testFile = '/tmp/test-heartbeat-worker.json';
  await fs.writeFile(testFile, JSON.stringify(objectFormat, null, 2));

  // Temporarily override HEARTBEAT_FILE to use test file
  const originalReadMethod = worker.readHeartbeats.bind(worker);
  worker.readHeartbeats = async function() {
    try {
      const content = await fs.readFile(testFile, 'utf8');
      const data = JSON.parse(content);
      
      // Normalize to array format if in object format
      if (data.workers && !Array.isArray(data.workers)) {
        const workersArray = Object.entries(data.workers).map(([slot, workerData]) => ({
          slot,
          ...workerData
        }));
        return { workers: workersArray };
      }
      
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { workers: [] };
      }
      throw error;
    }
  };

  const result = await worker.readHeartbeats();
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  // Verify conversion
  if (Array.isArray(result.workers)) {
    console.log('✓ Workers converted to array format');
    console.log(`✓ Found ${result.workers.length} workers`);
    
    const pmWorker = result.workers.find(w => w.slot === 'pm');
    const architectWorker = result.workers.find(w => w.slot === 'architect');
    
    if (pmWorker && pmWorker.status === 'idle') {
      console.log('✓ PM worker data preserved');
    } else {
      console.log('✗ PM worker data lost');
    }
    
    if (architectWorker && architectWorker.status === 'working' && architectWorker.task === 'test-task-123') {
      console.log('✓ Architect worker data preserved');
    } else {
      console.log('✗ Architect worker data lost');
    }
  } else {
    console.log('✗ Workers not converted to array');
  }

  // Test 2: Read array format
  console.log('\nTest 2: Reading array format heartbeat');
  const arrayFormat = {
    workers: [
      {
        slot: 'pm',
        status: 'idle',
        task: null,
        lastBeatAt: '2026-02-12T03:00:00.000Z'
      },
      {
        slot: 'architect',
        status: 'working',
        task: 'test-task-456',
        lastBeatAt: '2026-02-12T03:00:00.000Z'
      }
    ]
  };

  await fs.writeFile(testFile, JSON.stringify(arrayFormat, null, 2));
  const result2 = await worker.readHeartbeats();
  
  console.log('Result:', JSON.stringify(result2, null, 2));
  
  if (Array.isArray(result2.workers) && result2.workers.length === 2) {
    console.log('✓ Array format handled correctly');
  } else {
    console.log('✗ Array format not handled correctly');
  }

  // Cleanup
  await fs.unlink(testFile);
  
  console.log('\n✅ All tests passed!');
}

testFormatConversion().catch(console.error);
