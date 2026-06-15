"""Dedicated HR API for employee work log tracking, hours overview, date filtering, and approvals.

Protected: only HR role (hr, admin) can access.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.core.auth import get_current_user
from app.models.user import User
from app.services.supervisor_manager import is_hr
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


def _ensure_hr(user: User):
    if not is_hr(user.role):
        raise HTTPException(status_code=403, detail="HR access required")


@router.get("/overview")
def hr_overview(current_user: User = Depends(get_current_user)):
    _ensure_hr(current_user)
    overview = get_hr_overview()
    overview["role"] = current_user.role
    return overview


@router.get("/employees")
def list_employee_hours(
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD or ISO"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD or ISO"),
    employee: Optional[str] = Query(None, description="Filter by username"),
    approved: Optional[bool] = Query(None, description="true=approved only, false=pending only"),
    current_user: User = Depends(get_current_user),
):
    _ensure_hr(current_user)
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
    current_user: User = Depends(get_current_user),
):
    _ensure_hr(current_user)
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
    current_user: User = Depends(get_current_user),
):
    _ensure_hr(current_user)
    result = approve_employee_hours(
        username=body.username,
        date=body.date,
        approved_by=current_user.username,
        approve=body.approve,
    )
    return {"status": "ok", "approval": result}


@router.get("/tools")
def hr_tools(current_user: User = Depends(get_current_user)):
    _ensure_hr(current_user)
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