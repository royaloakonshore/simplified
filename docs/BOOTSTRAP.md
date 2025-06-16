# System Bootstrap Guide

This guide explains how to bootstrap your multi-tenant ERP system when starting with an empty database.

## What is Bootstrap?

Bootstrap is the process of creating the first admin user and company in your ERP system. This is required when:

- Setting up the system for the first time
- After a complete database reset
- When deploying to a new environment

## When Bootstrap is Needed

The system automatically detects when bootstrap is needed by checking if there are **zero users** and **zero companies** in the database.

## Bootstrap Methods

### Method 1: Web Interface (Recommended)

The easiest way to bootstrap your system is through the web interface:

1. **Automatic Redirection**: When you visit the main application URL with an empty database, you'll be automatically redirected to `/bootstrap`

2. **Manual Access**: You can also access the bootstrap page directly at:
   ```
   https://yourdomain.com/bootstrap
   ```

3. **Fill in the Form**:
   - **Company Name**: Your organization's name
   - **Admin Name**: Full name of the admin user
   - **Admin Email**: Email address for the admin user
   - **Admin Password**: Secure password (minimum 8 characters)

4. **Submit**: Click "Bootstrap System" to create the admin user and company

5. **Login**: After successful bootstrap, you'll be redirected to the login page

### Method 2: CLI Script

For server environments or when the web interface isn't accessible:

1. **Install Dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Run Bootstrap Script**:
   ```bash
   npm run bootstrap
   ```

3. **Follow the Prompts**:
   ```
   🚀 ERP System Bootstrap CLI
   =====================================
   Current state: 0 users, 0 companies
   ✅ Database is empty. Ready for bootstrap.

   Enter company name: My Manufacturing Co
   Enter admin user name: John Doe
   Enter admin email: admin@company.com
   Enter admin password (min 8 chars): ********

   Creating admin user and company...
   ✅ Bootstrap completed successfully!
   📧 Admin user: admin@company.com
   🏢 Company: My Manufacturing Co
   🆔 Company ID: cm3abcd1234567890
   🆔 User ID: cm3efgh1234567890

   🎉 You can now login at the web interface!
   ```

## API Endpoints

### Check Bootstrap Status

```http
GET /api/bootstrap
```

**Response:**
```json
{
  "needsBootstrap": true,
  "userCount": 0,
  "companyCount": 0
}
```

### Create Bootstrap

```http
POST /api/bootstrap
Content-Type: application/json

{
  "adminEmail": "admin@company.com",
  "adminPassword": "securepassword123",
  "adminName": "John Doe",
  "companyName": "My Manufacturing Co"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Bootstrap completed successfully",
  "company": {
    "id": "cm3abcd1234567890",
    "name": "My Manufacturing Co"
  },
  "user": {
    "id": "cm3efgh1234567890",
    "email": "admin@company.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

**Error Response:**
```json
{
  "error": "Database already has users. Bootstrap is only allowed on empty databases."
}
```

## What Bootstrap Creates

When you run bootstrap, the system creates:

1. **Company Record**:
   - Company name as specified
   - Unique company ID
   - Created timestamp

2. **Admin User Record**:
   - Email and name as specified
   - Hashed password for security
   - Role set to `admin` (global admin privileges)
   - Linked to the created company as a member
   - Company set as the user's active company

3. **Relationships**:
   - User is automatically a member of the company
   - User's active company is set to the new company
   - Multi-tenancy is ready for additional users/companies

## Security Features

- **Empty Database Only**: Bootstrap only works when there are zero users and companies
- **Password Hashing**: Passwords are securely hashed using bcrypt with 12 rounds
- **Input Validation**: Email format and password strength validation
- **Transaction Safety**: All database operations are performed in a single transaction
- **No Backdoors**: Once users exist, bootstrap is completely disabled

## After Bootstrap

After successful bootstrap, you can:

1. **Login**: Use the admin credentials to log into the system
2. **Configure Settings**: Set up company details, VAT rates, etc.
3. **Create Users**: Add additional users to your company
4. **Create Companies**: Create additional companies (multi-tenant)
5. **Start Using**: Begin using all ERP features

## Troubleshooting

### "Database already has users" Error

This means your database is not empty. Bootstrap is only available for completely empty databases.

**Solutions:**
- If this is intentional and you want to reset everything, you'll need to manually clear your database
- If you just need to add a new company or user, use the regular admin functions in the web interface

### Bootstrap Page Shows "System Already Initialized"

This is normal behavior when the system has already been bootstrapped. Use the login page instead.

### CLI Script Fails

**Common issues:**
- Database connection problems: Check your `DATABASE_URL` environment variable
- Permission issues: Ensure the database user has CREATE permissions
- Missing dependencies: Run `npm install` first

### Web Interface Not Accessible

If you can't access the web interface:
1. Use the CLI method instead
2. Check if the application is running (`npm run dev` or `npm start`)
3. Verify your environment variables are set correctly

## Environment Variables

Ensure these environment variables are set:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/erp_db"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Email (for email-based auth after bootstrap)
EMAIL_SERVER_PASSWORD="your-email-password"
EMAIL_FROM="noreply@yourdomain.com"
```

## Next Steps

After successful bootstrap:

1. **Login** with your admin credentials
2. **Visit Settings** to configure company details
3. **Create additional users** if needed
4. **Explore the documentation** to learn about all features
5. **Start entering your data** (customers, inventory, etc.)

## Support

If you encounter issues with bootstrap:

1. Check the browser console for error messages
2. Check server logs for detailed error information
3. Verify your database connection and permissions
4. Ensure all environment variables are correctly set

The bootstrap process is designed to be foolproof and secure, but if you encounter persistent issues, please check the system logs for more detailed error information. 