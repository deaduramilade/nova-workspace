# Zero-Trust Multi-Factor Authentication System for Admins

## Overview

This document describes the enhanced Zero-Trust MFA system for admin users that provides multiple device-based login options every day with continuous risk assessment and adaptive authentication.

## Key Features

### 1. **Device Fingerprinting & Recognition**
- Automatic device identification based on browser, OS, and hardware characteristics
- Stable device IDs that persist across sessions
- Device trust levels: `untrusted`, `low`, `medium`, `high`

### 2. **Multiple Daily Logins**
- Admins can log in multiple times per day from the same trusted device without additional verification
- Sessions expire after 8 hours of inactivity by default
- Multiple concurrent sessions allowed from different devices

### 3. **Risk Assessment Engine**
- Real-time risk score calculation (0-100)
- Detects anomalies:
  - Unusual login times (outside working hours)
  - New devices
  - Unfamiliar locations
  - Rapid IP changes
  - Failed login attempts
  
### 4. **Adaptive MFA**
- MFA requirements adjust based on risk level:
  - **Low Risk**: Single factor (password) may be sufficient for trusted devices
  - **Medium Risk**: TOTP MFA required
  - **High Risk**: Additional email OTP required
  - **Critical Risk**: Admin approval required

### 5. **Session Management**
- Per-device session tracking
- Revoke individual sessions or all sessions at once
- Session metadata includes IP, device, auth method, and MFA status

### 6. **Device Trust Management**
- Users can mark devices as trusted
- Admins can approve or block devices
- Passwordless login support for high-trust devices

## Architecture

### Database Schema

#### Device Fingerprints Table
```sql
CREATE TABLE device_fingerprints (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_id VARCHAR UNIQUE NOT NULL,
    fingerprint_hash VARCHAR NOT NULL,
    device_name VARCHAR,
    device_type VARCHAR,  -- laptop, phone, tablet
    browser VARCHAR,
    os VARCHAR,
    is_trusted BOOLEAN DEFAULT FALSE,
    trust_level VARCHAR DEFAULT 'untrusted',  -- untrusted, low, medium, high
    risk_score INTEGER DEFAULT 0,
    blocked BOOLEAN DEFAULT FALSE,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Trusted Devices Table
```sql
CREATE TABLE trusted_devices (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_fingerprint_id INTEGER NOT NULL,
    device_name VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    can_access_sensitive_endpoints BOOLEAN DEFAULT FALSE,
    allow_passwordless_login BOOLEAN DEFAULT FALSE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Admin Sessions Table
```sql
CREATE TABLE admin_sessions (
    id INTEGER PRIMARY KEY,
    session_id VARCHAR UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    device_id VARCHAR NOT NULL,
    ip_address VARCHAR NOT NULL,
    auth_method VARCHAR NOT NULL,  -- password_totp, webauthn, trusted_device
    mfa_verified BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0,
    anomalies_detected JSON,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    last_activity DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Login Attempts Table
```sql
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY,
    username VARCHAR NOT NULL,
    user_id INTEGER,
    success BOOLEAN DEFAULT FALSE,
    reason VARCHAR,  -- invalid_password, mfa_failed, device_blocked, etc.
    ip_address VARCHAR NOT NULL,
    device_fingerprint VARCHAR,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Login Flow

### Standard Login for Admins (Zero-Trust)

```
1. User navigates to /login/zero-trust
2. Enter username, password, and device name
3. Frontend captures device fingerprint:
   - User agent
   - Browser info
   - OS info
   - IP address
   - Screen resolution
   - Language settings
4. POST to /api/v1/auth/zero-trust/login with credentials + fingerprint
5. Backend:
   a. Verify username/password
   b. Generate device fingerprint hash
   c. Check if device exists, if not create it
   d. Check if device is blocked
   e. Calculate risk score based on:
      - Device trust level
      - Usage history
      - Login location
      - Time of day
      - Failed attempts
   f. Detect anomalies
   g. Determine MFA requirement based on risk
   h. If low risk + trusted device: issue token directly
   i. If medium risk: require TOTP
   j. If high risk: require additional verification
   k. If critical risk: hold for admin review
6. On MFA verification: Issue JWT with session_id
7. Frontend stores token and redirects to dashboard
```

### Risk Score Calculation

```python
Risk Score = Base Score + Adjustments

Base Components:
- New Device: +40 points
- Device not recently used: +20 points
- Unfamiliar location: +50 points
- Outside working hours: +30 points
- Recent failed attempts: +10 per attempt
- Rapid IP changes: +40 points

Reductions:
- Trusted device: -20 points
- Within working hours: -10 points
- Familiar location: -20 points

Risk Thresholds:
- 0-30: Low risk (no extra MFA needed for trusted devices)
- 31-50: Medium risk (TOTP required)
- 51-80: High risk (TOTP + additional factor)
- 81-100: Critical risk (admin approval required)
```

## API Endpoints

### Authentication Endpoints

#### Zero-Trust Login
```
POST /api/v1/auth/zero-trust/login
Content-Type: application/json

Request:
{
  "username": "admin@example.com",
  "password": "secure_password",
  "device_name": "Work Laptop",
  "device_fingerprint_data": {...},
  "user_agent": "Mozilla/5.0...",
  "ip_address": "192.168.1.100",
  "totp_code": "123456"  // optional, if MFA required
}

Response (Success):
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user": {...},
  "risk_assessment": {
    "risk_score": 35,
    "risk_level": "medium",
    "anomalies": {"unusual_time": 0.8},
    "requires_additional_mfa": true
  },
  "device": {
    "device_id": "device_fingerprint_id",
    "trust_level": "medium",
    "is_trusted": true
  }
}

Response (MFA Required):
{
  "mfa_required": true,
  "risk_score": 55,
  "anomalies": {...},
  "user": {...}
}
```

### Device Management Endpoints

#### Register Device
```
POST /api/v1/devices/register
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "device_name": "Personal MacBook",
  "user_agent": "Mozilla/5.0...",
  "ip_address": "203.0.113.42"
}

Response:
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_new": true,
  "requires_approval": true
}
```

#### Get My Devices
```
GET /api/v1/devices/my-devices
Authorization: Bearer <token>

Response:
{
  "total": 3,
  "devices": [
    {
      "id": 1,
      "device_name": "Work MacBook",
      "device_type": "laptop",
      "browser": "Chrome",
      "os": "macOS",
      "is_active": true,
      "last_used_at": "2024-01-15T14:30:00Z",
      "can_access_sensitive_endpoints": true,
      "allow_passwordless_login": true
    },
    ...
  ]
}
```

#### Trust Device
```
POST /api/v1/devices/trust/{device_id}
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "device_name": "Work MacBook"
}

Response:
{
  "message": "Device marked as trusted",
  "device_id": 1,
  "device_name": "Work MacBook"
}
```

#### Untrust Device
```
DELETE /api/v1/devices/untrust/{device_id}
Authorization: Bearer <token>

Response:
{
  "message": "Device untrusted"
}
```

### Session Management Endpoints

#### Get Active Sessions
```
GET /api/v1/devices/sessions
Authorization: Bearer <token>

Response:
{
  "total": 5,
  "active": 2,
  "sessions": [
    {
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "device_name": "Work Laptop",
      "created_at": "2024-01-15T09:00:00Z",
      "expires_at": "2024-01-15T17:00:00Z",
      "last_activity": "2024-01-15T14:30:00Z",
      "ip_address": "192.168.1.100",
      "auth_method": "password_totp",
      "mfa_verified": true
    },
    ...
  ]
}
```

#### Revoke Session
```
POST /api/v1/devices/sessions/revoke
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Suspicious activity detected"
}

Response:
{
  "message": "Session revoked"
}
```

#### Revoke All Sessions
```
POST /api/v1/devices/sessions/revoke-all
Authorization: Bearer <token>

Response:
{
  "message": "Revoked 4 sessions",
  "revoked_count": 4
}
```

### Admin Endpoints

#### List All Devices (Admin Only)
```
GET /api/v1/devices/admin/devices?skip=0&limit=50
Authorization: Bearer <admin_token>

Response:
{
  "total": 127,
  "devices": [
    {
      "id": 1,
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john.admin",
      "device_name": "MacBook Pro",
      "device_type": "laptop",
      "is_trusted": true,
      "trust_level": "high",
      "risk_score": 15,
      "blocked": false,
      "last_used": "2024-01-15T14:30:00Z"
    },
    ...
  ]
}
```

#### Block Device (Admin Only)
```
POST /api/v1/devices/admin/devices/{device_id}/block
Authorization: Bearer <admin_token>
Content-Type: application/json

Request:
{
  "reason": "Compromised device"
}

Response:
{
  "message": "Device blocked",
  "device_id": 1,
  "reason": "Compromised device"
}
```

## Security Features

### 1. Rate Limiting
- 10 login attempts per minute per IP address
- Failed attempts tracked and counted
- Exponential backoff after multiple failures

### 2. Session Security
- Stateless JWT tokens with session_id
- Session validation on every protected request
- Automatic revocation on security events

### 3. Audit Logging
- All login attempts logged (success and failure)
- Device registration tracked
- Session lifecycle events recorded
- Admin actions on devices logged

### 4. Risk-Based Access Control
- High-risk sessions have limited permissions
- Sensitive operations require additional MFA
- Device permissions can be restricted by admin

### 5. Anomaly Detection
- Time-based anomalies (unusual login hours)
- Location-based anomalies
- Device history analysis
- IP reputation checking

## Configuration

### Environment Variables

```env
# Session settings
SESSION_TIMEOUT_HOURS=8
MAX_INACTIVITY_MINUTES=60
MAX_CONCURRENT_SESSIONS=5

# Risk scoring
RISK_THRESHOLD_NEW_DEVICE=40
RISK_THRESHOLD_UNUSUAL_LOCATION=50
RISK_THRESHOLD_UNUSUAL_TIME=30
RISK_THRESHOLD_FAILED_ATTEMPTS=70

# MFA requirements
REQUIRE_MFA_FOR_ADMIN_LOGIN=true
MFA_HIGH_RISK_THRESHOLD=70
MFA_CRITICAL_RISK_THRESHOLD=85
```

## Client-Side Implementation

### Device Fingerprinting

```typescript
async function getDeviceFingerprint() {
  return {
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
  };
}
```

### Login Flow

```typescript
// 1. Get device fingerprint
const fingerprint = await getDeviceFingerprint();
const ip = await fetch("https://api.ipify.org?format=json").then(r => r.json());

// 2. Send login request
const response = await fetch("/api/v1/auth/zero-trust/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username,
    password,
    device_name,
    device_fingerprint_data: fingerprint,
    user_agent: navigator.userAgent,
    ip_address: ip.ip,
    totp_code,
  }),
});

// 3. Handle response
const data = await response.json();
if (data.mfa_required) {
  // Show MFA input
} else if (data.access_token) {
  // Store token and redirect
  localStorage.setItem("access_token", data.access_token);
}
```

## UI Components

### Device Management Panel
Located at: `frontend/components/DeviceManagementPanel.tsx`

Features:
- View all trusted devices
- Trust/untrust devices
- View active sessions
- Revoke individual or all sessions
- Security recommendations

### Zero-Trust Login Page
Located at: `frontend/app/login/zero-trust/page.tsx`

Features:
- Device fingerprinting
- Risk assessment display
- MFA code input
- Anomaly verification
- Security alerts

## Best Practices for Admins

1. **Register Multiple Devices**
   - Register work laptop, personal phone, and tablet
   - Use meaningful device names for identification

2. **Keep Devices Trusted**
   - Trust only devices you control
   - Review device list regularly
   - Revoke access if device is lost or compromised

3. **Monitor Sessions**
   - Check active sessions regularly
   - Revoke suspicious sessions immediately
   - Use "Revoke All" if account is compromised

4. **Follow Security Guidelines**
   - Use strong passwords (12+ characters with mixed case)
   - Enable TOTP MFA
   - Avoid logging in from public networks
   - Review login alerts immediately

5. **Manage Sensitive Operations**
   - Use high-trust devices for sensitive operations
   - Verify unusual login patterns
   - Report suspicious activity

## Future Enhancements

1. **WebAuthn/FIDO2 Support**
   - Passwordless authentication with hardware keys
   - Biometric authentication on supported devices

2. **IP Geolocation**
   - Geographic location verification
   - Impossible travel detection

3. **Behavioral Biometrics**
   - Typing pattern analysis
   - Mouse movement patterns
   - Usage habit recognition

4. **Push Notifications**
   - Push-based MFA approval
   - Real-time suspicious activity alerts

5. **Advanced Compliance**
   - SOC 2 compliance reporting
   - Detailed audit trails
   - Compliance-based MFA policies

## Troubleshooting

### Issue: "Device Blocked" Error
- **Cause**: Device was flagged as compromised or exceeded failed login attempts
- **Solution**: Contact admin to unblock or register as new device

### Issue: Session Expires Too Quickly
- **Cause**: Inactivity timeout or explicit revocation
- **Solution**: Log in again to create new session; check for security alerts

### Issue: MFA Always Required
- **Cause**: Device is not trusted or risk score is high
- **Solution**: Trust device through security settings or complete MFA verification

### Issue: Cannot Access Device Management
- **Cause**: Not an admin or incorrect permissions
- **Solution**: Contact system administrator

## Support & Reporting Issues

For issues or feature requests, contact the security team or submit an issue to the Nova Workspace repository.
