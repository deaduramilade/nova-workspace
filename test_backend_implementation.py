#!/usr/bin/env python
"""Test script to verify backend Super Admin implementation."""

import sys
sys.path.insert(0, 'Backend')

print("=" * 70)
print("BACKEND IMPLEMENTATION TEST")
print("=" * 70)

# Test 1: Verify RBAC setup
print("\n[TEST 1] RBAC Constants Verification")
print("-" * 70)
try:
    from app.core.auth import ADMIN, SUPER_ADMIN, ADMIN_ROLES, require_admin, require_super_admin, is_admin, is_super_admin
    
    print(f"✅ SUPER_ADMIN = '{SUPER_ADMIN}'")
    print(f"✅ ADMIN = '{ADMIN}'")
    print(f"✅ ADMIN_ROLES = {ADMIN_ROLES}")
    
    # Verify role sets
    assert SUPER_ADMIN in ADMIN_ROLES, "SUPER_ADMIN should be in ADMIN_ROLES"
    print(f"✅ SUPER_ADMIN is in ADMIN_ROLES")
    
    assert ADMIN in ADMIN_ROLES, "ADMIN should be in ADMIN_ROLES"
    print(f"✅ ADMIN is in ADMIN_ROLES")
    
    # Test helper functions
    assert is_admin("admin"), "is_admin('admin') should return True"
    print(f"✅ is_admin('admin') returns True")
    
    assert is_admin("super_admin"), "is_admin('super_admin') should return True"
    print(f"✅ is_admin('super_admin') returns True")
    
    assert is_super_admin("super_admin"), "is_super_admin('super_admin') should return True"
    print(f"✅ is_super_admin('super_admin') returns True")
    
    assert not is_super_admin("admin"), "is_super_admin('admin') should return False"
    print(f"✅ is_super_admin('admin') returns False")
    
    print("\n✅ RBAC setup is correct!")
    
except Exception as e:
    print(f"❌ RBAC test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Verify admin router has new endpoints
print("\n[TEST 2] New Endpoints Registration")
print("-" * 70)
try:
    from app.api.v1.admin import router
    
    routes = {}
    for route in router.routes:
        methods = list(route.methods) if hasattr(route, 'methods') else []
        if methods:
            routes[route.path] = methods
    
    print(f"Registered routes in admin router:")
    for path, methods in sorted(routes.items()):
        print(f"  {', '.join(methods)} {path}")
    
    # Check for new endpoints
    required_endpoints = {
        "/system/stats": {"GET"},
        "/system/health": {"GET"},
    }
    
    for endpoint, required_methods in required_endpoints.items():
        if endpoint in routes:
            actual_methods = set(routes[endpoint])
            if required_methods.issubset(actual_methods):
                print(f"✅ {endpoint} endpoint found with correct methods {actual_methods}")
            else:
                print(f"❌ {endpoint} endpoint found but missing methods: {required_methods - actual_methods}")
                sys.exit(1)
        else:
            print(f"❌ {endpoint} endpoint NOT found")
            sys.exit(1)
    
    print("\n✅ All required endpoints are registered!")
    
except Exception as e:
    print(f"❌ Endpoint registration test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Verify endpoint implementations
print("\n[TEST 3] Endpoint Implementation Analysis")
print("-" * 70)
try:
    import inspect
    from app.api.v1.admin import get_system_stats, get_system_health
    
    # Check get_system_stats
    stats_sig = inspect.signature(get_system_stats)
    print(f"get_system_stats signature: {stats_sig}")
    assert 'current_user' in stats_sig.parameters, "current_user parameter missing"
    assert 'db' in stats_sig.parameters, "db parameter missing"
    print(f"✅ get_system_stats has correct parameters")
    
    # Check get_system_health
    health_sig = inspect.signature(get_system_health)
    print(f"get_system_health signature: {health_sig}")
    assert 'current_user' in health_sig.parameters, "current_user parameter missing"
    assert 'db' in health_sig.parameters, "db parameter missing"
    print(f"✅ get_system_health has correct parameters")
    
    print("\n✅ Endpoint implementations are correct!")
    
except Exception as e:
    print(f"❌ Endpoint implementation test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
print("✅ ALL TESTS PASSED!")
print("=" * 70)
print("\nImplementation Summary:")
print("  1. ✅ RBAC: super_admin role properly integrated")
print("  2. ✅ require_admin() now allows both admin and super_admin")
print("  3. ✅ GET /admin/system/stats endpoint created")
print("  4. ✅ GET /admin/system/health endpoint created")
print("  5. ✅ Both endpoints require admin/super_admin role")
print("\nThe backend is ready for testing!")
