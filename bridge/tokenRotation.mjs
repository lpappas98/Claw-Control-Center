/**
 * Token Rotation Module
 * 
 * Implements secure token rotation with:
 * - Refresh token management
 * - Automatic token rotation
 * - Token revocation/blacklist
 * - Token family tracking to prevent token replay attacks
 */

import { generateToken, verifyToken, isTokenExpired, getTokenExpiration } from './jwt.mjs'

/**
 * In-memory token store
 * In production, this should be replaced with Redis or a database
 */
class TokenStore {
  constructor() {
    this.refreshTokens = new Map() // tokenId -> { userId, familyId, createdAt, expiresAt, revoked }
    this.accessTokens = new Map() // tokenId -> { userId, refreshTokenId, createdAt, expiresAt }
    this.blacklist = new Set() // Revoked token IDs
    this.tokenFamilies = new Map() // familyId -> [tokenIds] - to track token lineage
  }

  /**
   * Store a refresh token
   */
  storeRefreshToken(tokenId, userId, familyId, expiresAt) {
    this.refreshTokens.set(tokenId, {
      userId,
      familyId,
      createdAt: new Date().toISOString(),
      expiresAt,
      revoked: false,
    })

    // Track token family
    if (!this.tokenFamilies.has(familyId)) {
      this.tokenFamilies.set(familyId, [])
    }
    this.tokenFamilies.get(familyId).push(tokenId)
  }

  /**
   * Store an access token
   */
  storeAccessToken(tokenId, userId, refreshTokenId, expiresAt) {
    this.accessTokens.set(tokenId, {
      userId,
      refreshTokenId,
      createdAt: new Date().toISOString(),
      expiresAt,
    })
  }

  /**
   * Get refresh token metadata
   */
  getRefreshToken(tokenId) {
    return this.refreshTokens.get(tokenId)
  }

  /**
   * Get access token metadata
   */
  getAccessToken(tokenId) {
    return this.accessTokens.get(tokenId)
  }

  /**
   * Revoke a specific token
   */
  revokeToken(tokenId) {
    this.blacklist.add(tokenId)
    
    const refreshToken = this.refreshTokens.get(tokenId)
    if (refreshToken) {
      refreshToken.revoked = true
    }
  }

  /**
   * Revoke all tokens in a family (security measure for token reuse detection)
   */
  revokeTokenFamily(familyId) {
    const family = this.tokenFamilies.get(familyId) || []
    for (const tokenId of family) {
      this.revokeToken(tokenId)
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeAllUserTokens(userId) {
    for (const [tokenId, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        this.revokeToken(tokenId)
      }
    }
    for (const [tokenId, data] of this.accessTokens.entries()) {
      if (data.userId === userId) {
        this.blacklist.add(tokenId)
      }
    }
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(tokenId) {
    return this.blacklist.has(tokenId)
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  cleanup() {
    const now = Date.now()
    
    // Clean up expired refresh tokens
    for (const [tokenId, data] of this.refreshTokens.entries()) {
      if (new Date(data.expiresAt).getTime() < now) {
        this.refreshTokens.delete(tokenId)
        this.blacklist.delete(tokenId)
      }
    }

    // Clean up expired access tokens
    for (const [tokenId, data] of this.accessTokens.entries()) {
      if (new Date(data.expiresAt).getTime() < now) {
        this.accessTokens.delete(tokenId)
        this.blacklist.delete(tokenId)
      }
    }

    // Clean up old token families
    for (const [familyId, tokenIds] of this.tokenFamilies.entries()) {
      const validTokens = tokenIds.filter(id => this.refreshTokens.has(id))
      if (validTokens.length === 0) {
        this.tokenFamilies.delete(familyId)
      } else {
        this.tokenFamilies.set(familyId, validTokens)
      }
    }
  }

  /**
   * Get stats about stored tokens
   */
  getStats() {
    return {
      refreshTokens: this.refreshTokens.size,
      accessTokens: this.accessTokens.size,
      blacklistedTokens: this.blacklist.size,
      tokenFamilies: this.tokenFamilies.size,
    }
  }
}

/**
 * Token Rotation Manager
 */
export class TokenRotationManager {
  constructor(secret, options = {}) {
    this.secret = secret
    this.store = new TokenStore()
    
    // Configuration
    this.config = {
      accessTokenExpiry: options.accessTokenExpiry || '15m',
      refreshTokenExpiry: options.refreshTokenExpiry || '7d',
      rotationThreshold: options.rotationThreshold || 0.5, // Rotate when 50% of lifetime remaining
      enableAutoRotation: options.enableAutoRotation !== false,
      maxTokensPerUser: options.maxTokensPerUser || 5,
      cleanupInterval: options.cleanupInterval || 60 * 60 * 1000, // 1 hour
    }

    // Start cleanup interval
    this.startCleanup()
  }

  /**
   * Generate a unique token ID
   */
  generateTokenId() {
    return `tok_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Generate a unique family ID
   */
  generateFamilyId() {
    return `fam_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Create initial token pair (access + refresh)
   */
  async createTokenPair(userId, payload = {}) {
    if (!userId) {
      throw new Error('userId is required')
    }

    const familyId = this.generateFamilyId()
    const refreshTokenId = this.generateTokenId()
    const accessTokenId = this.generateTokenId()

    // Generate refresh token
    const refreshToken = generateToken(
      {
        ...payload,
        userId,
        tokenId: refreshTokenId,
        familyId,
        type: 'refresh',
      },
      this.secret,
      { expiresIn: this.config.refreshTokenExpiry }
    )

    // Generate access token
    const accessToken = generateToken(
      {
        ...payload,
        userId,
        tokenId: accessTokenId,
        refreshTokenId,
        type: 'access',
      },
      this.secret,
      { expiresIn: this.config.accessTokenExpiry }
    )

    // Store tokens
    const refreshExpiration = getTokenExpiration(refreshToken)
    const accessExpiration = getTokenExpiration(accessToken)

    this.store.storeRefreshToken(refreshTokenId, userId, familyId, refreshExpiration.toISOString())
    this.store.storeAccessToken(accessTokenId, userId, refreshTokenId, accessExpiration.toISOString())

    // Enforce max tokens per user
    this.enforceMaxTokensPerUser(userId)

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: accessExpiration,
      refreshTokenExpiry: refreshExpiration,
    }
  }

  /**
   * Rotate tokens (exchange refresh token for new access + refresh tokens)
   */
  async rotateTokens(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required')
    }

    // Verify the refresh token
    let payload
    try {
      payload = verifyToken(refreshToken, this.secret)
    } catch (err) {
      throw new Error(`Invalid refresh token: ${err.message}`)
    }

    // Verify token type
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token')
    }

    const { tokenId, userId, familyId } = payload

    // Check if token exists in store
    const storedToken = this.store.getRefreshToken(tokenId)
    if (!storedToken) {
      throw new Error('Refresh token not found')
    }

    // Check if token is revoked
    if (this.store.isBlacklisted(tokenId) || storedToken.revoked) {
      // Security: If a revoked token is used, revoke entire family
      // This prevents token replay attacks
      this.store.revokeTokenFamily(familyId)
      throw new Error('Refresh token has been revoked')
    }

    // Revoke old refresh token
    this.store.revokeToken(tokenId)

    // Create new token pair with same family
    const newRefreshTokenId = this.generateTokenId()
    const newAccessTokenId = this.generateTokenId()

    // Extract user payload (remove JWT-specific claims)
    const { iat, exp, tokenId: _, familyId: __, type: ___, ...userPayload } = payload

    // Generate new refresh token (same family)
    const newRefreshToken = generateToken(
      {
        ...userPayload,
        tokenId: newRefreshTokenId,
        familyId, // Keep same family
        type: 'refresh',
      },
      this.secret,
      { expiresIn: this.config.refreshTokenExpiry }
    )

    // Generate new access token
    const newAccessToken = generateToken(
      {
        ...userPayload,
        tokenId: newAccessTokenId,
        refreshTokenId: newRefreshTokenId,
        type: 'access',
      },
      this.secret,
      { expiresIn: this.config.accessTokenExpiry }
    )

    // Store new tokens
    const refreshExpiration = getTokenExpiration(newRefreshToken)
    const accessExpiration = getTokenExpiration(newAccessToken)

    this.store.storeRefreshToken(newRefreshTokenId, userId, familyId, refreshExpiration.toISOString())
    this.store.storeAccessToken(newAccessTokenId, userId, newRefreshTokenId, accessExpiration.toISOString())

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiry: accessExpiration,
      refreshTokenExpiry: refreshExpiration,
    }
  }

  /**
   * Verify access token and check if rotation is needed
   */
  async verifyAccessToken(accessToken) {
    if (!accessToken) {
      throw new Error('Access token is required')
    }

    // Verify the token
    let payload
    try {
      payload = verifyToken(accessToken, this.secret)
    } catch (err) {
      throw new Error(`Invalid access token: ${err.message}`)
    }

    // Verify token type
    if (payload.type !== 'access') {
      throw new Error('Invalid token type: expected access token')
    }

    const { tokenId } = payload

    // Check if token is blacklisted
    if (this.store.isBlacklisted(tokenId)) {
      throw new Error('Access token has been revoked')
    }

    // Check if auto-rotation is needed
    const shouldRotate = this.shouldRotateToken(accessToken)

    return {
      valid: true,
      payload,
      shouldRotate,
    }
  }

  /**
   * Check if token should be rotated based on remaining lifetime
   */
  shouldRotateToken(token) {
    if (!this.config.enableAutoRotation) {
      return false
    }

    try {
      const expiration = getTokenExpiration(token)
      if (!expiration) return false

      const now = Date.now()
      const expiresAt = expiration.getTime()
      const lifetime = expiresAt - now

      // Get token creation time
      const decoded = verifyToken(token, this.secret, { ignoreExpiration: true })
      const createdAt = decoded.iat * 1000
      const totalLifetime = expiresAt - createdAt

      // Calculate remaining lifetime percentage
      const remainingPercent = lifetime / totalLifetime

      // Rotate if less than threshold remaining
      return remainingPercent < this.config.rotationThreshold
    } catch (err) {
      return false
    }
  }

  /**
   * Revoke a specific token
   */
  revokeToken(token) {
    try {
      const decoded = verifyToken(token, this.secret, { ignoreExpiration: true })
      this.store.revokeToken(decoded.tokenId)
    } catch (err) {
      throw new Error(`Failed to revoke token: ${err.message}`)
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeAllUserTokens(userId) {
    this.store.revokeAllUserTokens(userId)
  }

  /**
   * Enforce max tokens per user (delete oldest tokens)
   */
  enforceMaxTokensPerUser(userId) {
    const userTokens = []
    
    for (const [tokenId, data] of this.store.refreshTokens.entries()) {
      if (data.userId === userId && !data.revoked) {
        userTokens.push({ tokenId, createdAt: data.createdAt })
      }
    }

    // Sort by creation time (oldest first)
    userTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

    // Revoke oldest tokens if over limit
    const tokensToRevoke = userTokens.length - this.config.maxTokensPerUser
    if (tokensToRevoke > 0) {
      for (let i = 0; i < tokensToRevoke; i++) {
        this.store.revokeToken(userTokens[i].tokenId)
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.store.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Get token store stats
   */
  getStats() {
    return this.store.getStats()
  }

  /**
   * Manual cleanup
   */
  cleanup() {
    this.store.cleanup()
  }
}

// Export singleton instance (can be configured in server)
let defaultManager = null

export function initializeTokenRotation(secret, options = {}) {
  defaultManager = new TokenRotationManager(secret, options)
  return defaultManager
}

export function getTokenRotationManager() {
  if (!defaultManager) {
    throw new Error('Token rotation manager not initialized. Call initializeTokenRotation() first.')
  }
  return defaultManager
}
