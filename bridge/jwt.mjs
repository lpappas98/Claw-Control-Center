/**
 * JWT Utility Module
 * 
 * Provides JWT token generation, verification, and validation for authentication.
 * Uses HMAC SHA-256 for signing tokens.
 */

import crypto from 'node:crypto'

const DEFAULT_EXPIRY = '24h' // Default token expiration
const DEFAULT_ALGORITHM = 'HS256'

/**
 * Parse expiry string to milliseconds
 * Supports: '1h', '24h', '7d', '30d', etc.
 */
export function parseExpiry(expiryStr) {
  const match = expiryStr.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiryStr}. Use format like '1h', '24h', '7d'`)
  }

  const [, value, unit] = match
  const num = parseInt(value, 10)

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return num * multipliers[unit]
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str) {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Generate HMAC signature
 */
function generateSignature(header, payload, secret) {
  const data = `${header}.${payload}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(data)
  return base64UrlEncode(hmac.digest())
}

/**
 * Verify HMAC signature
 */
function verifySignature(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [header, payload, signature] = parts
  const expectedSignature = generateSignature(header, payload, secret)

  // Check length first to avoid timing-safe comparison error
  if (signature.length !== expectedSignature.length) {
    return false
  }

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (_err) {
    return false
  }
}

/**
 * Generate JWT token
 * 
 * @param {Object} payload - Token payload (user data, claims)
 * @param {string} secret - Secret key for signing
 * @param {Object} options - Token options
 * @param {string} options.expiresIn - Expiration time (e.g., '24h', '7d')
 * @param {string} options.issuer - Token issuer
 * @param {string} options.subject - Token subject (usually user ID)
 * @returns {string} JWT token
 */
export function generateToken(payload, secret, options = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a non-null object')
  }

  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string')
  }

  const header = {
    alg: DEFAULT_ALGORITHM,
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const expiryMs = parseExpiry(options.expiresIn || DEFAULT_EXPIRY)
  const exp = now + Math.floor(expiryMs / 1000)

  const claims = {
    ...payload,
    iat: now, // Issued at
    exp, // Expiration time
  }

  if (options.issuer) {
    claims.iss = options.issuer
  }

  if (options.subject) {
    claims.sub = options.subject
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(claims))
  const signature = generateSignature(encodedHeader, encodedPayload, secret)

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

/**
 * Verify and decode JWT token
 * 
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key for verification
 * @param {Object} options - Verification options
 * @param {boolean} options.ignoreExpiration - Skip expiration check
 * @param {string} options.issuer - Expected issuer
 * @param {string} options.subject - Expected subject
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token, secret, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string')
  }

  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format: expected 3 parts')
  }

  // Verify signature
  if (!verifySignature(token, secret)) {
    throw new Error('Invalid token signature')
  }

  // Decode and parse payload
  let payload
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]))
  } catch (err) {
    throw new Error('Invalid token payload')
  }

  // Check expiration
  if (!options.ignoreExpiration) {
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp) {
      throw new Error('Token missing expiration claim')
    }
    if (payload.exp < now) {
      throw new Error('Token has expired')
    }
  }

  // Verify issuer if provided
  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error(`Invalid issuer: expected ${options.issuer}, got ${payload.iss}`)
  }

  // Verify subject if provided
  if (options.subject && payload.sub !== options.subject) {
    throw new Error(`Invalid subject: expected ${options.subject}, got ${payload.sub}`)
  }

  return payload
}

/**
 * Decode JWT token without verification
 * WARNING: Does not verify signature - only for debugging/inspection
 * 
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token with header and payload
 */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  try {
    return {
      header: JSON.parse(base64UrlDecode(parts[0])),
      payload: JSON.parse(base64UrlDecode(parts[1])),
    }
  } catch (err) {
    throw new Error('Failed to decode token')
  }
}

/**
 * Check if token is expired
 * 
 * @param {string} token - JWT token to check
 * @returns {boolean} True if expired, false otherwise
 */
export function isTokenExpired(token) {
  try {
    const { payload } = decodeToken(token)
    if (!payload.exp) return false

    const now = Math.floor(Date.now() / 1000)
    return payload.exp < now
  } catch (_err) {
    return true // Invalid tokens are considered expired
  }
}

/**
 * Get token expiration time
 * 
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if not present
 */
export function getTokenExpiration(token) {
  try {
    const { payload } = decodeToken(token)
    if (!payload.exp) return null
    return new Date(payload.exp * 1000)
  } catch (_err) {
    return null
  }
}

/**
 * Refresh token (generate new token with same payload but updated timestamps)
 * 
 * @param {string} token - Original token
 * @param {string} secret - Secret key
 * @param {Object} options - Token options (same as generateToken)
 * @returns {string} New JWT token
 */
export function refreshToken(token, secret, options = {}) {
  // Verify original token (ignoring expiration)
  const payload = verifyToken(token, secret, { ignoreExpiration: true })

  // Remove JWT-specific claims
  const { iat, exp, iss, sub, ...userPayload } = payload

  // Generate new token with same payload
  return generateToken(userPayload, secret, {
    ...options,
    issuer: iss,
    subject: sub,
  })
}
