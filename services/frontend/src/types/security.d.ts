declare module 'jwt-decode' {
  export function jwtDecode<T extends Record<string, unknown>>(token: string): T;
}

declare module 'react-toastify' {
  export const toast: {
    error: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
}

// Extend the global Navigator interface
declare global {
  interface Navigator {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    maxTouchPoints?: number;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      REACT_APP_ENCRYPTION_KEY?: string;
      REACT_APP_API_URL?: string;
      REACT_APP_WS_URL?: string;
      REACT_APP_API_KEY?: string;
      REACT_APP_ALLOWED_DOMAINS?: string;
    }
  }
}

export interface DecodedToken extends Record<string, unknown> {
  exp: number;
  sub: string;
  roles: string[];
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SecureHeaders extends Record<string, string> {
  [key: string]: string;
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum number of requests allowed in the window
}

export interface IPBlockConfig {
  maxAttempts: number;      // Maximum number of failed attempts before blocking
  blockDurationMs: number;  // Duration of the block in milliseconds
}

export interface DeviceFingerprint {
  id: string;
  components: (string | number)[];
  timestamp: number;
}

export type SecurityEventType = 
  | 'token_set'
  | 'token_removed'
  | 'token_refreshed'
  | 'rate_limit_exceeded'
  | 'ip_blocked'
  | 'failed_attempt'
  | 'security_data_cleared'
  | 'token_get_failed'
  | 'token_set_failed'
  | 'token_refresh_failed'
  | 'csrf_token_failed'
  | 'csp_policy_updated';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface CSPPolicy {
  directive: string;
  sources: string[];
}

export interface CSPManager {
  getInstance(): CSPManager;
  addPolicy(directive: string, sources: string[]): void;
  removePolicy(directive: string): void;
  getPolicyString(): string;
  validatePolicy(policy: string): boolean;
}

export interface SecurityManager {
  getToken(): Promise<string | null>;
  setToken(tokenData: TokenData): Promise<void>;
  removeToken(): void;
  isTokenValid(token: string): boolean;
  refreshToken(): Promise<boolean>;
  getCsrfToken(): Promise<string>;
  validatePasswordStrength(password: string): PasswordValidationResult;
  getSecureHeaders(): SecureHeaders;
  sanitizeInput(input: string): string;
  checkRateLimit(endpoint: string, config: RateLimitConfig): Promise<boolean>;
  checkIPBlock(ip: string, config: IPBlockConfig): Promise<boolean>;
  recordFailedAttempt(ip: string, config: IPBlockConfig): Promise<void>;
  getDeviceFingerprint(): Promise<DeviceFingerprint>;
  clearSecurityData(): Promise<void>;
  updateCSPPolicy(directive: string, sources: string[]): void;
}

declare const security: SecurityManager;
export { security }; 