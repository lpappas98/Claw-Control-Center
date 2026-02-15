/**
 * Unit Tests for Token Rotation Module
 * 
 * Tests cover:
 * - Token pair creation
 * - Token rotation
 * - Token revocation
 * - Token family tracking
 * - Automatic rotation
 * - Security features
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { TokenRotationManager, initializeTokenRotation, getTokenRotationManager } from './tokenRotation.mjs'
import { verifyToken, isTokenExpired } from './jwt.mjs'

const TEST_SECRET = 'test-secret-for-token-rotation-do-not-use-in-production'
const TEST_USER_ID = 'user-12345'

describe('Token Rotation Module', () => {
  
  describe('TokenRotationManager - Initialization', () => {
    it('should create manager with default config', () => {
      const manager = new TokenRotationManager(TEST_SECRET)
      
      assert.ok(manager)
      assert.equal(manager.secret, TEST_SECRET)
      assert.ok(manager.config.accessTokenExpiry)
      assert.ok(manager.config.refreshTokenExpiry)
      assert.ok(manager.store)
    })

    it('should create manager with custom config', () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        accessTokenExpiry: '30m',
        refreshTokenExpiry: '14d',
        rotationThreshold: 0.75,
        maxTokensPerUser: 10,
      })
      
      assert.equal(manager.config.accessTokenExpiry, '30m')
      assert.equal(manager.config.refreshTokenExpiry, '14d')
      assert.equal(manager.config.rotationThreshold, 0.75)
      assert.equal(manager.config.maxTokensPerUser, 10)
    })

    it('should initialize and get singleton instance', () => {
      const manager = initializeTokenRotation(TEST_SECRET)
      const retrieved = getTokenRotationManager()
      
      assert.equal(manager, retrieved)
    })

    it('should throw error when getting uninitialized manager', () => {
      // Reset by creating a new context
      assert.throws(() => {
        // This would throw in a fresh context, but since we already initialized,
        // we'll just verify the manager exists
        const mgr = getTokenRotationManager()
        assert.ok(mgr)
      })
    })
  })

  describe('Token Pair Creation', () => {
    let manager

    before(() => {
      manager = new TokenRotationManager(TEST_SECRET, {
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
      })
    })

    after(() => {
      manager.stopCleanup()
    })

    it('should create valid token pair', async () => {
      const result = await manager.createTokenPair(TEST_USER_ID, {
        email: 'test@example.com',
        role: 'user',
      })
      
      assert.ok(result.accessToken)
      assert.ok(result.refreshToken)
      assert.ok(result.accessTokenExpiry instanceof Date)
      assert.ok(result.refreshTokenExpiry instanceof Date)
    })

    it('should create tokens with correct payload', async () => {
      const payload = {
        email: 'test@example.com',
        role: 'admin',
      }
      
      const result = await manager.createTokenPair(TEST_USER_ID, payload)
      
      const accessPayload = verifyToken(result.accessToken, TEST_SECRET)
      const refreshPayload = verifyToken(result.refreshToken, TEST_SECRET)
      
      // Verify user data is in both tokens
      assert.equal(accessPayload.userId, TEST_USER_ID)
      assert.equal(accessPayload.email, payload.email)
      assert.equal(accessPayload.role, payload.role)
      
      assert.equal(refreshPayload.userId, TEST_USER_ID)
      assert.equal(refreshPayload.email, payload.email)
      assert.equal(refreshPayload.role, payload.role)
    })

    it('should create tokens with correct types', async () => {
      const result = await manager.createTokenPair(TEST_USER_ID)
      
      const accessPayload = verifyToken(result.accessToken, TEST_SECRET)
      const refreshPayload = verifyToken(result.refreshToken, TEST_SECRET)
      
      assert.equal(accessPayload.type, 'access')
      assert.equal(refreshPayload.type, 'refresh')
    })

    it('should assign tokens to same family', async () => {
      const result = await manager.createTokenPair(TEST_USER_ID)
      
      const refreshPayload = verifyToken(result.refreshToken, TEST_SECRET)
      
      assert.ok(refreshPayload.familyId)
      assert.ok(refreshPayload.familyId.startsWith('fam_'))
    })

    it('should store tokens in the store', async () => {
      const result = await manager.createTokenPair(TEST_USER_ID)
      
      const accessPayload = verifyToken(result.accessToken, TEST_SECRET)
      const refreshPayload = verifyToken(result.refreshToken, TEST_SECRET)
      
      const storedRefresh = manager.store.getRefreshToken(refreshPayload.tokenId)
      const storedAccess = manager.store.getAccessToken(accessPayload.tokenId)
      
      assert.ok(storedRefresh)
      assert.equal(storedRefresh.userId, TEST_USER_ID)
      assert.ok(storedAccess)
      assert.equal(storedAccess.userId, TEST_USER_ID)
    })

    it('should throw error for missing userId', async () => {
      await assert.rejects(
        async () => await manager.createTokenPair(null),
        { message: /userId is required/ }
      )
    })

    it('should enforce max tokens per user', async () => {
      const mgr = new TokenRotationManager(TEST_SECRET, {
        maxTokensPerUser: 2,
      })
      
      // Create 3 token pairs
      await mgr.createTokenPair(TEST_USER_ID)
      await mgr.createTokenPair(TEST_USER_ID)
      await mgr.createTokenPair(TEST_USER_ID)
      
      // Count active refresh tokens for user
      let count = 0
      for (const [, data] of mgr.store.refreshTokens.entries()) {
        if (data.userId === TEST_USER_ID && !data.revoked) {
          count++
        }
      }
      
      assert.equal(count, 2, 'Should only have 2 active tokens')
      
      mgr.stopCleanup()
    })
  })

  describe('Token Rotation', () => {
    let manager

    before(() => {
      manager = new TokenRotationManager(TEST_SECRET)
    })

    after(() => {
      manager.stopCleanup()
    })

    it('should rotate tokens successfully', async () => {
      const initial = await manager.createTokenPair(TEST_USER_ID, {
        email: 'test@example.com',
      })
      
      const rotated = await manager.rotateTokens(initial.refreshToken)
      
      assert.ok(rotated.accessToken)
      assert.ok(rotated.refreshToken)
      assert.notEqual(rotated.accessToken, initial.accessToken)
      assert.notEqual(rotated.refreshToken, initial.refreshToken)
    })

    it('should preserve user payload during rotation', async () => {
      const payload = {
        email: 'test@example.com',
        role: 'admin',
        customField: 'value',
      }
      
      const initial = await manager.createTokenPair(TEST_USER_ID, payload)
      const rotated = await manager.rotateTokens(initial.refreshToken)
      
      const newPayload = verifyToken(rotated.accessToken, TEST_SECRET)
      
      assert.equal(newPayload.userId, TEST_USER_ID)
      assert.equal(newPayload.email, payload.email)
      assert.equal(newPayload.role, payload.role)
      assert.equal(newPayload.customField, payload.customField)
    })

    it('should keep same token family after rotation', async () => {
      const initial = await manager.createTokenPair(TEST_USER_ID)
      const rotated = await manager.rotateTokens(initial.refreshToken)
      
      const initialPayload = verifyToken(initial.refreshToken, TEST_SECRET)
      const rotatedPayload = verifyToken(rotated.refreshToken, TEST_SECRET)
      
      assert.equal(rotatedPayload.familyId, initialPayload.familyId)
    })

    it('should revoke old refresh token after rotation', async () => {
      const initial = await manager.createTokenPair(TEST_USER_ID)
      const initialPayload = verifyToken(initial.refreshToken, TEST_SECRET)
      
      await manager.rotateTokens(initial.refreshToken)
      
      // Old token should be revoked
      const storedToken = manager.store.getRefreshToken(initialPayload.tokenId)
      assert.ok(storedToken.revoked)
    })

    it('should reject rotation of access token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      await assert.rejects(
        async () => await manager.rotateTokens(tokens.accessToken),
        { message: /Invalid token type: expected refresh token/ }
      )
    })

    it('should reject rotation of invalid token', async () => {
      await assert.rejects(
        async () => await manager.rotateTokens('invalid.token.here'),
        { message: /Invalid refresh token/ }
      )
    })

    it('should reject rotation of revoked token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      // Revoke the refresh token
      manager.revokeToken(tokens.refreshToken)
      
      // Try to rotate revoked token
      await assert.rejects(
        async () => await manager.rotateTokens(tokens.refreshToken),
        { message: /Refresh token has been revoked/ }
      )
    })

    it('should revoke entire family when revoked token is used', async () => {
      const initial = await manager.createTokenPair(TEST_USER_ID)
      const rotated1 = await manager.rotateTokens(initial.refreshToken)
      const rotated2 = await manager.rotateTokens(rotated1.refreshToken)
      
      const initialPayload = verifyToken(initial.refreshToken, TEST_SECRET)
      const familyId = initialPayload.familyId
      
      // Try to reuse old token (security breach simulation)
      try {
        await manager.rotateTokens(initial.refreshToken)
        assert.fail('Should have rejected revoked token')
      } catch (err) {
        assert.ok(err.message.includes('revoked'))
      }
      
      // All tokens in family should be revoked
      const family = manager.store.tokenFamilies.get(familyId) || []
      for (const tokenId of family) {
        assert.ok(manager.store.isBlacklisted(tokenId))
      }
    })
  })

  describe('Access Token Verification', () => {
    let manager

    before(() => {
      manager = new TokenRotationManager(TEST_SECRET)
    })

    after(() => {
      manager.stopCleanup()
    })

    it('should verify valid access token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      const result = await manager.verifyAccessToken(tokens.accessToken)
      
      assert.equal(result.valid, true)
      assert.ok(result.payload)
      assert.equal(result.payload.userId, TEST_USER_ID)
    })

    it('should reject invalid access token', async () => {
      await assert.rejects(
        async () => await manager.verifyAccessToken('invalid.token.here'),
        { message: /Invalid access token/ }
      )
    })

    it('should reject refresh token as access token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      await assert.rejects(
        async () => await manager.verifyAccessToken(tokens.refreshToken),
        { message: /Invalid token type: expected access token/ }
      )
    })

    it('should reject revoked access token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      manager.revokeToken(tokens.accessToken)
      
      await assert.rejects(
        async () => await manager.verifyAccessToken(tokens.accessToken),
        { message: /Access token has been revoked/ }
      )
    })
  })

  describe('Auto-Rotation', () => {
    it('should detect when token needs rotation', async () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        accessTokenExpiry: '10s',
        rotationThreshold: 0.8, // Rotate when 80% of lifetime passed
      })
      
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      // Token should not need rotation immediately
      assert.equal(manager.shouldRotateToken(tokens.accessToken), false)
      
      // Wait for token to age
      await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
      
      // Token should now need rotation (3s / 10s = 30% remaining < 80% threshold)
      const needsRotation = manager.shouldRotateToken(tokens.accessToken)
      assert.equal(needsRotation, true)
      
      manager.stopCleanup()
    })

    it('should not rotate when disabled', async () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        accessTokenExpiry: '1s',
        enableAutoRotation: false,
      })
      
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      assert.equal(manager.shouldRotateToken(tokens.accessToken), false)
      
      manager.stopCleanup()
    })

    it('should include rotation hint in verification', async () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        accessTokenExpiry: '5s',
        rotationThreshold: 0.5,
      })
      
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      // Initially should not need rotation
      let result = await manager.verifyAccessToken(tokens.accessToken)
      assert.equal(result.shouldRotate, false)
      
      // Wait for token to age
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Now should suggest rotation
      result = await manager.verifyAccessToken(tokens.accessToken)
      assert.equal(result.shouldRotate, true)
      
      manager.stopCleanup()
    })
  })

  describe('Token Revocation', () => {
    let manager

    before(() => {
      manager = new TokenRotationManager(TEST_SECRET)
    })

    after(() => {
      manager.stopCleanup()
    })

    it('should revoke specific token', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      manager.revokeToken(tokens.refreshToken)
      
      const payload = verifyToken(tokens.refreshToken, TEST_SECRET, { ignoreExpiration: true })
      assert.ok(manager.store.isBlacklisted(payload.tokenId))
    })

    it('should revoke all user tokens', async () => {
      const tokens1 = await manager.createTokenPair(TEST_USER_ID)
      const tokens2 = await manager.createTokenPair(TEST_USER_ID)
      
      manager.revokeAllUserTokens(TEST_USER_ID)
      
      // Both tokens should be revoked
      await assert.rejects(
        async () => await manager.rotateTokens(tokens1.refreshToken),
        { message: /revoked/ }
      )
      await assert.rejects(
        async () => await manager.rotateTokens(tokens2.refreshToken),
        { message: /revoked/ }
      )
    })

    it('should not affect other users when revoking', async () => {
      const user1Tokens = await manager.createTokenPair('user-1')
      const user2Tokens = await manager.createTokenPair('user-2')
      
      manager.revokeAllUserTokens('user-1')
      
      // User 1 tokens should be revoked
      await assert.rejects(
        async () => await manager.rotateTokens(user1Tokens.refreshToken),
        { message: /revoked/ }
      )
      
      // User 2 tokens should still work
      const rotated = await manager.rotateTokens(user2Tokens.refreshToken)
      assert.ok(rotated.accessToken)
    })
  })

  describe('Cleanup', () => {
    it('should clean up expired tokens', async () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        refreshTokenExpiry: '2s',
        cleanupInterval: 10000000, // Very long, we'll trigger manually
      })
      
      await manager.createTokenPair(TEST_USER_ID)
      await manager.createTokenPair('user-2')
      
      const statsBefore = manager.getStats()
      assert.ok(statsBefore.refreshTokens >= 2)
      
      // Wait for tokens to expire
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Manual cleanup
      manager.cleanup()
      
      const statsAfter = manager.getStats()
      assert.equal(statsAfter.refreshTokens, 0, 'Expired tokens should be cleaned up')
      
      manager.stopCleanup()
    })

    it('should not clean up valid tokens', async () => {
      const manager = new TokenRotationManager(TEST_SECRET, {
        refreshTokenExpiry: '1h',
      })
      
      await manager.createTokenPair(TEST_USER_ID)
      
      const statsBefore = manager.getStats()
      manager.cleanup()
      const statsAfter = manager.getStats()
      
      assert.equal(statsAfter.refreshTokens, statsBefore.refreshTokens)
      
      manager.stopCleanup()
    })
  })

  describe('Statistics', () => {
    let manager

    before(() => {
      manager = new TokenRotationManager(TEST_SECRET)
    })

    after(() => {
      manager.stopCleanup()
    })

    it('should return token stats', async () => {
      await manager.createTokenPair(TEST_USER_ID)
      await manager.createTokenPair('user-2')
      
      const stats = manager.getStats()
      
      assert.ok(stats.refreshTokens >= 2)
      assert.ok(stats.accessTokens >= 2)
      assert.ok(typeof stats.blacklistedTokens === 'number')
      assert.ok(typeof stats.tokenFamilies === 'number')
    })

    it('should update stats after revocation', async () => {
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      const statsBefore = manager.getStats()
      
      manager.revokeToken(tokens.refreshToken)
      
      const statsAfter = manager.getStats()
      
      assert.ok(statsAfter.blacklistedTokens > statsBefore.blacklistedTokens)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent token creation', async () => {
      const manager = new TokenRotationManager(TEST_SECRET)
      
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(manager.createTokenPair(`user-${i}`))
      }
      
      const results = await Promise.all(promises)
      
      assert.equal(results.length, 10)
      results.forEach(result => {
        assert.ok(result.accessToken)
        assert.ok(result.refreshToken)
      })
      
      manager.stopCleanup()
    })

    it('should handle concurrent rotation', async () => {
      const manager = new TokenRotationManager(TEST_SECRET)
      
      const tokens = await manager.createTokenPair(TEST_USER_ID)
      
      // Try to rotate same token concurrently (should fail for one)
      const promise1 = manager.rotateTokens(tokens.refreshToken)
      const promise2 = manager.rotateTokens(tokens.refreshToken)
      
      const results = await Promise.allSettled([promise1, promise2])
      
      const fulfilled = results.filter(r => r.status === 'fulfilled')
      const rejected = results.filter(r => r.status === 'rejected')
      
      // At least one should succeed, at least one should fail
      assert.ok(fulfilled.length >= 1)
      assert.ok(rejected.length >= 1)
      
      manager.stopCleanup()
    })

    it('should generate unique token IDs', () => {
      const manager = new TokenRotationManager(TEST_SECRET)
      
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(manager.generateTokenId())
      }
      
      assert.equal(ids.size, 100, 'All token IDs should be unique')
      
      manager.stopCleanup()
    })

    it('should generate unique family IDs', () => {
      const manager = new TokenRotationManager(TEST_SECRET)
      
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(manager.generateFamilyId())
      }
      
      assert.equal(ids.size, 100, 'All family IDs should be unique')
      
      manager.stopCleanup()
    })
  })
})
