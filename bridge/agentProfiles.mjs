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

function newId(prefix = 'profile') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

/**
 * @param {string} profilesFile
 * @returns {Promise<import('../src/types').AgentProfile[]>}
 */
export async function loadAgentProfiles(profilesFile) {
  if (!existsSync(profilesFile)) {
    return [
      {
        id: 'default',
        name: 'Default Profile',
        description: 'Seed profile created by the local bridge.',
        personality: 'Professional and helpful assistant.',
        systemPrompt: '',
        enabled: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ]
  }

  try {
    const raw = await fs.readFile(profilesFile, 'utf8')
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    return list
  } catch {
    return []
  }
}

/**
 * @param {string} profilesFile
 * @param {import('../src/types').AgentProfile[]} profiles
 */
export async function saveAgentProfiles(profilesFile, profiles) {
  await ensureDir(path.dirname(profilesFile))
  
  // Atomic write using temp file
  const tmp = `${profilesFile}.tmp`
  const payload = JSON.stringify(profiles, null, 2) + '\n'
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, profilesFile)
}

/**
 * Get a single profile by ID
 * @param {import('../src/types').AgentProfile[]} profiles
 * @param {string} id
 */
export function getAgentProfile(profiles, id) {
  return profiles.find(p => p.id === id)
}

/**
 * Create a new agent profile
 * @param {import('../src/types').AgentProfile[]} profiles
 * @param {Partial<import('../src/types').AgentProfile>} data
 */
export function createAgentProfile(profiles, data) {
  const now = nowIso()
  const name = typeof data?.name === 'string' ? data.name.trim() : ''
  
  if (!name) {
    throw new Error('name required')
  }

  const id = typeof data?.id === 'string' && data.id.trim() 
    ? data.id.trim() 
    : newId('profile')

  // Ensure unique ID
  if (profiles.some(p => p.id === id)) {
    throw new Error(`profile with id ${id} already exists`)
  }

  const profile = {
    id,
    name,
    description: typeof data?.description === 'string' ? data.description : '',
    personality: typeof data?.personality === 'string' ? data.personality : '',
    systemPrompt: typeof data?.systemPrompt === 'string' ? data.systemPrompt : '',
    enabled: data?.enabled === undefined ? true : !!data.enabled,
    tags: Array.isArray(data?.tags) ? data.tags.filter(t => typeof t === 'string') : [],
    createdAt: now,
    updatedAt: now,
  }

  return profile
}

/**
 * Update an existing agent profile
 * @param {import('../src/types').AgentProfile[]} profiles
 * @param {string} id
 * @param {Partial<import('../src/types').AgentProfile>} data
 */
export function updateAgentProfile(profiles, id, data) {
  const idx = profiles.findIndex(p => p.id === id)
  if (idx < 0) {
    return null
  }

  const before = profiles[idx]
  const now = nowIso()

  const updated = {
    ...before,
    name: typeof data?.name === 'string' ? data.name.trim() : before.name,
    description: typeof data?.description === 'string' ? data.description : before.description,
    personality: typeof data?.personality === 'string' ? data.personality : before.personality,
    systemPrompt: typeof data?.systemPrompt === 'string' ? data.systemPrompt : before.systemPrompt,
    enabled: data?.enabled !== undefined ? !!data.enabled : before.enabled,
    tags: Array.isArray(data?.tags) ? data.tags.filter(t => typeof t === 'string') : before.tags,
    updatedAt: now,
  }

  return { idx, updated }
}

/**
 * Delete an agent profile
 * @param {import('../src/types').AgentProfile[]} profiles
 * @param {string} id
 */
export function deleteAgentProfile(profiles, id) {
  const idx = profiles.findIndex(p => p.id === id)
  if (idx < 0) {
    return null
  }

  return idx
}
