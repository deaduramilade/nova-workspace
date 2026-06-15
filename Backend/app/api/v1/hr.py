"""Dedicated HR API for employee work log tracking, hours overview, date filtering, and approvals.

Protected: only HR role (hr, admin) can access.
"""

from fastapi import APIRouter, Depends, Query

from app.core.auth import require_hr, get_current_user
from app.models.user import User
from app.services.workspace_hours import (
    get_employee_work_logs,
    approve_employee_hours,
    get_hr_overview,
)

router = APIRouter(tags=["hr"])


class ApproveRequest(BaseModel):
    username: str
    date: str
    approve: bool = True


@router.get("/overview")
def hr_overview(current_user: User = require_hr()):
    overview = get_hr_overview()
    overview["role"] = current_user.role
    return overview


@router.get("/employees")
def list_employee_hours(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD or ISO"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD or ISO"),
    employee: Optional[str] = Query(None, description="Filter by username"),
    approved: Optional[bool] = Query(None, description="true=approved only, false=pending only"),
    current_user: User = require_hr(),
):
    pending_only = approved is False
    approved_only = approved is True
    logs = get_employee_work_logs(
        username=employee,
        date_from=date_from,
        date_to=date_to,
        approved_only=approved_only,
        pending_only=pending_only,
    )
    # Group by employee for overview style
    by_employee: dict = {}
    for log in logs:
        uname = log["username"]
        if uname not in by_employee:
            by_employee[uname] = {
                "username": uname,
                "display_name": log["display_name"],
                "total_seconds": 0,
                "total_hours": 0.0,
                "logs": [],
                "pending_approvals": 0,
            }
        by_employee[uname]["logs"].append(log)
        by_employee[uname]["total_seconds"] += log["seconds"]
        by_employee[uname]["total_hours"] = round(by_employee[uname]["total_seconds"] / 3600, 2)
        if not log.get("approved"):
            by_employee[uname]["pending_approvals"] += 1

    return {
        "employees": list(by_employee.values()),
        "filters": {"date_from": date_from, "date_to": date_to, "employee": employee, "approved": approved},
        "total_employees": len(by_employee),
    }


@router.get("/logs")
def get_work_logs(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
    approved: Optional[bool] = Query(None),
    current_user: User = require_hr(),
):
    pending_only = approved is False
    approved_only = approved is True
    logs = get_employee_work_logs(
        username=employee,
        date_from=date_from,
        date_to=date_to,
        approved_only=approved_only,
        pending_only=pending_only,
    )
    return {
        "logs": logs,
        "count": len(logs),
        "filters": {"date_from": date_from, "date_to": date_to, "employee": employee, "approved": approved},
    }


@router.post("/approve")
def approve_hours(
    body: ApproveRequest,
    current_user: User = require_hr(),
):
    result = approve_employee_hours(
        username=body.username,
        date=body.date,
        approved_by=current_user.username,
        approve=body.approve,
    )
    return {"status": "ok", "approval": result}


@router.get("/tools")
def hr_tools(current_user: User = require_hr()):
    # Note: the old _ensure_hr and is_hr imports were removed in favor of
    # the centralized RBAC dependency `require_hr()` which always verifies
    # the role against the live database record.
    return {
        "is_hr": True,
        "role": current_user.role,
        "features": [
            "date filtering",
            "employee filtering",
            "individual log approval",
            "hours overview",
            "work log export (simulated)",
        ],
    }