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

/**
 * @param {string} metadataFile
 * @returns {Promise<import('../src/types').WorkerMetadata[]>}
 */
export async function loadWorkerMetadata(metadataFile) {
  if (!existsSync(metadataFile)) {
    return []
  }

  try {
    const raw = await fs.readFile(metadataFile, 'utf8')
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    return list
  } catch {
    return []
  }
}

/**
 * @param {string} metadataFile
 * @param {import('../src/types').WorkerMetadata[]} metadata
 */
export async function saveWorkerMetadata(metadataFile, metadata) {
  await ensureDir(path.dirname(metadataFile))
  
  // Atomic write using temp file
  const tmp = `${metadataFile}.tmp`
  const payload = JSON.stringify(metadata, null, 2) + '\n'
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, metadataFile)
}

/**
 * Get metadata for a specific worker slot
 * @param {import('../src/types').WorkerMetadata[]} metadata
 * @param {string} slot
 */
export function getWorkerMetadata(metadata, slot) {
  return metadata.find(m => m.slot === slot)
}

/**
 * Update or create worker metadata for a specific slot
 * @param {import('../src/types').WorkerMetadata[]} metadata
 * @param {string} slot
 * @param {Partial<import('../src/types').WorkerMetadataUpdate>} data
 */
export function upsertWorkerMetadata(metadata, slot, data) {
  const now = nowIso()
  const idx = metadata.findIndex(m => m.slot === slot)
  
  if (idx >= 0) {
    // Update existing
    const before = metadata[idx]
    const updated = {
      ...before,
      name: typeof data?.name === 'string' ? data.name.trim() : before.name,
      role: typeof data?.role === 'string' ? data.role.trim() : before.role,
      model: typeof data?.model === 'string' ? data.model.trim() : before.model,
      emoji: typeof data?.emoji === 'string' ? data.emoji.trim() : before.emoji,
      updatedAt: now,
    }
    return { idx, updated }
  } else {
    // Create new
    const created = {
      slot,
      name: typeof data?.name === 'string' ? data.name.trim() : undefined,
      role: typeof data?.role === 'string' ? data.role.trim() : undefined,
      model: typeof data?.model === 'string' ? data.model.trim() : undefined,
      emoji: typeof data?.emoji === 'string' ? data.emoji.trim() : undefined,
      updatedAt: now,
    }
    return { idx: -1, updated: created }
  }
}
