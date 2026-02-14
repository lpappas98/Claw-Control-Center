#!/usr/bin/env node
/**
 * install-config.mjs
 * 
 * Merges Claw Control Center config into OpenClaw config.
 * Safe merge - preserves existing OpenClaw settings.
 */

import { readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json')
const TEMPLATE_CONFIG = join(process.cwd(), 'config', 'openclaw-config-template.json')

async function loadJson(path) {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

async function main() {
  console.log('📝 Claw Control Center - Config Installer\n')

  // Load template
  const template = await loadJson(TEMPLATE_CONFIG)
  if (!template) {
    console.error(`❌ Template not found: ${TEMPLATE_CONFIG}`)
    process.exit(1)
  }

  console.log('✅ Loaded template config')

  // Load existing OpenClaw config
  let existing = await loadJson(OPENCLAW_CONFIG)
  
  if (!existing) {
    console.log('ℹ️  No existing OpenClaw config found')
    console.log(`   Creating new config at ${OPENCLAW_CONFIG}`)
    existing = {}
  } else {
    console.log('✅ Loaded existing OpenClaw config')
  }

  // Check if clawControlCenter already exists
  if (existing.clawControlCenter) {
    console.log('\n⚠️  clawControlCenter config already exists in OpenClaw config')
    console.log('   This will OVERWRITE the existing config.')
    console.log('\n   Press Ctrl+C to cancel, or Enter to continue...')
    
    // Wait for user confirmation (skip in non-interactive mode)
    if (process.stdin.isTTY) {
      await new Promise(resolve => {
        process.stdin.once('data', resolve)
      })
    }
  }

  // Merge config
  const merged = {
    ...existing,
    clawControlCenter: template.clawControlCenter
  }

  // Write back
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(merged, null, 2), 'utf-8')

  console.log(`\n✅ Config installed to ${OPENCLAW_CONFIG}`)
  console.log('\n📋 Claw Control Center config:')
  console.log(`   Enabled: ${merged.clawControlCenter.enabled}`)
  console.log(`   Bridge URL: ${merged.clawControlCenter.bridgeUrl}`)
  console.log(`   Agents configured: ${merged.clawControlCenter.agents.length}`)
  console.log(`   Auto-spawn agents: ${merged.clawControlCenter.agents.filter(a => a.autoSpawn).length}`)

  console.log('\n📋 Agents:')
  merged.clawControlCenter.agents.forEach(a => {
    const spawn = a.autoSpawn ? '✓ auto-spawn' : '✗ manual'
    console.log(`   ${a.emoji} ${a.name} (${a.id}) - ${spawn}`)
    console.log(`      Roles: ${a.roles.join(', ')}`)
  })

  console.log('\n🚀 Next steps:')
  console.log('   1. Start the bridge: cd ~/.openclaw/workspace && npm run bridge')
  console.log('   2. Spawn agents: node scripts/spawn-agents.mjs')
  console.log('   3. View in UI: http://localhost:5173 → Agents tab')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
