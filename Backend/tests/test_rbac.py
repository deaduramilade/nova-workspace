"""
RBAC Permission Tests

Run with: pytest Backend/tests/test_rbac.py -q
(Ensure pytest and test dependencies are installed; mocks used for DB/auth)
"""

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

# Assuming the modules are importable
from app.core.auth import (
    require_role,
    require_admin,
    require_hr,
    require_supervisor,
    ADMIN,
    HR,
    SUPERVISOR,
    is_admin,
    is_hr,
    is_supervisor,
)
from app.models.user import User


def make_mock_user(role: str, is_active: bool = True) -> User:
    user = MagicMock(spec=User)
    user.role = role
    user.is_active = is_active
    user.username = "testuser"
    return user


class TestRoleHelpers:
    def test_is_admin(self):
        assert is_admin("admin") is True
        assert is_admin("ADMIN") is True
        assert is_admin("user") is False
        assert is_admin(None) is False

    def test_is_hr(self):
        assert is_hr("hr") is True
        assert is_hr("admin") is True
        assert is_hr("user") is False

    def test_is_supervisor(self):
        assert is_supervisor("supervisor") is True
        assert is_supervisor("lead") is True
        assert is_supervisor("admin") is True
        assert is_supervisor("user") is False


class TestRequireRoleDependency:
    def test_require_role_allows(self):
        # Simulate dependency call
        checker = require_role(ADMIN, HR)._dependency
        user = make_mock_user("admin")
        # The inner _checker expects the dep to have injected
        # For unit test, call the checker logic directly
        assert checker(current_user=user) == user  # type: ignore  # simplified

    def test_require_role_denies(self):
        checker = require_role(ADMIN)._dependency
        user = make_mock_user("user")
        with pytest.raises(HTTPException) as exc:
            checker(current_user=user)  # type: ignore
        assert exc.value.status_code == 403

    def test_require_admin(self):
        admin_checker = require_admin()._dependency
        user = make_mock_user(ADMIN)
        assert admin_checker(current_user=user) == user  # type: ignore

        user_hr = make_mock_user(HR)
        with pytest.raises(HTTPException):
            admin_checker(current_user=user_hr)  # type: ignore

    def test_require_hr_allows_admin_and_hr(self):
        hr_checker = require_hr()._dependency
        assert hr_checker(current_user=make_mock_user(HR))  # type: ignore
        assert hr_checker(current_user=make_mock_user(ADMIN))  # type: ignore

        with pytest.raises(HTTPException):
            hr_checker(current_user=make_mock_user("user"))  # type: ignore

    def test_require_supervisor(self):
        sup_checker = require_supervisor()._dependency
        assert sup_checker(current_user=make_mock_user(SUPERVISOR))  # type: ignore
        assert sup_checker(current_user=make_mock_user("lead"))  # type: ignore

        with pytest.raises(HTTPException):
            sup_checker(current_user=make_mock_user("user"))  # type: ignore


# Note: Full integration tests would use TestClient with overridden deps.
# These unit tests cover the core permission logic.
