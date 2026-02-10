import fs from 'node:fs/promises'
import path from 'node:path'
import { existsSync } from 'node:fs'

function nowIso() {
  return new Date().toISOString()
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // ignore
  }
}

function newId(prefix = 'chg') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

/**
 * @param {string} rulesFile
 * @returns {Promise<import('../src/types').Rule[]>}
 */
export async function loadRules(rulesFile) {
  if (!existsSync(rulesFile)) {
    return [
      {
        id: 'default',
        title: 'Default rule',
        description: 'Seed rule created by the local bridge.',
        enabled: true,
        content: 'Describe the operator rule here.',
        updatedAt: nowIso(),
      },
    ]
  }

  const raw = await fs.readFile(rulesFile, 'utf8')
  const parsed = JSON.parse(raw)
  const list = Array.isArray(parsed) ? parsed : []
  return list
}

/**
 * @param {string} rulesFile
 * @param {import('../src/types').Rule[]} rules
 */
export async function saveRules(rulesFile, rules) {
  await ensureDir(path.dirname(rulesFile))
  await fs.writeFile(rulesFile, JSON.stringify(rules, null, 2) + '\n', 'utf8')
}

/**
 * @param {string} historyFile
 * @returns {Promise<import('../src/types').RuleChange[]>}
 */
export async function loadRuleHistory(historyFile) {
  if (!existsSync(historyFile)) return []
  try {
    const raw = await fs.readFile(historyFile, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * @param {string} historyFile
 * @param {import('../src/types').RuleChange[]} history
 */
export async function saveRuleHistory(historyFile, history) {
  await ensureDir(path.dirname(historyFile))
  await fs.writeFile(historyFile, JSON.stringify(history, null, 2) + '\n', 'utf8')
}

/**
 * @param {import('../src/types').RuleChange[]} history
 * @param {Omit<import('../src/types').RuleChange,'id'>} change
 */
export function pushRuleHistory(history, change) {
  history.unshift({ id: newId('rulechg'), ...change })
  while (history.length > 500) history.pop()
}
