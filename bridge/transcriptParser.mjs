/**
 * transcriptParser.mjs — Extract metrics from sub-agent session transcripts
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * Parse a .jsonl transcript file and extract metrics
 * @param {string} transcriptPath - Path to the .jsonl file
 * @returns {Promise<{duration: number|null, totalTokens: number|null, model: string|null, status: string}>}
 */
export async function parseTranscript(transcriptPath) {
  const result = {
    duration: null,
    totalTokens: null,
    model: null,
    status: 'unknown'
  }

  try {
    // Check if file exists
    if (!existsSync(transcriptPath)) {
      console.warn(`[TranscriptParser] File not found: ${transcriptPath}`)
      return result
    }

    const content = await readFile(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    if (lines.length === 0) {
      console.warn(`[TranscriptParser] Empty transcript: ${transcriptPath}`)
      return result
    }

    const events = lines.map((line, idx) => {
      try {
        return JSON.parse(line)
      } catch (err) {
        console.warn(`[TranscriptParser] Invalid JSON at line ${idx + 1}: ${err.message}`)
        return null
      }
    }).filter(Boolean)

    if (events.length === 0) {
      return result
    }

    // Extract model from model_change or message events
    for (const event of events) {
      if (event.type === 'model_change' && event.modelId) {
        result.model = event.modelId
        break
      } else if (event.type === 'message' && event.message?.model) {
        result.model = event.message.model
        break
      }
    }

    // Calculate duration (first to last message timestamp)
    const messageEvents = events.filter(e => 
      e.type === 'message' && e.timestamp
    )

    if (messageEvents.length > 0) {
      const firstTs = new Date(messageEvents[0].timestamp).getTime()
      const lastTs = new Date(messageEvents[messageEvents.length - 1].timestamp).getTime()
      result.duration = lastTs - firstTs
    }

    // Sum token usage from all assistant messages
    let totalTokens = 0
    for (const event of events) {
      if (event.type === 'message' && 
          event.message?.role === 'assistant' && 
          event.message?.usage?.totalTokens) {
        totalTokens += event.message.usage.totalTokens
      }
    }
    result.totalTokens = totalTokens > 0 ? totalTokens : null

    // Determine status from the final assistant message
    const lastAssistantMsg = messageEvents
      .filter(e => e.message?.role === 'assistant')
      .pop()

    if (lastAssistantMsg) {
      const stopReason = lastAssistantMsg.message?.stopReason
      const content = lastAssistantMsg.message?.content

      // Check if it's a successful completion
      if (stopReason === 'stop' || stopReason === 'end_turn') {
        result.status = 'completed'
      } else if (stopReason === 'max_tokens' || stopReason === 'length') {
        result.status = 'failed'
      }

      // Look for explicit success/failure indicators in content
      if (content) {
        const textContent = Array.isArray(content) 
          ? content.filter(c => c.type === 'text').map(c => c.text).join(' ')
          : content

        if (typeof textContent === 'string') {
          const lower = textContent.toLowerCase()
          if (lower.includes('heartbeat_ok')) {
            result.status = 'completed'
          } else if (lower.includes('error') || lower.includes('failed')) {
            result.status = 'failed'
          }
        }
      }
    }

  } catch (err) {
    console.error(`[TranscriptParser] Error parsing ${transcriptPath}: ${err.message}`)
  }

  return result
}

/**
 * Parse transcript by session key
 * @param {string} sessionKey - e.g., "agent:main:subagent:abc-123"
 * @param {string} baseDir - Base directory containing sessions (default: /home/openclaw/.openclaw/agents/main/sessions)
 */
export async function parseTranscriptBySessionKey(sessionKey, baseDir = '/home/openclaw/.openclaw/agents/main/sessions') {
  // Extract session ID from key (last part after last colon)
  const sessionId = sessionKey.split(':').pop()
  const transcriptPath = `${baseDir}/${sessionId}.jsonl`
  return parseTranscript(transcriptPath)
}
