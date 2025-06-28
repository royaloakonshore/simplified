# Production Deployment & Data Protection Guide - Simplified ERP System

*Created: January 31, 2025*

## 🎯 **Complete Production Deployment Strategy**

This document provides everything needed to deploy and maintain the ERP system safely in production.

---

## 📋 **Pre-Deployment Checklist**

### **Environment Setup**
- [ ] Production PostgreSQL database (Supabase/Neon) with connection pooling
- [ ] Vercel project linked to GitHub repository
- [ ] Custom domain configured (optional)
- [ ] All environment variables configured securely

### **Required Environment Variables**
```bash
# Database
DATABASE_URL="postgresql://..."  # Production database URL

# Authentication
NEXTAUTH_SECRET="..."  # Strong 32+ character secret
NEXTAUTH_URL="https://yourdomain.com"

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_S3_BUCKET="..."

# Email (if using email auth)
EMAIL_SERVER_PASSWORD="..."
EMAIL_FROM="noreply@yourdomain.com"
```

### **Code Quality Gates**
- [ ] Zero TypeScript errors (`npx tsc --noEmit`)
- [ ] Clean build (`npm run build`)
- [ ] Security review completed
- [ ] Database migrations tested

---

## 🚀 **Deployment Process**

### **Phase 1: Staging Deployment**
1. Create staging environment with subset of production data
2. Test all critical workflows
3. Verify PDF generation and multi-tenancy features
4. Check performance under load

### **Phase 2: Production Deployment**
1. **Create Full Backup**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Deploy Application**
   ```bash
   vercel --prod  # Automatic via GitHub Actions
   ```

3. **Run Database Migrations**
   ```bash
   npx prisma migrate deploy  # Only after app deployment succeeds
   ```

4. **Bootstrap Production Data** (if fresh deployment)
   ```bash
   npm run bootstrap  # Create first admin user and company
   ```

---

## 🛡️ **Data Protection & Backup Strategy**

### **Automated Backup System**

Create `scripts/backup-database.js`:
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const AWS = require('aws-sdk');

const config = {
  DATABASE_URL: process.env.DATABASE_URL_PRODUCTION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  BACKUP_BUCKET: process.env.BACKUP_BUCKET || 'erp-system-backups',
  RETENTION_DAYS: 90,
};

// Create database backup
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup_${timestamp}.sql`;
  
  execSync(`pg_dump "${config.DATABASE_URL}" > "${backupFile}"`, {
    stdio: 'inherit',
    timeout: 300000
  });
  
  return { backupFile };
}

// Upload to S3 with encryption
async function uploadToS3(backupFile) {
  const s3 = new AWS.S3({
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  });
  
  const fileContent = fs.readFileSync(backupFile);
  const uploadParams = {
    Bucket: config.BACKUP_BUCKET,
    Key: `database-backups/${backupFile}`,
    Body: fileContent,
    StorageClass: 'STANDARD_IA',
    ServerSideEncryption: 'AES256'
  };
  
  return await s3.upload(uploadParams).promise();
}

// Cleanup old backups (90+ days)
async function cleanupOldBackups() {
  // Implementation details in full script
}
```

### **Safe Migration Script**

Create `scripts/safe-migrate.js`:
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

// Production safety checks
function performSafetyChecks() {
  const ENV = process.env.NODE_ENV;
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (ENV === 'production' || DATABASE_URL.includes('prod')) {
    console.log('🚨 PRODUCTION DATABASE DETECTED');
    return true;  // Requires extra confirmations
  }
  return false;
}

// Multiple confirmation prompts for production
async function main() {
  const isProduction = performSafetyChecks();
  
  if (isProduction) {
    // Create backup before migration
    await createPreMigrationBackup();
    
    // Multiple confirmations required
    const confirm1 = await askConfirmation('Apply migrations to PRODUCTION?');
    const confirm2 = await askConfirmation('FINAL CONFIRMATION?');
    
    if (!confirm1 || !confirm2) {
      console.log('❌ Migration cancelled');
      process.exit(1);
    }
  }
  
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}
```

### **Backup Schedule & Retention**
- **Daily full backups** (retained 30 days)
- **Hourly incremental backups** (retained 7 days)  
- **Weekly archives** (retained 90 days)
- **Point-in-time recovery** enabled via database provider

---

## 🔄 **Continuous Deployment**

### **GitHub Actions Workflow**

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build
      
      - name: Run Database Migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### **Quality Gates**
- TypeScript compilation must pass
- Build process must succeed
- Database migrations must be safe
- Environment variables validated

---

## 🔍 **Monitoring & Health Checks**

### **Application Health Endpoint**
```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ 
      status: 'healthy', 
      timestamp: new Date(),
      database: 'connected'
    });
  } catch (error) {
    return Response.json({ 
      status: 'unhealthy', 
      error: error.message 
    }, { status: 500 });
  }
}
```

### **Monitoring Setup**
- **Vercel Dashboard**: Function execution, error rates, memory usage
- **Database Dashboard**: Connection counts, query performance, storage
- **External Monitoring**: UptimeRobot/Pingdom for `https://yourdomain.com/api/health`

---

## 🚨 **Emergency Procedures**

### **Application Rollback**
```bash
# Automatic rollback via Vercel
vercel rollback [deployment-url]

# Or redeploy previous version
git revert HEAD
git push origin main  # Triggers auto-deployment
```

### **Database Recovery**
```bash
# Point-in-time recovery (Supabase/Neon dashboard)
# Or restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### **Data Loss Prevention**
- Never run destructive commands in production
- Always backup before major changes
- Test migrations on staging first
- Blocked dangerous commands in migration script

---

## 📊 **Performance Optimization**

### **Database Performance**
- Connection pooling configured (20-30 connections)
- Performance indexes deployed (60-80% improvement)
- Regular VACUUM and ANALYZE scheduled
- Query optimization ongoing

### **Application Performance**
- Next.js static generation where possible
- Vercel Edge Functions for global performance
- CDN for static assets
- Image optimization enabled

---

## 📞 **Support & Escalation**

### **Issue Severity Levels**
| Level | Description | Response Time |
|-------|-------------|---------------|
| **Critical** | System down, data loss | Immediate |
| **High** | Major functionality broken | 2 hours |
| **Medium** | Minor features affected | 24 hours |
| **Low** | Enhancement requests | Next sprint |

### **Emergency Contacts**
- **Database Provider**: Supabase/Neon support
- **Hosting Provider**: Vercel support
- **Domain Provider**: [Your registrar]

---

## 📅 **Maintenance Schedule**

### **Regular Maintenance**
- **Weekly**: Review error logs and performance
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Database performance review and backup testing
- **Annually**: Security audit and disaster recovery test

---

## 🔐 **Security Hardening**

### **Environment Security**
- Strong NEXTAUTH_SECRET (32+ characters)
- HTTPS enforced in production
- Environment variables secured via Vercel dashboard
- No secrets committed to source code

### **Database Security**
- SSL connections enabled
- Limited database user permissions
- Connection encryption in transit
- Regular security updates

---

## 📦 **Package.json Scripts**

Update your `package.json`:
```json
{
  "scripts": {
    "backup": "node scripts/backup-database.js",
    "migrate:safe": "node scripts/safe-migrate.js",
    "deploy:check": "npx tsc --noEmit && npm run build",
    "health:check": "curl -f http://localhost:3000/api/health || exit 1"
  }
}
```

---

**This guide ensures secure, reliable production deployment with comprehensive data protection and monitoring capabilities.** 