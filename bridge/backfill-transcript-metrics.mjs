#!/usr/bin/env node
/**
 * backfill-transcript-metrics.mjs — Parse existing transcripts and update registry
 */

import { readFile, writeFile } from 'node:fs/promises'
import { parseTranscriptBySessionKey } from './transcriptParser.mjs'

const REGISTRY_PATH = '/home/openclaw/.openclaw/workspace/.clawhub/sub-agent-registry.json'

async function backfill() {
  console.log('[Backfill] Loading registry...')
  const raw = await readFile(REGISTRY_PATH, 'utf-8')
  const entries = JSON.parse(raw)
  
  console.log(`[Backfill] Processing ${entries.length} entries...`)
  
  let updated = 0
  let skipped = 0
  let errors = 0
  
  for (const entry of entries) {
    // Skip if already has metrics
    if (entry.duration !== null && entry.duration !== undefined) {
      skipped++
      continue
    }
    
    try {
      const metrics = await parseTranscriptBySessionKey(entry.childSessionKey)
      
      entry.duration = metrics.duration
      entry.totalTokens = metrics.totalTokens
      entry.model = metrics.model
      
      // Update status if we got a more specific one from transcript
      if (metrics.status && metrics.status !== 'unknown' && entry.status !== metrics.status) {
        console.log(`  ${entry.agentId} → ${entry.taskId}: status ${entry.status} → ${metrics.status}`)
        entry.status = metrics.status
      }
      
      if (metrics.duration !== null || metrics.totalTokens !== null) {
        updated++
        console.log(`  ✓ ${entry.agentId} → ${entry.taskId}: ${metrics.duration}ms, ${metrics.totalTokens} tokens, ${metrics.model}`)
      } else {
        skipped++
        console.log(`  ⚠ ${entry.agentId} → ${entry.taskId}: no metrics found`)
      }
    } catch (err) {
      errors++
      console.error(`  ✗ ${entry.agentId} → ${entry.taskId}: ${err.message}`)
    }
  }
  
  console.log('\n[Backfill] Writing updated registry...')
  await writeFile(REGISTRY_PATH, JSON.stringify(entries, null, 2), 'utf-8')
  
  console.log(`\n[Backfill] Complete!`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors:  ${errors}`)
}

backfill().catch(err => {
  console.error('[Backfill] Fatal error:', err)
  process.exit(1)
})
