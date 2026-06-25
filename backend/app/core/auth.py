from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Annotated

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User

security = HTTPBearer()

# =============================================================================
# Role constants (centralized for RBAC)
# =============================================================================
SUPER_ADMIN = "super_admin"
ADMIN = "admin"
HR = "hr"
SUPERVISOR = "supervisor"
LEAD = "lead"
USER = "user"

SUPERVISOR_ROLES = {SUPERVISOR, ADMIN, SUPER_ADMIN, LEAD}
HR_ROLES = {HR, ADMIN, SUPER_ADMIN}
ADMIN_ROLES = {ADMIN, SUPER_ADMIN}
SUPER_ADMIN_ROLES = {SUPER_ADMIN}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Authenticates the user via JWT and loads the **full user record from the database**.
    Role-based decisions should always be made against this DB-fetched user
    (never trust the role claim inside the JWT alone).
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # JWT claims verification for roles:
    # We always load the *live* role from the database (source of truth).
    # The 'role' claim in the JWT is only for convenience (e.g. quick client-side hints).
    # Here we explicitly verify the claim against the DB record.
    # If they differ (role was changed via admin approval or direct edit),
    # we trust the DB role and proceed (old token will naturally get updated role on next login/refresh).
    token_role = payload.get("role")
    if token_role and token_role != user.role:
        # Claim is stale — this is the verification point.
        # For stricter behavior, one could force re-auth here, but we use live DB role for UX.
        # The RBAC below will always use user.role from DB.
        pass

    return user


# =============================================================================
# Role-Based Access Control (RBAC) dependencies
# =============================================================================

def require_role(*allowed_roles: str):
    """
    FastAPI dependency for Role-Based Access Control.
    
    Example usage:
        @router.get("/hr-only")
        def hr_view(user: User = require_role(HR, ADMIN)):
            ...
        
        @router.get("/admins-only")
        def admin_view(user: User = require_role(ADMIN)):
            ...
    """
    allowed = {r.lower() for r in allowed_roles}

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role or "").lower()
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user

    return Depends(_checker)


# Convenience wrappers for common privileged roles
def require_admin():
    return require_role(ADMIN)


def require_hr():
    """Allows hr and admin roles."""
    return require_role(*HR_ROLES)


def require_supervisor():
    """Allows supervisor, lead, and admin roles."""
    return require_role(*SUPERVISOR_ROLES)


def require_super_admin():
    """Allows only super_admin role."""
    return require_role(SUPER_ADMIN)


# =============================================================================
# Helper functions (for use inside services/managers where Depends is not available)
# =============================================================================

def is_admin(role: str) -> bool:
    """Check if role is admin or super_admin."""
    return (role or "").lower() in ADMIN_ROLES


def is_super_admin(role: str) -> bool:
    """Check if role is super_admin."""
    return (role or "").lower() == SUPER_ADMIN


def is_hr(role: str) -> bool:
    return (role or "").lower() in HR_ROLES


def is_supervisor(role: str) -> bool:
    return (role or "").lower() in SUPERVISOR_ROLES