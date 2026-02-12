/**
 * Agent utility functions for mapping slot IDs to human-readable names
 */

export interface AgentInfo {
  name: string
  role: string
  emoji: string
}

/**
 * Maps slot IDs to agent names
 * @param slotId - The slot ID (e.g., "dev-1", "architect", "pm")
 * @param fallback - Optional fallback value if slot not found
 * @returns The agent name (e.g., "Forge", "Blueprint", "TARS")
 */
export function getAgentName(slotId: string | undefined, fallback?: string): string {
  if (!slotId) return fallback ?? 'Unassigned'
  
  const info = getAgentInfo(slotId, fallback)
  return info.name
}

/**
 * Maps slot IDs to full agent profile info
 * @param slotId - The slot ID (e.g., "dev-1", "architect", "pm")
 * @param fallback - Optional fallback name if slot not found
 * @returns Agent profile with name, role, and emoji
 */
export function getAgentInfo(slotId: string, fallback?: string): AgentInfo {
  // Standard slot mappings
  const slotMap: Record<string, AgentInfo> = {
    'pm': { name: 'TARS', role: 'Project Manager', emoji: '🧠' },
    'architect': { name: 'Blueprint', role: 'Architect', emoji: '🏗️' },
    'dev-1': { name: 'Forge', role: 'Developer', emoji: '🛠️' },
    'dev-2': { name: 'Patch', role: 'Developer', emoji: '🧩' },
    'qa': { name: 'Sentinel', role: 'QA', emoji: '🛡️' },
  }
  
  return slotMap[slotId] ?? { 
    name: fallback ?? slotId, 
    role: 'Agent', 
    emoji: '🤖' 
  }
}

/**
 * Gets display name with emoji for an agent
 * @param slotId - The slot ID
 * @returns Formatted string like "🛠️ Forge"
 */
export function getAgentDisplayName(slotId: string | undefined): string {
  if (!slotId) return 'Unassigned'
  
  const info = getAgentInfo(slotId)
  return `${info.emoji} ${info.name}`
}
