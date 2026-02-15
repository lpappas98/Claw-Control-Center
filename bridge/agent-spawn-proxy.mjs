#!/usr/bin/env node
/**
 * agent-spawn-proxy.mjs — Lightweight HTTP server running on the HOST
 * that proxies agent spawn requests to `openclaw agent` CLI.
 * 
 * The Docker bridge container calls this instead of trying to exec
 * the openclaw binary directly (which doesn't exist inside Docker).
 * 
 * Usage: node agent-spawn-proxy.mjs [--port 8790]
 * 
 * POST /spawn
 *   Body: { agentId, message, timeout? }
 *   Returns: { ok, runId, result?, error? }
 */

import { execFile } from 'node:child_process'
import { createServer } from 'node:http'

const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '8790', 10)

function spawnAgent(agentId, message, timeout = 300) {
  return new Promise((resolve) => {
    const args = ['agent', '--agent', agentId, '--message', message, '--timeout', String(timeout), '--json']
    const proc = execFile('openclaw', args, { timeout: (timeout + 30) * 1000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[proxy] Agent ${agentId} error:`, err.message)
        return resolve({ ok: false, error: err.message, stderr })
      }
      try {
        const result = JSON.parse(stdout)
        resolve({ ok: true, runId: result.runId, result })
      } catch {
        resolve({ ok: true, raw: stdout })
      }
    })
  })
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/spawn') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const { agentId, message, timeout } = JSON.parse(body)
      if (!agentId || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: 'agentId and message required' }))
      }
      console.log(`[proxy] Spawning agent ${agentId} (timeout=${timeout || 300}s)`)
      // Fire and forget — respond immediately, agent runs in background
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, status: 'spawning', agentId }))
      
      // Run agent asynchronously
      const result = await spawnAgent(agentId, message, timeout || 300)
      console.log(`[proxy] Agent ${agentId} finished:`, result.ok ? 'success' : result.error)
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'agent-spawn-proxy' }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[agent-spawn-proxy] Listening on http://0.0.0.0:${PORT}`)
  console.log(`[agent-spawn-proxy] POST /spawn { agentId, message, timeout? }`)
})
