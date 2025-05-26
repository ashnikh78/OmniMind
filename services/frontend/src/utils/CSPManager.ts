import type { CSPManager as ICSPManager } from '../types/security';

class CSPManager implements ICSPManager {
  private static instance: CSPManager;
  private policies: Map<string, string[]>;

  private constructor() {
    this.policies = new Map();
    this.initializeDefaultPolicies();
  }

  static getInstance(): CSPManager {
    if (!CSPManager.instance) {
      CSPManager.instance = new CSPManager();
    }
    return CSPManager.instance;
  }

  // Instance method to satisfy the interface
  getInstance(): CSPManager {
    return CSPManager.getInstance();
  }

  private initializeDefaultPolicies(): void {
    this.policies.set('default-src', ["'self'"]);
    this.policies.set('script-src', ["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    this.policies.set('style-src', ["'self'", "'unsafe-inline'"]);
    this.policies.set('img-src', ["'self'", 'data:', 'https:']);
    this.policies.set('connect-src', ["'self'", 'wss:', 'https:']);
    this.policies.set('font-src', ["'self'"]);
    this.policies.set('object-src', ["'none'"]);
    this.policies.set('media-src', ["'self'"]);
    this.policies.set('frame-src', ["'none'"]);
    this.policies.set('base-uri', ["'self'"]);
    this.policies.set('form-action', ["'self'"]);
  }

  addPolicy(directive: string, sources: string[]): void {
    this.policies.set(directive, sources);
  }

  removePolicy(directive: string): void {
    this.policies.delete(directive);
  }

  getPolicyString(): string {
    return Array.from(this.policies.entries())
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  validatePolicy(policy: string): boolean {
    const directives = policy.split(';').map(d => d.trim());
    return directives.every(directive => {
      const [name, ...sources] = directive.split(' ');
      return this.policies.has(name) && sources.every(source => 
        this.policies.get(name)?.includes(source) || source.startsWith('http')
      );
    });
  }
}

export { CSPManager }; 