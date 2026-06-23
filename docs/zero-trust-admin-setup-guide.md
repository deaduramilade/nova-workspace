# Zero-Trust MFA Admin Setup Guide

## Quick Start: 5 Minutes

### Step 1: Access Zero-Trust Login
Navigate to: `https://your-domain/login/zero-trust`

### Step 2: Enter Your Credentials
- **Username**: Your admin username
- **Password**: Your admin password
- **Device Name** (optional): Give your device a friendly name
  - Examples: "Work MacBook", "Admin iPhone", "Conference Room Laptop"

### Step 3: Device Fingerprinting
The system will automatically capture:
- Browser and OS information
- Your IP address
- Screen resolution
- Language preferences

No action needed - this is automatic!

### Step 4: MFA Verification
Depending on your risk level:
- **Low Risk**: You may be logged in immediately
- **Medium Risk**: Enter your TOTP code from your authenticator app
- **High Risk**: Check your email for an additional verification code
- **Critical Risk**: An admin will review and approve your login

### Step 5: Access Your Device Dashboard
Once logged in, visit: `/admin/devices`

Here you can:
- View all your registered devices
- Mark devices as "trusted"
- View active sessions
- Revoke sessions if needed

---

## Features Explained

### Risk Levels & Colors

| Risk Level | Color | What It Means | What Happens |
|------------|-------|---------------|--------------|
| 🟢 Low | Green | Normal login pattern | Usually automatic approval |
| 🟡 Medium | Yellow | Some unusual factors | TOTP MFA required |
| 🟠 High | Orange | Multiple unusual factors | Email OTP required |
| 🔴 Critical | Red | Significant risk detected | Admin approval required |

### Device Trust Status

#### 🔒 Trusted Device
- System recognizes and trusts this device
- Fewer MFA requirements for future logins
- You can revoke access anytime

#### ⚠️ Pending Device
- New device or recently untrusted
- Full MFA verification required
- After successful login, you can mark as trusted

#### 🚫 Blocked Device
- Compromised or revoked by you or admin
- Cannot log in from this device
- Contact admin to unblock

### Active Sessions

Each session shows:
- **Device Name**: Friendly name you assigned
- **IP Address**: Where you're logging in from
- **Auth Method**: How you authenticated (password + MFA type)
- **Created/Expires**: Session lifetime
- **Last Activity**: When you were last active

---

## Common Tasks

### Registering a New Device

**Scenario**: You got a new laptop and want to use it for admin tasks

1. Go to `/login/zero-trust`
2. Enter credentials
3. Give device a name: "New Work MacBook"
4. Complete MFA if prompted
5. Go to `/admin/devices`
6. Find your new device
7. Click "Trust Device"
8. Next login from this device will require less MFA

### Suspecting Compromised Device

**Scenario**: You lose your laptop or suspect someone has your credentials

1. Go to `/admin/devices`
2. Find the device
3. Click "Revoke Device"
4. Go to "Active Sessions"
5. Click "Revoke All Sessions"
6. Log in from a trusted device
7. Change your password

### Traveling & Unusual Location

**Scenario**: You're traveling internationally and system detects "unusual location"

1. You may see a "High Risk" warning
2. Complete additional MFA (check email)
3. This is normal for new locations
4. After a few logins, system learns this is normal for you

### Managing Multiple Devices

**Best Practice**: Register 2-3 trusted devices

- **Work Laptop**: Primary daily device
- **Personal Phone**: Secondary, for when away from desk
- **Tablet**: Optional, for travel

Each device can have independent trust settings and permissions.

---

## Security Best Practices

### ✅ DO

- ✅ Use a unique device name for each device (don't use "Device 1")
- ✅ Review your active sessions monthly
- ✅ Revoke sessions from devices you no longer use
- ✅ Trust only devices you physically control
- ✅ Report suspicious login attempts immediately
- ✅ Use strong passwords (12+ characters, mixed case, numbers)
- ✅ Keep your TOTP backup codes in a safe place

### ❌ DON'T

- ❌ Share your device name or session ID with others
- ❌ Trust public computers (library, airport, etc.)
- ❌ Use the same device name for different devices
- ❌ Ignore "High Risk" or "Critical Risk" warnings
- ❌ Share TOTP secret with anyone
- ❌ Keep too many old sessions active

---

## Troubleshooting

### Problem: "Invalid Device or Device Blocked"

**Reason**: Your device was flagged as risky or admin blocked it

**Solution**:
1. Try logging in from another trusted device
2. Contact your admin to review the block reason
3. If it's your device, request unblock
4. Once unblocked, you may need to re-register it

### Problem: "Always Requires TOTP"

**Reason**: Device trust level is still building or unusual patterns detected

**Solution**:
1. Device trust increases after successful logins
2. If traveling, this is normal while system learns
3. Use the same device consistently
4. Contact admin if it continues

### Problem: Can't See My Devices

**Reason**: Not an admin, or admin feature not yet enabled for your role

**Solution**:
1. Confirm you have admin privileges
2. Contact your system administrator
3. Device management might be in beta

### Problem: Session Expires Too Quickly

**Reason**: Inactivity timeout (default: 60 minutes)

**Solution**:
1. This is security feature - log in again
2. Use browser "Remember Me" if available
3. Contact admin if timeout is too short

---

## Risk Assessment Factors

The system calculates your risk level based on:

### ✓ Factors That LOWER Risk
- Trusted device
- Same IP as previous logins
- Logins during work hours (9 AM - 5 PM)
- Successful TOTP verification
- Device used regularly

### ✗ Factors That INCREASE Risk
- New device
- Unusual IP address or location
- Login outside work hours
- Unusual login patterns
- Failed login attempts
- Rapid IP changes

---

## Myths vs Facts

| Myth | Fact |
|------|------|
| Device fingerprinting tracks my location | Only IP is tracked; no GPS or location services used |
| Trusted devices never need MFA | Trusted devices still need TOTP for sensitive ops |
| My device will auto-login forever | Trust expires after 90 days if unused |
| Only admins can use this system | Can be enabled for all users by admin |

---

## Getting Help

### For Account/Device Issues
- **Email**: support@your-domain.com
- **Subject**: "Zero-Trust Login - [Your Issue]"

### For Security Concerns
- **Report Immediately**: security@your-domain.com
- Include: What happened, when, from which device

### For Technical Support
- Contact your IT helpdesk
- Include: Session ID (if available) from `/admin/devices`

---

## Advanced Features (Coming Soon)

- 🔐 WebAuthn - Passwordless login with hardware keys
- 📱 Biometric - Face/fingerprint authentication
- 🌍 Geolocation - Automatic location verification
- 📲 Push Notifications - Instant login alerts
- 📊 Compliance Reports - Audit trail exports

---

## FAQ

**Q: How long before a device is "trusted"?**
A: After 1-2 successful logins with proper MFA. Trust level increases over time.

**Q: Can I have unlimited devices?**
A: Yes, but recommend keeping 3-5 active devices for security.

**Q: What happens if I forget my device name?**
A: You can update it in the device settings.

**Q: Can admin see my passwords?**
A: No. Only device info and login patterns are visible to admins.

**Q: What if I lose my phone with TOTP app?**
A: Contact admin - they can issue emergency access codes.

**Q: How often do I need to re-login?**
A: Every 8 hours of active use, or after inactivity timeout.

---

## System Requirements

| Component | Minimum |
|-----------|---------|
| Browser | Chrome, Firefox, Safari (last 2 versions) |
| JavaScript | Must be enabled |
| Cookies | Must be enabled for session storage |
| Internet | Stable connection recommended |

---

Last Updated: January 2026
For latest updates, visit: [Documentation Link]
