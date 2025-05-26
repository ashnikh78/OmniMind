# OmniMind Frontend Security

## Security Features

### Content Security Policy (CSP)
The application implements a robust Content Security Policy to prevent XSS attacks and control resource loading:

- Default policies for various resource types
- Dynamic policy updates
- Policy validation
- Secure defaults for all directives

Example usage:
```typescript
// Update CSP policy for a specific directive
security.updateCSPPolicy('script-src', ["'self'", 'https://trusted-cdn.com']);

// Get current CSP policy
const headers = security.getSecureHeaders();
const csp = headers['Content-Security-Policy'];
```

### URL Security
The application includes URL validation and sanitization to prevent malicious redirects and XSS attacks:

- Protocol validation (http/https only)
- Domain whitelisting
- Dangerous protocol filtering
- URL sanitization

Example usage:
```typescript
// Validate URL
const isValid = security.validateUrl('https://example.com');

// Sanitize URL
const sanitizedUrl = security.sanitizeUrl(userInput);
```

### Token Management
- Secure token storage with encryption
- Automatic token refresh
- Token expiration handling
- CSRF protection

### Rate Limiting
- Per-endpoint rate limiting
- Configurable time windows and request limits
- Automatic blocking of excessive requests

### IP Blocking
- Automatic IP blocking after failed attempts
- Configurable block duration
- Attempt tracking and logging

### Device Fingerprinting
- Unique device identification
- Component-based fingerprinting
- Secure hash generation

### Security Headers
- Content Security Policy (CSP)
- XSS Protection
- Frame Protection
- HSTS
- Referrer Policy
- Permissions Policy

### Input Sanitization
- HTML sanitization
- JavaScript injection prevention
- Event handler removal

## Best Practices

1. Always validate and sanitize user input
2. Use HTTPS for all communications
3. Implement proper CORS policies
4. Keep dependencies up to date
5. Follow the principle of least privilege
6. Use secure session management
7. Implement proper error handling
8. Regular security audits
9. Monitor security events
10. Use secure headers

## Configuration

The security features can be configured through environment variables:

```env
REACT_APP_ENCRYPTION_KEY=your-secure-key
REACT_APP_ALLOWED_DOMAINS=localhost,example.com
```

## Testing

The security features are thoroughly tested:

```bash
npm test
```

## Contributing

When contributing to the security features:

1. Follow security best practices
2. Add tests for new features
3. Update documentation
4. Review security implications
5. Consider edge cases

## License

This project is licensed under the MIT License - see the LICENSE file for details. 