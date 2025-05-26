import { security } from '../security';
import { Buffer } from 'buffer';
import { TokenData, RateLimitConfig, IPBlockConfig, PasswordValidationResult } from '@/types/security';
import { CSPManager } from '../CSPManager';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Security Manager', () => {
  const mockTokenData: TokenData = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() + 3600000
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should set and get token', async () => {
      await security.setToken(mockTokenData);
      const token = await security.getToken();
      expect(token).toBe(mockTokenData.accessToken);
    });

    it('should return null when no token exists', async () => {
      const token = await security.getToken();
      expect(token).toBeNull();
    });

    it('should remove token', async () => {
      await security.setToken(mockTokenData);
      security.removeToken();
      const token = await security.getToken();
      expect(token).toBeNull();
    });
  });

  describe('Password Validation', () => {
    it('should validate strong password', () => {
      const result: PasswordValidationResult = security.validatePasswordStrength('StrongP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result: PasswordValidationResult = security.validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should return secure headers', () => {
      const headers = security.getSecureHeaders();
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize input', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = security.sanitizeInput(input);
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit', async () => {
      const config = { windowMs: 1000, maxRequests: 5 };
      const result = await security.checkRateLimit('test-endpoint', config);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('IP Blocking', () => {
    it('should check IP block', async () => {
      const config = { maxAttempts: 3, blockDurationMs: 1000 };
      const result = await security.checkIPBlock('127.0.0.1', config);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Device Fingerprinting', () => {
    it('should generate device fingerprint', async () => {
      const fingerprint = await security.getDeviceFingerprint();
      expect(fingerprint).toHaveProperty('id');
      expect(fingerprint).toHaveProperty('components');
      expect(fingerprint).toHaveProperty('timestamp');
    });
  });

  describe('Security Data Management', () => {
    it('should clear security data', async () => {
      await security.setToken(mockTokenData);
      await security.clearSecurityData();
      const token = await security.getToken();
      expect(token).toBeNull();
    });
  });

  describe('CSRF Protection', () => {
    it('should get CSRF token', async () => {
      const mockToken = 'test-csrf-token';
      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: mockToken })
        })
      );

      const token = await security.getCsrfToken();
      expect(token).toBe(mockToken);
    });
  });

  describe('CSP Management', () => {
    it('should get CSP manager instance', () => {
      const cspManager = CSPManager.getInstance();
      expect(cspManager).toBeInstanceOf(CSPManager);
    });

    it('should add and remove policies', () => {
      const cspManager = CSPManager.getInstance();
      cspManager.addPolicy('test-directive', ['test-source']);
      expect(cspManager.getPolicyString()).toContain('test-directive test-source');
      cspManager.removePolicy('test-directive');
      expect(cspManager.getPolicyString()).not.toContain('test-directive');
    });

    it('should validate policies', () => {
      const cspManager = CSPManager.getInstance();
      const validPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'";
      const invalidPolicy = "invalid-directive 'self'";
      expect(cspManager.validatePolicy(validPolicy)).toBe(true);
      expect(cspManager.validatePolicy(invalidPolicy)).toBe(false);
    });
  });

  describe('URL Security', () => {
    it('should validate allowed URLs', () => {
      expect(security.validateUrl('https://localhost:3000')).toBe(true);
      expect(security.validateUrl('http://localhost:3000')).toBe(true);
      expect(security.validateUrl('https://example.com')).toBe(false);
    });

    it('should sanitize URLs', () => {
      expect(security.sanitizeUrl('https://localhost:3000')).toBe('https://localhost:3000/');
      expect(security.sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
      expect(security.sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(security.sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should handle invalid URLs', () => {
      expect(security.validateUrl('not-a-url')).toBe(false);
      expect(security.sanitizeUrl('not-a-url')).toBe('');
    });
  });
}); 