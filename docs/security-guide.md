# Complete Security Guide - Simplified ERP System

*Created: January 31, 2025*

## 🛡️ **Comprehensive Security Framework**

This guide provides complete protection against hacking, data breaches, and security threats for your production ERP system.

---

## 🔐 **1. Authentication & Authorization Security**

### **Enhanced NextAuth Configuration**

```typescript
// lib/auth.ts - Production security implementation
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { ratelimit } from "@/lib/rate-limit";

const AUTH_SECURITY = {
  SESSION_MAX_AGE: 7 * 24 * 60 * 60,     // 7 days
  JWT_MAX_AGE: 24 * 60 * 60,             // 24 hours
  PASSWORD_MIN_LENGTH: 12,
  LOGIN_ATTEMPTS_LIMIT: 5,
  LOGIN_LOCKOUT_DURATION: 15 * 60,       // 15 minutes
  SECURE_COOKIES: process.env.NODE_ENV === 'production',
};

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: AUTH_SECURITY.SESSION_MAX_AGE,
    updateAge: 60 * 60, // Update every hour
  },
  
  jwt: {
    maxAge: AUTH_SECURITY.JWT_MAX_AGE,
    secret: process.env.NEXTAUTH_SECRET, // Must be 32+ characters
  },
  
  providers: [
    CredentialsProvider({
      async authorize(credentials, req) {
        // Rate limiting for login attempts
        const identifier = `login_${credentials.email}_${req?.headers?.['x-forwarded-for']}`;
        const { success } = await ratelimit.limit(identifier);
        
        if (!success) {
          throw new Error("Too many login attempts. Try again later.");
        }

        // Secure password verification
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() }
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);
        if (!isValidPassword) {
          // Log failed attempt
          console.warn(`Failed login: ${credentials.email} from ${req?.headers?.['x-forwarded-for']}`);
          throw new Error("Invalid credentials");
        }

        // Log successful login
        console.log(`Successful login: ${user.email}`);
        return user;
      }
    })
  ],

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: AUTH_SECURITY.SECURE_COOKIES,
        maxAge: AUTH_SECURITY.SESSION_MAX_AGE
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: AUTH_SECURITY.SECURE_COOKIES
      }
    }
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      // Security: Only allow redirects to same origin
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    }
  }
};
```

### **Rate Limiting Implementation**

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 h"), // 100 requests per hour
  analytics: true,
});

// API protection middleware
export async function protectAPI(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response("Rate limit exceeded", { status: 429 });
  }
  
  return null; // Continue processing
}
```

---

## 🌐 **2. Network & Infrastructure Security**

### **Security Headers Implementation**

```typescript
// middleware.ts - Comprehensive security headers
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Essential security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:;"
  );
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  return response;
}

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|favicon.ico).*)',
  ],
};
```

### **HTTPS Enforcement**

```javascript
// next.config.mjs - Force HTTPS in production
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://yourdomain.com/:path*',
        permanent: true,
      },
    ];
  },
};
```

---

## 🗄️ **3. Database Security**

### **Connection Security**
```bash
# Always use SSL connections
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"

# Use connection pooling
# Limit connection lifetime
# Enable prepared statements
```

### **Access Control & Permissions**
```sql
-- Create limited application user
CREATE USER erp_app WITH PASSWORD 'strong_password_here';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE erp_production TO erp_app;
GRANT USAGE ON SCHEMA public TO erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM erp_app;
REVOKE DROP ON ALL TABLES IN SCHEMA public FROM erp_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM erp_app;
```

### **Data Encryption**
```typescript
// lib/encryption.ts - Sensitive data encryption
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const secretKey = process.env.ENCRYPTION_KEY; // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipher(algorithm, secretKey);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
```

---

## 🔒 **4. Input Validation & Sanitization**

### **Comprehensive Input Validation**
```typescript
// lib/validation.ts - Secure input handling
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Strong validation schemas
export const secureEmailSchema = z.string()
  .email()
  .min(5)
  .max(254)
  .toLowerCase()
  .transform(email => email.trim());

export const securePasswordSchema = z.string()
  .min(12)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .refine(password => !commonPasswords.includes(password), {
    message: "Password is too common"
  });

// HTML sanitization
export function sanitizeHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}

// SQL injection prevention (using Prisma)
export async function safeQuery(email: string) {
  // ✅ Safe - Prisma handles parameterization
  return await prisma.user.findUnique({
    where: { email: email } // Automatically parameterized
  });
  
  // ❌ NEVER do this
  // return await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
}
```

### **File Upload Security**
```typescript
// lib/file-security.ts
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(file: File): boolean {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error('File type not allowed');
  }
  
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
  
  // Check file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeTypeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'pdf': 'application/pdf'
  };
  
  if (mimeTypeMap[extension] !== file.type) {
    throw new Error('File extension does not match content type');
  }
  
  return true;
}
```

---

## 🚨 **5. Audit Logging & Monitoring**

### **Comprehensive Audit System**
```typescript
// lib/audit-log.ts
interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  details: object;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(entry: AuditLogEntry) {
  await prisma.auditLog.create({
    data: {
      ...entry,
      details: JSON.stringify(entry.details),
      timestamp: new Date(),
    }
  });
}

// Usage in tRPC procedures
export const updateCustomer = companyProtectedProcedure
  .input(updateCustomerSchema)
  .mutation(async ({ ctx, input }) => {
    const result = await ctx.db.customer.update({
      where: { id: input.id, companyId: ctx.companyId },
      data: input,
    });
    
    // Log the action
    await logAuditEvent({
      userId: ctx.userId,
      action: 'UPDATE',
      resource: `customer:${input.id}`,
      details: input,
      ipAddress: ctx.req?.headers['x-forwarded-for'],
      userAgent: ctx.req?.headers['user-agent'],
    });
    
    return result;
  });
```

### **Security Monitoring**
```typescript
// lib/security-monitor.ts
export class SecurityMonitor {
  // Detect suspicious patterns
  static async detectSuspiciousActivity(userId: string, ipAddress: string) {
    const recentActions = await prisma.auditLog.count({
      where: {
        userId,
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });
    
    if (recentActions > 100) {
      await this.alertSecurityTeam('High activity volume', { userId, ipAddress });
    }
  }
  
  // Geographic anomaly detection
  static async checkGeographicAnomaly(userId: string, ipAddress: string) {
    // Check if login is from unusual location
    // Implementation would integrate with IP geolocation service
  }
  
  private static async alertSecurityTeam(type: string, data: object) {
    console.error(`SECURITY ALERT: ${type}`, data);
    // TODO: Integrate with alerting system (Slack, email, etc.)
  }
}
```

---

## 🛡️ **6. Environment & Secrets Security**

### **Secure Environment Configuration**
```bash
# .env.production - Never commit this file
NEXTAUTH_SECRET="super-long-random-string-minimum-32-characters-for-production-security"
DATABASE_URL="postgresql://..."
ENCRYPTION_KEY="another-32-char-key-for-data-encryption"

# AWS credentials for production
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."

# Email configuration
EMAIL_SERVER_PASSWORD="..."
```

### **Secrets Management Best Practices**
- Use Vercel environment variables for production secrets
- Never commit secrets to source code or documentation
- Rotate secrets regularly (quarterly minimum)
- Use unique, strong values for all secrets
- Monitor for secret exposure in logs

---

## 🚨 **7. Incident Response Plan**

### **Security Incident Response Procedure**

#### **Immediate Response (0-15 minutes)**
1. **Identify** the type and scope of the incident
2. **Document** screenshots/logs of the issue
3. **Contain** if ongoing attack (block IPs, revoke credentials)
4. **Alert** security team and stakeholders

#### **Containment (15-60 minutes)**
1. **Isolate** affected systems
2. **Revoke** compromised credentials
3. **Enable** additional monitoring
4. **Document** all actions taken

#### **Assessment (1-4 hours)**
1. **Determine** what data was accessed
2. **Identify** attack vectors and vulnerabilities
3. **Assess** damage and business impact
4. **Notify** authorities if required (GDPR, etc.)

#### **Recovery (4-24 hours)**
1. **Patch** vulnerabilities
2. **Restore** from clean backups if needed
3. **Reset** all potentially compromised passwords
4. **Update** security measures
5. **Conduct** post-incident review

### **Emergency Contacts**
```bash
# Security incident contacts
SECURITY_EMAIL="security@yourcompany.com"
INCIDENT_HOTLINE="+1-XXX-XXX-XXXX"

# Service provider support
VERCEL_SUPPORT="https://vercel.com/support"
SUPABASE_SUPPORT="https://supabase.com/support"
```

---

## 📋 **8. Security Checklist**

### **Pre-Production Security Audit**
- [ ] Strong NEXTAUTH_SECRET (32+ characters)
- [ ] Database connections use SSL/TLS
- [ ] Environment variables properly secured
- [ ] No secrets in source code
- [ ] Security headers configured
- [ ] Rate limiting enabled on all APIs
- [ ] Input validation covers all user inputs
- [ ] File upload restrictions in place
- [ ] Audit logging implemented
- [ ] Error monitoring configured

### **Post-Deployment Security**
- [ ] HTTPS enforced across entire application
- [ ] Security monitoring alerts configured
- [ ] Backup procedures tested and working
- [ ] Access logs being collected and reviewed
- [ ] Incident response plan documented and tested
- [ ] Security team contacts updated
- [ ] Regular security scans scheduled

### **Ongoing Security Maintenance**
- [ ] **Daily**: Monitor error logs for suspicious patterns
- [ ] **Weekly**: Review failed login attempts and unusual activity
- [ ] **Monthly**: Update dependencies with security patches
- [ ] **Quarterly**: Review user permissions and access
- [ ] **Annually**: Conduct penetration testing and security audit

---

## 🔄 **9. Compliance & Data Protection**

### **GDPR Compliance**
```typescript
// Data retention and deletion
const DATA_RETENTION = {
  USER_DATA: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
  AUDIT_LOGS: 3 * 365 * 24 * 60 * 60 * 1000, // 3 years
  TEMPORARY_DATA: 30 * 24 * 60 * 60 * 1000,  // 30 days
};

export async function anonymizeUserData(userId: string) {
  // Anonymize instead of delete for audit trail integrity
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted_${Date.now()}@anonymous.local`,
      name: 'Deleted User',
      firstName: null,
      // Preserve business relationships for continuity
    }
  });
}
```

---

## 🎯 **10. Security Tools & Services**

### **Recommended Security Stack**
- **Free/Open Source**:
  - Dependabot: Automated dependency updates
  - Snyk: Vulnerability scanning
  - OWASP ZAP: Security testing
  
- **Paid Services**:
  - Cloudflare: DDoS protection, WAF
  - Sentry: Error and performance monitoring
  - Auth0: Advanced authentication features (future)

---

**This comprehensive security guide provides enterprise-grade protection for your ERP system. Implement these measures systematically before production deployment.** 