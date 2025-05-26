import { Buffer } from 'buffer';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { CSPManager } from './CSPManager';
import type {
  DecodedToken,
  TokenData,
  SecureHeaders,
  PasswordValidationResult,
  RateLimitConfig,
  IPBlockConfig,
  DeviceFingerprint,
  SecurityEvent,
  SecurityEventType
} from '../types/security';

// Type declarations for external modules
declare module 'jwt-decode' {
  export function jwtDecode<T = any>(token: string): T;
}

declare module 'react-toastify' {
  export const toast: {
    error: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

interface DecodedToken {
  exp: number;
  sub: string;
  roles: string[];
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SecureHeaders {
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

class SecurityManager {
  private readonly ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'default-key';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly CSRF_KEY = 'csrf_token';
  private readonly RATE_LIMIT_KEY = 'rate_limit';
  private readonly IP_BLOCK_KEY = 'ip_block';
  private readonly SECURITY_EVENTS_KEY = 'security_events';
  private readonly MAX_EVENTS = 1000;
  private readonly cspManager: CSPManager;

  constructor() {
    this.cspManager = CSPManager.getInstance();
  }

  // Token Management
  async getToken(): Promise<string | null> {
    try {
      const encryptedToken = localStorage.getItem(this.TOKEN_KEY);
      if (!encryptedToken) return null;

      const tokenData = JSON.parse(this.decrypt(encryptedToken)) as TokenData;
      if (Date.now() >= tokenData.expiresAt) {
        await this.refreshToken();
        return this.getToken();
      }

      return tokenData.accessToken;
    } catch (error) {
      this.logSecurityEvent('token_get_failed', { error });
      return null;
    }
  }

  async setToken(tokenData: TokenData): Promise<void> {
    try {
      const encryptedToken = this.encrypt(JSON.stringify(tokenData));
      localStorage.setItem(this.TOKEN_KEY, encryptedToken);
      this.logSecurityEvent('token_set', { expiresAt: tokenData.expiresAt });
    } catch (error) {
      this.logSecurityEvent('token_set_failed', { error });
      throw new Error('Failed to set token');
    }
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.logSecurityEvent('token_removed');
  }

  isTokenValid(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const tokenData = await this.getTokenData();
      if (!tokenData) return false;

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.refreshToken}`
        }
      });

      if (!response.ok) throw new Error('Refresh failed');

      const newTokenData = await response.json();
      await this.setToken(newTokenData);
      this.logSecurityEvent('token_refreshed');
      return true;
    } catch (error) {
      this.logSecurityEvent('token_refresh_failed', { error });
      return false;
    }
  }

  // CSRF Protection
  async getCsrfToken(): Promise<string> {
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      const { token } = await response.json();
      localStorage.setItem(this.CSRF_KEY, token);
      return token;
    } catch (error) {
      this.logSecurityEvent('csrf_token_failed', { error });
      throw new Error('Failed to get CSRF token');
    }
  }

  // Password Security
  validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
    if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
    if (!hasNumbers) errors.push('Password must contain at least one number');
    if (!hasSpecialChar) errors.push('Password must contain at least one special character');

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Security Headers
  getSecureHeaders(): SecureHeaders {
    return {
      'Content-Security-Policy': this.cspManager.getPolicyString(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
  }

  // Input Sanitization
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  // Rate Limiting
  async checkRateLimit(endpoint: string, config: RateLimitConfig): Promise<boolean> {
    const key = `${this.RATE_LIMIT_KEY}:${endpoint}`;
    const now = Date.now();
    const data = JSON.parse(localStorage.getItem(key) || '{"requests":[]}');
    
    // Remove old requests
    data.requests = data.requests.filter((timestamp: number) => 
      now - timestamp < config.windowMs
    );

    if (data.requests.length >= config.maxRequests) {
      this.logSecurityEvent('rate_limit_exceeded', { endpoint });
      return false;
    }

    data.requests.push(now);
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }

  // IP Blocking
  async checkIPBlock(ip: string, config: IPBlockConfig): Promise<boolean> {
    const key = `${this.IP_BLOCK_KEY}:${ip}`;
    const data = JSON.parse(localStorage.getItem(key) || '{"attempts":[],"blockedUntil":0}');
    
    if (data.blockedUntil > Date.now()) {
      this.logSecurityEvent('ip_blocked', { ip, blockedUntil: data.blockedUntil });
      return false;
    }

    return true;
  }

  async recordFailedAttempt(ip: string, config: IPBlockConfig): Promise<void> {
    const key = `${this.IP_BLOCK_KEY}:${ip}`;
    const data = JSON.parse(localStorage.getItem(key) || '{"attempts":[],"blockedUntil":0}');
    
    data.attempts.push(Date.now());
    
    if (data.attempts.length >= config.maxAttempts) {
      data.blockedUntil = Date.now() + config.blockDurationMs;
      this.logSecurityEvent('ip_blocked', { ip, blockedUntil: data.blockedUntil });
    }

    localStorage.setItem(key, JSON.stringify(data));
  }

  // Device Fingerprinting
  async getDeviceFingerprint(): Promise<DeviceFingerprint> {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      navigator.deviceMemory || 0,
      navigator.maxTouchPoints || 0
    ];

    const id = await this.hashComponents(components);
    return {
      id,
      components,
      timestamp: Date.now()
    };
  }

  // Security Event Logging
  private logSecurityEvent(type: SecurityEventType, details?: Record<string, any>): void {
    const events = this.getSecurityEvents();
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      details
    };

    events.unshift(event);
    if (events.length > this.MAX_EVENTS) {
      events.pop();
    }

    localStorage.setItem(this.SECURITY_EVENTS_KEY, JSON.stringify(events));
  }

  private getSecurityEvents(): SecurityEvent[] {
    return JSON.parse(localStorage.getItem(this.SECURITY_EVENTS_KEY) || '[]');
  }

  // Utility Methods
  private async getTokenData(): Promise<TokenData | null> {
    try {
      const encryptedToken = localStorage.getItem(this.TOKEN_KEY);
      if (!encryptedToken) return null;
      return JSON.parse(this.decrypt(encryptedToken));
    } catch {
      return null;
    }
  }

  private async hashComponents(components: (string | number)[]): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(components.join('|'));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private encrypt(text: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const key = encoder.encode(this.ENCRYPTION_KEY);
    const encrypted = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ key[i % key.length];
    }
    
    return Buffer.from(encrypted).toString('base64');
  }

  private decrypt(encrypted: string): string {
    const data = Buffer.from(encrypted, 'base64');
    const key = new TextEncoder().encode(this.ENCRYPTION_KEY);
    const decrypted = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      decrypted[i] = data[i] ^ key[i % key.length];
    }
    
    return new TextDecoder().decode(decrypted);
  }

  // Data Cleanup
  async clearSecurityData(): Promise<void> {
    const keys = [
      this.TOKEN_KEY,
      this.CSRF_KEY,
      this.RATE_LIMIT_KEY,
      this.IP_BLOCK_KEY,
      this.SECURITY_EVENTS_KEY
    ];

    keys.forEach(key => {
      const pattern = new RegExp(`^${key}`);
      Object.keys(localStorage)
        .filter(k => pattern.test(k))
        .forEach(k => localStorage.removeItem(k));
    });

    this.logSecurityEvent('security_data_cleared');
  }

  // Add new method for CSP management
  updateCSPPolicy(directive: string, sources: string[]): void {
    this.cspManager.addPolicy(directive, sources);
    this.logSecurityEvent('csp_policy_updated', { directive, sources });
  }

  validateUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const allowedProtocols = ['http:', 'https:'];
      const allowedDomains = process.env.REACT_APP_ALLOWED_DOMAINS?.split(',') || ['localhost'];
      
      return (
        allowedProtocols.includes(parsedUrl.protocol) &&
        allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain))
      );
    } catch {
      return false;
    }
  }

  sanitizeUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const sanitizedUrl = new URL(parsedUrl.href);
      
      // Remove potentially dangerous URL parameters
      const dangerousParams = ['javascript:', 'data:', 'vbscript:'];
      for (const param of dangerousParams) {
        if (sanitizedUrl.href.includes(param)) {
          throw new Error('Dangerous URL detected');
        }
      }

      // Ensure protocol is http or https
      if (!['http:', 'https:'].includes(sanitizedUrl.protocol)) {
        sanitizedUrl.protocol = 'https:';
      }

      return sanitizedUrl.href;
    } catch {
      return '';
    }
  }
}

export const security = new SecurityManager(); 