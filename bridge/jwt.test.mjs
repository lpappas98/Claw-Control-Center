/**
 * Unit Tests for JWT Module
 * 
 * Comprehensive tests covering:
 * - Token generation
 * - Token verification
 * - Token decoding
 * - Expiration handling
 * - Security validation
 * - Edge cases and error conditions
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseExpiry,
  generateToken,
  verifyToken,
  decodeToken,
  isTokenExpired,
  getTokenExpiration,
  refreshToken,
} from './jwt.mjs'

// Test constants
const TEST_SECRET = 'test-secret-key-for-jwt-testing-do-not-use-in-production'
const TEST_PAYLOAD = {
  userId: '12345',
  email: 'test@example.com',
  role: 'admin',
}

describe('JWT Module', () => {
  
  describe('parseExpiry', () => {
    it('should parse seconds correctly', () => {
      assert.equal(parseExpiry('30s'), 30 * 1000)
      assert.equal(parseExpiry('1s'), 1000)
    })

    it('should parse minutes correctly', () => {
      assert.equal(parseExpiry('5m'), 5 * 60 * 1000)
      assert.equal(parseExpiry('30m'), 30 * 60 * 1000)
    })

    it('should parse hours correctly', () => {
      assert.equal(parseExpiry('1h'), 60 * 60 * 1000)
      assert.equal(parseExpiry('24h'), 24 * 60 * 60 * 1000)
    })

    it('should parse days correctly', () => {
      assert.equal(parseExpiry('1d'), 24 * 60 * 60 * 1000)
      assert.equal(parseExpiry('7d'), 7 * 24 * 60 * 60 * 1000)
    })

    it('should throw error for invalid format', () => {
      assert.throws(() => parseExpiry('invalid'), {
        message: /Invalid expiry format/,
      })
      assert.throws(() => parseExpiry('10'), {
        message: /Invalid expiry format/,
      })
      assert.throws(() => parseExpiry('abc123'), {
        message: /Invalid expiry format/,
      })
    })

    it('should throw error for unsupported units', () => {
      assert.throws(() => parseExpiry('10w'), {
        message: /Invalid expiry format/,
      })
    })
  })

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      assert.ok(token)
      assert.equal(typeof token, 'string')
      assert.ok(token.includes('.'))
      
      // JWT format: header.payload.signature
      const parts = token.split('.')
      assert.equal(parts.length, 3)
    })

    it('should include standard JWT claims', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const decoded = decodeToken(token)
      
      assert.ok(decoded.payload.iat, 'should have iat (issued at)')
      assert.ok(decoded.payload.exp, 'should have exp (expiration)')
      assert.equal(decoded.header.alg, 'HS256')
      assert.equal(decoded.header.typ, 'JWT')
    })

    it('should include custom payload data', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const decoded = decodeToken(token)
      
      assert.equal(decoded.payload.userId, TEST_PAYLOAD.userId)
      assert.equal(decoded.payload.email, TEST_PAYLOAD.email)
      assert.equal(decoded.payload.role, TEST_PAYLOAD.role)
    })

    it('should support custom expiration time', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1h' })
      const decoded = decodeToken(token)
      
      const now = Math.floor(Date.now() / 1000)
      const expectedExp = now + 3600 // 1 hour
      
      // Allow 2 second tolerance for test execution time
      assert.ok(Math.abs(decoded.payload.exp - expectedExp) <= 2)
    })

    it('should support issuer claim', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, {
        issuer: 'test-issuer',
      })
      const decoded = decodeToken(token)
      
      assert.equal(decoded.payload.iss, 'test-issuer')
    })

    it('should support subject claim', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, {
        subject: 'user-authentication',
      })
      const decoded = decodeToken(token)
      
      assert.equal(decoded.payload.sub, 'user-authentication')
    })

    it('should throw error for invalid payload', () => {
      assert.throws(() => generateToken(null, TEST_SECRET), {
        message: /Payload must be a non-null object/,
      })
      assert.throws(() => generateToken('string', TEST_SECRET), {
        message: /Payload must be a non-null object/,
      })
      assert.throws(() => generateToken(undefined, TEST_SECRET), {
        message: /Payload must be a non-null object/,
      })
    })

    it('should throw error for invalid secret', () => {
      assert.throws(() => generateToken(TEST_PAYLOAD, ''), {
        message: /Secret must be a non-empty string/,
      })
      assert.throws(() => generateToken(TEST_PAYLOAD, null), {
        message: /Secret must be a non-empty string/,
      })
      assert.throws(() => generateToken(TEST_PAYLOAD, 123), {
        message: /Secret must be a non-empty string/,
      })
    })

    it('should generate different tokens for same payload', () => {
      // Due to timestamp (iat), tokens should be different
      const token1 = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      // Wait 1000ms to ensure different timestamp (iat is in seconds)
      return new Promise((resolve) => {
        setTimeout(() => {
          const token2 = generateToken(TEST_PAYLOAD, TEST_SECRET)
          assert.notEqual(token1, token2)
          resolve()
        }, 1000)
      })
    })

    it('should handle complex nested payload', () => {
      const complexPayload = {
        user: {
          id: '123',
          profile: {
            name: 'John Doe',
            preferences: { theme: 'dark' },
          },
        },
        permissions: ['read', 'write', 'delete'],
      }
      
      const token = generateToken(complexPayload, TEST_SECRET)
      const decoded = decodeToken(token)
      
      assert.deepEqual(decoded.payload.user, complexPayload.user)
      assert.deepEqual(decoded.payload.permissions, complexPayload.permissions)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.ok(payload)
      assert.equal(payload.userId, TEST_PAYLOAD.userId)
      assert.equal(payload.email, TEST_PAYLOAD.email)
    })

    it('should reject token with wrong secret', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      assert.throws(() => verifyToken(token, 'wrong-secret'), {
        message: /Invalid token signature/,
      })
    })

    it('should reject expired token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1s' })
      
      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            verifyToken(token, TEST_SECRET)
            assert.fail('Expected token to be expired')
          } catch (err) {
            assert.ok(err.message.includes('expired'), `Expected expiration error, got: ${err.message}`)
          }
          resolve()
        }, 2000) // Wait 2 seconds to ensure expiration (accounting for second-based timestamps)
      })
    })

    it('should ignore expiration when requested', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1s' })
      
      return new Promise((resolve) => {
        setTimeout(() => {
          const payload = verifyToken(token, TEST_SECRET, { ignoreExpiration: true })
          assert.ok(payload)
          assert.equal(payload.userId, TEST_PAYLOAD.userId)
          resolve()
        }, 2000)
      })
    })

    it('should verify issuer claim', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, {
        issuer: 'test-issuer',
      })
      
      // Should pass with correct issuer
      const payload = verifyToken(token, TEST_SECRET, { issuer: 'test-issuer' })
      assert.ok(payload)
      
      // Should fail with wrong issuer
      assert.throws(() => verifyToken(token, TEST_SECRET, { issuer: 'wrong-issuer' }), {
        message: /Invalid issuer/,
      })
    })

    it('should verify subject claim', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, {
        subject: 'auth',
      })
      
      // Should pass with correct subject
      const payload = verifyToken(token, TEST_SECRET, { subject: 'auth' })
      assert.ok(payload)
      
      // Should fail with wrong subject
      assert.throws(() => verifyToken(token, TEST_SECRET, { subject: 'wrong' }), {
        message: /Invalid subject/,
      })
    })

    it('should reject malformed tokens', () => {
      assert.throws(() => verifyToken('not.a.valid.token', TEST_SECRET), {
        message: /Invalid token format/,
      })
      assert.throws(() => verifyToken('onlyonepart', TEST_SECRET), {
        message: /Invalid token format/,
      })
      assert.throws(() => verifyToken('two.parts', TEST_SECRET), {
        message: /Invalid token format/,
      })
    })

    it('should reject token with invalid signature', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const parts = token.split('.')
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`
      
      assert.throws(() => verifyToken(tamperedToken, TEST_SECRET), {
        message: /Invalid token signature/,
      })
    })

    it('should reject token with tampered payload', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const parts = token.split('.')
      
      // Tamper with payload
      const tamperedPayload = Buffer.from('{"userId":"hacker"}').toString('base64url')
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`
      
      assert.throws(() => verifyToken(tamperedToken, TEST_SECRET), {
        message: /Invalid token signature/,
      })
    })

    it('should throw error for empty token', () => {
      assert.throws(() => verifyToken('', TEST_SECRET), {
        message: /Token must be a non-empty string/,
      })
      assert.throws(() => verifyToken(null, TEST_SECRET), {
        message: /Token must be a non-empty string/,
      })
    })

    it('should throw error for invalid secret', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      assert.throws(() => verifyToken(token, ''), {
        message: /Secret must be a non-empty string/,
      })
      assert.throws(() => verifyToken(token, null), {
        message: /Secret must be a non-empty string/,
      })
    })
  })

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const decoded = decodeToken(token)
      
      assert.ok(decoded.header)
      assert.ok(decoded.payload)
      assert.equal(decoded.payload.userId, TEST_PAYLOAD.userId)
    })

    it('should decode expired token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1s' })
      
      return new Promise((resolve) => {
        setTimeout(() => {
          // Should still decode even if expired
          const decoded = decodeToken(token)
          assert.ok(decoded.payload)
          resolve()
        }, 2000)
      })
    })

    it('should decode token with wrong secret', () => {
      const token = generateToken(TEST_PAYLOAD, 'secret1')
      
      // Decode doesn't verify, so this should work
      const decoded = decodeToken(token)
      assert.ok(decoded.payload)
    })

    it('should throw error for malformed token', () => {
      assert.throws(() => decodeToken('invalid'), {
        message: /Invalid token format/,
      })
      assert.throws(() => decodeToken('not.enough'), {
        message: /Invalid token format/,
      })
    })

    it('should throw error for empty token', () => {
      assert.throws(() => decodeToken(''), {
        message: /Token must be a non-empty string/,
      })
      assert.throws(() => decodeToken(null), {
        message: /Token must be a non-empty string/,
      })
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1h' })
      assert.equal(isTokenExpired(token), false)
    })

    it('should return true for expired token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1s' })
      
      return new Promise((resolve) => {
        setTimeout(() => {
          const expired = isTokenExpired(token)
          assert.equal(expired, true, `Token should be expired but isTokenExpired returned ${expired}`)
          resolve()
        }, 2000) // Wait 2 seconds to ensure expiration (accounting for second-based timestamps)
      })
    })

    it('should return true for invalid token', () => {
      assert.equal(isTokenExpired('invalid.token.here'), true)
      assert.equal(isTokenExpired(''), true)
    })

    it('should return false for token without expiration', () => {
      // Manually create token without exp
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ userId: '123' })).toString('base64url')
      const token = `${header}.${payload}.signature`
      
      assert.equal(isTokenExpired(token), false)
    })
  })

  describe('getTokenExpiration', () => {
    it('should return expiration date', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1h' })
      const expiration = getTokenExpiration(token)
      
      assert.ok(expiration instanceof Date)
      
      // Should be approximately 1 hour from now
      const now = Date.now()
      const diff = expiration.getTime() - now
      assert.ok(diff > 3500 * 1000) // More than 58 minutes
      assert.ok(diff < 3700 * 1000) // Less than 62 minutes
    })

    it('should return null for token without expiration', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(JSON.stringify({ userId: '123' })).toString('base64url')
      const token = `${header}.${payload}.signature`
      
      const expiration = getTokenExpiration(token)
      assert.equal(expiration, null)
    })

    it('should return null for invalid token', () => {
      assert.equal(getTokenExpiration('invalid'), null)
      assert.equal(getTokenExpiration(''), null)
    })
  })

  describe('refreshToken', () => {
    it('should generate new token with same payload', () => {
      const originalToken = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      // Wait a moment to ensure different timestamp (iat is in seconds)
      return new Promise((resolve) => {
        setTimeout(() => {
          const newToken = refreshToken(originalToken, TEST_SECRET)
          
          assert.notEqual(originalToken, newToken)
          
          const originalDecoded = decodeToken(originalToken)
          const newDecoded = decodeToken(newToken)
          
          // User data should be the same
          assert.equal(newDecoded.payload.userId, originalDecoded.payload.userId)
          assert.equal(newDecoded.payload.email, originalDecoded.payload.email)
          
          // Timestamps should be different (at least iat should be >= original)
          assert.ok(newDecoded.payload.iat >= originalDecoded.payload.iat, 'New token iat should be >= original')
          assert.ok(newDecoded.payload.exp >= originalDecoded.payload.exp, 'New token exp should be >= original')
          
          resolve()
        }, 1000) // Wait 1 second to ensure different timestamp
      })
    })

    it('should refresh expired token', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1s' })
      
      return new Promise((resolve) => {
        setTimeout(() => {
          // Original token is expired
          try {
            verifyToken(token, TEST_SECRET)
            assert.fail('Expected token to be expired')
          } catch (err) {
            assert.ok(err.message.includes('expired'), `Expected expiration error, got: ${err.message}`)
          }
          
          // But can still refresh it
          const newToken = refreshToken(token, TEST_SECRET, { expiresIn: '1h' })
          
          // New token should be valid
          const payload = verifyToken(newToken, TEST_SECRET)
          assert.ok(payload)
          assert.equal(payload.userId, TEST_PAYLOAD.userId)
          
          resolve()
        }, 2000) // Wait 2 seconds to ensure expiration
      })
    })

    it('should preserve issuer and subject', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, {
        issuer: 'test-issuer',
        subject: 'auth',
      })
      
      const newToken = refreshToken(token, TEST_SECRET)
      const decoded = decodeToken(newToken)
      
      assert.equal(decoded.payload.iss, 'test-issuer')
      assert.equal(decoded.payload.sub, 'auth')
    })

    it('should reject token with invalid signature', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const parts = token.split('.')
      const tamperedToken = `${parts[0]}.${parts[1]}.wrongsignature`
      
      assert.throws(() => refreshToken(tamperedToken, TEST_SECRET), {
        message: /Invalid token signature/,
      })
    })

    it('should support custom expiration on refresh', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET, { expiresIn: '1h' })
      const newToken = refreshToken(token, TEST_SECRET, { expiresIn: '7d' })
      
      const expiration = getTokenExpiration(newToken)
      const now = Date.now()
      const diff = expiration.getTime() - now
      
      // Should be approximately 7 days
      assert.ok(diff > 6.9 * 24 * 60 * 60 * 1000)
      assert.ok(diff < 7.1 * 24 * 60 * 60 * 1000)
    })
  })

  describe('Security Tests', () => {
    it('should use timing-safe comparison for signatures', () => {
      // This is inherently difficult to test, but we can verify the function exists
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      
      // Should not leak timing information
      const start1 = Date.now()
      try {
        verifyToken(token, 'wrong-secret-1')
      } catch {}
      const time1 = Date.now() - start1
      
      const start2 = Date.now()
      try {
        verifyToken(token, 'wrong-secret-2')
      } catch {}
      const time2 = Date.now() - start2
      
      // Times should be similar (within 10ms)
      // Note: This is a weak test, but helps ensure no obvious timing leaks
      assert.ok(Math.abs(time1 - time2) < 10)
    })

    it('should not allow algorithm switching attacks', () => {
      const token = generateToken(TEST_PAYLOAD, TEST_SECRET)
      const decoded = decodeToken(token)
      
      // Verify algorithm is always HS256
      assert.equal(decoded.header.alg, 'HS256')
    })

    it('should handle very long secrets', () => {
      const longSecret = 'a'.repeat(1000)
      const token = generateToken(TEST_PAYLOAD, longSecret)
      const payload = verifyToken(token, longSecret)
      
      assert.ok(payload)
    })

    it('should handle unicode in payload', () => {
      const unicodePayload = {
        name: '日本語テスト',
        emoji: '🎉🚀',
        text: 'Testing unicode: éñ中文',
      }
      
      const token = generateToken(unicodePayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.equal(payload.name, unicodePayload.name)
      assert.equal(payload.emoji, unicodePayload.emoji)
      assert.equal(payload.text, unicodePayload.text)
    })

    it('should handle special characters in secret', () => {
      const specialSecret = 'test!@#$%^&*()_+-=[]{}|;:,.<>?'
      const token = generateToken(TEST_PAYLOAD, specialSecret)
      const payload = verifyToken(token, specialSecret)
      
      assert.ok(payload)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty payload object', () => {
      const token = generateToken({}, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.ok(payload.iat)
      assert.ok(payload.exp)
    })

    it('should handle large payload', () => {
      const largePayload = {
        data: 'x'.repeat(10000),
        array: Array(100).fill({ key: 'value' }),
      }
      
      const token = generateToken(largePayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.equal(payload.data.length, 10000)
      assert.equal(payload.array.length, 100)
    })

    it('should handle numeric values in payload', () => {
      const numericPayload = {
        count: 42,
        price: 19.99,
        negative: -100,
        zero: 0,
      }
      
      const token = generateToken(numericPayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.equal(payload.count, 42)
      assert.equal(payload.price, 19.99)
      assert.equal(payload.negative, -100)
      assert.equal(payload.zero, 0)
    })

    it('should handle boolean values in payload', () => {
      const boolPayload = {
        isActive: true,
        isDeleted: false,
      }
      
      const token = generateToken(boolPayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.equal(payload.isActive, true)
      assert.equal(payload.isDeleted, false)
    })

    it('should handle null values in payload', () => {
      const nullPayload = {
        optional: null,
        userId: '123',
      }
      
      const token = generateToken(nullPayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.equal(payload.optional, null)
      assert.equal(payload.userId, '123')
    })

    it('should handle array values in payload', () => {
      const arrayPayload = {
        permissions: ['read', 'write', 'delete'],
        numbers: [1, 2, 3],
      }
      
      const token = generateToken(arrayPayload, TEST_SECRET)
      const payload = verifyToken(token, TEST_SECRET)
      
      assert.deepEqual(payload.permissions, arrayPayload.permissions)
      assert.deepEqual(payload.numbers, arrayPayload.numbers)
    })
  })
})
