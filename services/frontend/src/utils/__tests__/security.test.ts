import { security } from '../security';
import { Buffer } from 'buffer';
import { TokenData, RateLimitConfig, IPBlockConfig } from '../../types/security';
import { CSPManager } from '../../utils/CSPManager';

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

describe('SecurityManager', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Token Management', () => {
    const mockTokenData: TokenData = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600000
    };

    it('should set and get encrypted token', async () => {
      await security.setToken(mockTokenData);
      const token = await security.getToken();
      expect(token).toBe(mockTokenData.accessToken);
    });

    it('should remove token', async () => {
      await security.setToken(mockTokenData);
      security.removeToken();
      const token = await security.getToken();
      expect(token).toBeNull();
    });

    it('should validate token expiration', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.valid-signature';
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid-signature';
      
      expect(security.isTokenValid(validToken)).toBe(true);
      expect(security.isTokenValid(invalidToken)).toBe(false);
    });

    it('should refresh token', async () => {
      global.fetch = jest.fn().mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTokenData)
        })
      );

      await security.setToken(mockTokenData);
      const result = await security.refreshToken();
      expect(result).toBe(true);
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

  describe('Password Security', () => {
    it('should validate strong password', () => {
      const result = security.validatePasswordStrength('StrongP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const result = security.validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    const config: RateLimitConfig = {
      windowMs: 1000,
      maxRequests: 3
    };

    it('should allow requests within rate limit', async () => {
      const endpoint = 'test-endpoint';
      
      expect(await security.checkRateLimit(endpoint, config)).toBe(true);
      expect(await security.checkRateLimit(endpoint, config)).toBe(true);
      expect(await security.checkRateLimit(endpoint, config)).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      const endpoint = 'test-endpoint';
      
      await security.checkRateLimit(endpoint, config);
      await security.checkRateLimit(endpoint, config);
      await security.checkRateLimit(endpoint, config);
      expect(await security.checkRateLimit(endpoint, config)).toBe(false);
    });
  });

  describe('IP Blocking', () => {
    const config: IPBlockConfig = {
      maxAttempts: 3,
      blockDurationMs: 1000
    };

    it('should allow requests from non-blocked IP', async () => {
      const ip = '192.168.1.1';
      expect(await security.checkIPBlock(ip, config)).toBe(true);
    });

    it('should block IP after max attempts', async () => {
      const ip = '192.168.1.1';
      
      await security.recordFailedAttempt(ip, config);
      await security.recordFailedAttempt(ip, config);
      await security.recordFailedAttempt(ip, config);
      
      expect(await security.checkIPBlock(ip, config)).toBe(false);
    });
  });

  describe('Device Fingerprinting', () => {
    it('should generate unique device fingerprint', async () => {
      const fp1 = await security.getDeviceFingerprint();
      const fp2 = await security.getDeviceFingerprint();
      
      expect(fp1.id).toBe(fp2.id);
      expect(fp1.components).toHaveLength(10);
      expect(fp1.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML input', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = security.sanitizeInput(input);
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">test</div>';
      const sanitized = security.sanitizeInput(input);
      expect(sanitized).not.toContain('onclick');
    });
  });

  describe('Security Headers', () => {
    it('should return secure headers', () => {
      const headers = security.getSecureHeaders();
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('Data Cleanup', () => {
    it('should clear all security data', async () => {
      await security.setToken({
        accessToken: 'test',
        refreshToken: 'test',
        expiresAt: Date.now() + 3600000
      });
      
      await security.clearSecurityData();
      const token = await security.getToken();
      expect(token).toBeNull();
    });
  });

  describe('CSP Management', () => {
    it('should generate valid CSP policy string', () => {
      const headers = security.getSecureHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should update CSP policy', () => {
      security.updateCSPPolicy('script-src', ["'self'", 'https://trusted-cdn.com']);
      const headers = security.getSecureHeaders();
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain("script-src 'self' https://trusted-cdn.com");
    });

    it('should validate CSP policy', () => {
      const validPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'";
      const invalidPolicy = "invalid-directive 'self'; script-src 'unsafe-eval'";
      
      const cspManager = CSPManager.getInstance();
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