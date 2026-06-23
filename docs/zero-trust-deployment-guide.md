# Zero-Trust MFA System - Deployment Guide

## Pre-Deployment Checklist

### 1. Requirements & Dependencies
- [ ] Python 3.9+
- [ ] FastAPI 0.95+
- [ ] SQLAlchemy 2.0+
- [ ] pyotp (TOTP support)
- [ ] user-agents (for device detection)
- [ ] All existing Nova dependencies

### 2. Code Changes
- [ ] `Backend/app/models/device.py` - New models ✓
- [ ] `Backend/app/core/device_security.py` - Utilities ✓
- [ ] `Backend/app/api/v1/devices.py` - Device endpoints ✓
- [ ] `Backend/app/api/v1/auth_zero_trust.py` - Zero-trust auth ✓
- [ ] `Backend/app/models/user.py` - Updated relationships ✓
- [ ] `Backend/app/main.py` - Router registration ✓
- [ ] Frontend components ✓
- [ ] Documentation ✓

### 3. Environment Configuration
- [ ] Review and set environment variables
- [ ] Configure session timeouts (default: 8 hours)
- [ ] Set risk score thresholds
- [ ] Configure CORS for zero-trust endpoints
- [ ] Review rate limiting settings

---

## Deployment Steps

### Phase 1: Database Migration (30 minutes)

#### Step 1: Backup Database
```bash
# PostgreSQL example
pg_dump -U postgres -d nova_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use your backup tool
docker exec nova-db pg_dump -U postgres nova_db > backup.sql
```

#### Step 2: Create and Run Migration
```bash
cd Backend

# Create migration file
alembic revision --autogenerate -m "Add zero-trust device tables"

# Verify migration looks correct
cat alembic/versions/[latest_file].py

# Apply migration
alembic upgrade head

# Verify migration succeeded
alembic current
```

#### Step 3: Verify Database Tables
```sql
-- Check new tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name LIKE 'device%';

-- Should show:
-- device_fingerprints
-- trusted_devices
-- admin_sessions
-- login_attempts
```

### Phase 2: Backend Deployment (1 hour)

#### Step 1: Install Dependencies
```bash
cd Backend
pip install -r requirements.txt
```

#### Step 2: Test New Endpoints
```bash
# Start backend in test mode
python -m pytest tests/ -v -k "device or zero_trust"
```

#### Step 3: Deploy Backend Code
```bash
# If using Docker
docker build -t nova-backend:latest -f Dockerfile .
docker tag nova-backend:latest nova-backend:vX.X.X

# If using systemd
systemctl restart nova-backend

# If using manual deployment
cd /opt/nova/backend
git pull origin main
python -m uvicorn app.main:app --reload
```

#### Step 4: Verify Backend Health
```bash
# Check API docs
curl https://your-domain/api/v1/docs

# Test zero-trust endpoint is accessible
curl -X POST https://your-domain/api/v1/auth/zero-trust/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' 
# Should return 401 (not authenticated)

# Test device endpoint is accessible
curl https://your-domain/api/v1/devices/my-devices \
  -H "Authorization: Bearer test_token"
# Should return 401 (invalid token)
```

### Phase 3: Frontend Deployment (30 minutes)

#### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

#### Step 2: Build Frontend
```bash
npm run build
# Or for development
npm run dev
```

#### Step 3: Deploy Frontend
```bash
# If using Next.js with Docker
docker build -t nova-frontend:latest -f Dockerfile .
docker tag nova-frontend:latest nova-frontend:vX.X.X

# If using manual deployment
npm run start

# If using static hosting
npm run export
# Copy dist files to hosting service
```

#### Step 4: Verify Frontend Routes
- [ ] `/login/zero-trust` - Zero-trust login page accessible
- [ ] `/admin/devices` - Device management accessible (admin only)
- [ ] Components load without errors
- [ ] Device fingerprinting script loads

### Phase 4: Testing (2 hours)

#### Unit Tests
```bash
# Backend tests
cd Backend
pytest tests/ -v

# Frontend tests (if available)
cd frontend
npm run test
```

#### Integration Tests

**Test 1: Device Registration Flow**
```
1. Go to /login/zero-trust
2. Enter valid admin credentials
3. Provide device name
4. Complete login
5. Verify device appears in /admin/devices
```

**Test 2: Risk Assessment**
```
1. Login from first time (high risk expected)
2. Complete MFA
3. Login again same time (lower risk expected)
4. Verify risk scores decrease
```

**Test 3: Device Trust**
```
1. Register new device
2. Trust device from dashboard
3. Login again - should require less MFA
4. Untrust device
5. Login should require full MFA again
```

**Test 4: Session Management**
```
1. Create multiple sessions from different devices
2. View active sessions in dashboard
3. Revoke individual session
4. Verify session list updates
5. Test "Revoke All Sessions"
```

**Test 5: Admin Device Management**
```
1. Login as admin
2. Navigate to /api/v1/devices/admin/devices
3. View all users' devices
4. Block a device via API
5. Verify blocked device cannot login
```

#### Load Tests
```bash
# Simulate multiple concurrent logins
locust -f tests/load_tests.py --host=https://your-domain
```

#### Security Tests
```bash
# Test rate limiting
for i in {1..50}; do
  curl -X POST https://your-domain/api/v1/auth/zero-trust/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' &
done
# Should see rate limit errors after 10 attempts
```

### Phase 5: Monitoring Setup (1 hour)

#### Step 1: Set Up Logging
```bash
# Ensure logs capture device and session events
# Check logs in:
# - /var/log/nova/backend.log
# - /var/log/nova/auth.log
# - Application dashboards
```

#### Step 2: Create Alerts
```
Alert on:
- High rate of device blockings
- Multiple failed login attempts from same IP
- Unusual spike in critical-risk logins
- Database connection errors
- API errors on device endpoints
```

#### Step 3: Enable Metrics
```
Track:
- Login success rate by risk level
- Device trust distribution
- Average sessions per admin
- MFA verification rate
- Anomaly detection rate
```

---

## Rollout Strategy

### Option 1: Soft Launch (Recommended)
1. **Day 1-2**: Enable for admin team (5-10 people)
   - Gather feedback
   - Monitor for issues
   
2. **Day 3-7**: Expand to all admins
   - Monitor system performance
   - Watch for bugs
   
3. **Week 2**: Enable for power users (HR, supervisors)
   - Full system test
   - Performance validation
   
4. **Week 3+**: Gradual rollout to all users
   - Feature flag controlled
   - Easy to disable if needed

### Option 2: Big Bang (Higher Risk)
- Deploy to all users at once
- Requires extensive pre-testing
- Have rollback plan ready

### Option 3: Feature Flag
```python
# In config
ZERO_TRUST_LOGIN_ENABLED = os.getenv("ZERO_TRUST_LOGIN_ENABLED", False)
ZERO_TRUST_DEVICE_MANAGEMENT = os.getenv("ZERO_TRUST_DEVICE_MANAGEMENT", False)

# At endpoint
if not settings.ZERO_TRUST_LOGIN_ENABLED:
    raise HTTPException(501, "Feature not enabled")
```

---

## Post-Deployment

### Monitoring Dashboard Metrics

Create dashboard showing:
```
Real-time:
- Active sessions (count)
- Failed logins (count)
- High-risk logins (count)
- Blocked devices (count)

Hourly:
- Average risk score
- MFA verification rate
- Device trust distribution
- Geographic login distribution

Daily:
- New devices registered
- Devices marked trusted
- Sessions revoked
- Anomalies detected
```

### Support & Training

#### For Users
1. **Quick Start Guide**: `/docs/zero-trust-admin-setup-guide.md`
2. **Video Tutorial**: Record demo of:
   - Registering first device
   - Trusting device
   - Managing sessions
   - Understanding risk levels

3. **FAQ**: Document common questions

#### For Support Team
1. Train on device troubleshooting
2. Know how to unblock devices
3. Understand risk score factors
4. Know where to check logs

#### For Admins
1. Deploy guide (this document)
2. Configuration reference
3. Troubleshooting guide
4. Monitoring setup

### Maintenance Tasks

**Weekly**:
- [ ] Check system logs for errors
- [ ] Review blocked devices
- [ ] Monitor database growth

**Monthly**:
- [ ] Review user device inventory
- [ ] Check orphaned sessions
- [ ] Validate backup procedures
- [ ] Performance metrics review

**Quarterly**:
- [ ] Security audit
- [ ] Database cleanup (remove old login attempts)
- [ ] Update documentation
- [ ] Feature enhancement review

---

## Rollback Procedure

### If Critical Issues Occur

**Step 1: Disable Feature**
```python
# Temporarily disable in config
ZERO_TRUST_LOGIN_ENABLED = False
```

**Step 2: Redirect Users to Standard Login**
```
Redirect /login/zero-trust → /login
```

**Step 3: Stop Processing New Sessions**
```sql
-- Clear active sessions if needed
DELETE FROM admin_sessions WHERE created_at < NOW() - INTERVAL '1 hour';
```

**Step 4: Database Rollback (if needed)**
```bash
alembic downgrade -1
```

**Step 5: Notify Users**
```
Send notification:
"Zero-trust login temporarily disabled. Use standard login at /login"
```

---

## Performance Optimization

### Database Indexes
```sql
-- Add indexes for common queries
CREATE INDEX idx_device_fingerprints_user_id 
  ON device_fingerprints(user_id);

CREATE INDEX idx_trusted_devices_user_id 
  ON trusted_devices(user_id);

CREATE INDEX idx_admin_sessions_user_id 
  ON admin_sessions(user_id);

CREATE INDEX idx_admin_sessions_expires 
  ON admin_sessions(expires_at);

CREATE INDEX idx_login_attempts_username 
  ON login_attempts(username);

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Cache Strategy
```python
# Cache trusted device list per user (5 min TTL)
@cache.cached(timeout=300, key_prefix="trusted_devices_")
def get_trusted_devices(user_id: int):
    # Query
    pass

# Clear cache on changes
cache.delete(f"trusted_devices_{user_id}")
```

### Session Cleanup
```sql
-- Remove expired sessions (run daily)
DELETE FROM admin_sessions 
WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days';

-- Remove old login attempts (run weekly)
DELETE FROM login_attempts 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Troubleshooting Common Deployment Issues

### Issue: Migration Fails
```bash
# Check migration status
alembic current
alembic history

# Manually create tables if needed
psql -U postgres -d nova_db -f create_tables.sql
```

### Issue: Backend Won't Start
```bash
# Check logs
journalctl -u nova-backend -n 50

# Test imports
python -c "from app.models.device import DeviceFingerprint"

# Verify database connection
python -c "from app.core.database import SessionLocal; db = SessionLocal(); print('DB OK')"
```

### Issue: Frontend Routes 404
```bash
# Check Next.js build
npm run build

# Verify file exists
ls -la frontend/app/login/zero-trust/page.tsx

# Check middleware routing
```

### Issue: High Database Load
```sql
-- Check for slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Add missing indexes
ANALYZE;
```

---

## Success Criteria

Deployment is successful when:
- ✅ All new database tables created and indexed
- ✅ Backend responds to device endpoints with 200/401
- ✅ Frontend pages load without errors
- ✅ Admin can login via zero-trust flow
- ✅ Risk scores calculated correctly
- ✅ Device trust system works
- ✅ Sessions timeout as configured
- ✅ Rate limiting prevents brute force
- ✅ Audit logs record all events
- ✅ System handles 1000+ concurrent sessions
- ✅ < 500ms latency on device endpoints
- ✅ No error logs related to new feature
- ✅ Support team trained and ready

---

## Contact & Support

**Deployment Issues**: DevOps Team
**Code Issues**: Development Team  
**User Training**: Support Team
**Security Concerns**: Security Team

---

## Appendix: Quick Reference

### Important Paths
- Backend: `Backend/app/`
- Frontend: `frontend/`
- Docs: `docs/`
- Database: Configured in `Backend/app/core/config.py`

### Key Files
- Models: `Backend/app/models/device.py`
- Auth: `Backend/app/api/v1/auth_zero_trust.py`
- Devices: `Backend/app/api/v1/devices.py`
- Security: `Backend/app/core/device_security.py`

### Useful Commands
```bash
# Run migrations
alembic upgrade head

# Check migrations
alembic history

# Reset migrations
alembic downgrade base

# Start backend
python -m uvicorn app.main:app --reload

# Start frontend  
npm run dev

# Run tests
pytest tests/ -v
```

---

**Last Updated**: January 2026
**Version**: 1.0.0
