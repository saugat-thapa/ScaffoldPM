import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.database import get_db
from app.models.schemas import Activity, Phase, Project, Task, TaskStatus, TeamMember, WBSResponse
from app.modules.graph.cpm import analyze_critical_path
from app.modules.matching.matcher import assign_tasks_to_members
from app.modules.prediction.predictor import estimate_task_durations
from app.modules.scheduling.optimizer import schedule_project
from app.modules.wbs.document_extractor import extract_document_text
from app.modules.wbs.generator import generate_wbs

router = APIRouter()

class GenerateWBSRequest(BaseModel):
    project_name: str
    start_date: date
    end_date: date
    team_members: list[TeamMember]


class ProjectSummary(BaseModel):
    id: str
    name: str
    created_at: datetime


class UpdateTaskStatusRequest(BaseModel):
    task_id: str
    new_status: TaskStatus


class UpdateTaskAssignmentRequest(BaseModel):
    task_id: str
    member_id: str


class GenerateWBSResponse(BaseModel):
    project: Project
    summary: str | None = None
    total_duration_days: int = 0
    critical_path: list[str] = Field(default_factory=list)


@router.post("/generate-wbs")
async def generate_project_plan(
    file: UploadFile = File(...),
    payload: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload_data = json.loads(payload)
        request_data = GenerateWBSRequest.model_validate(payload_data)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="payload must be valid JSON") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    try:
        scope_text = extract_document_text(file.filename, file.content_type, await file.read())
        project = generate_wbs(
            scope_text=scope_text,
            project_name=request_data.project_name,
            team_members=request_data.team_members,
            start_date=request_data.start_date,
            end_date=request_data.end_date,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"WBS generation failed: {exc}") from exc

    project = assign_tasks_to_members(project, request_data.team_members)
    project = estimate_task_durations(project)
    project = schedule_project(project)
    project, critical_path = analyze_critical_path(project)

    total_duration_days = _compute_total_duration_days(project)
    wbs = WBSResponse(project=project, summary=None, total_duration_days=total_duration_days)

    try:
        await crud.save_project(db, wbs)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Database error while saving project") from exc

    return GenerateWBSResponse(
        project=project,
        summary=None,
        total_duration_days=total_duration_days,
        critical_path=critical_path,
    )


@router.get("/{project_id}")
async def fetch_project(project_id: str, db: AsyncSession = Depends(get_db)) -> WBSResponse:
    try:
        project_model = await crud.get_project(db, project_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Database error while fetching project") from exc

    if project_model is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project = _model_to_project(project_model)
    return WBSResponse(
        project=project,
        summary=project_model.summary,
        total_duration_days=project_model.total_duration_days,
    )


@router.get("/")
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[ProjectSummary]:
    try:
        projects = await crud.list_projects(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Database error while listing projects") from exc

    return [ProjectSummary(id=project.id, name=project.name, created_at=project.created_at) for project in projects]


@router.patch("/task/status")
async def update_task_status(
    payload: UpdateTaskStatusRequest,
    db: AsyncSession = Depends(get_db),
) -> Task:
    try:
        task = await crud.update_task_status(db, payload.task_id, payload.new_status)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Database error while updating task status") from exc

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    return _model_to_task(task)


@router.patch("/task/assign")
async def update_task_assignment(
    payload: UpdateTaskAssignmentRequest,
    db: AsyncSession = Depends(get_db),
) -> Task:
    try:
        task = await crud.update_task_assignment(db, payload.task_id, payload.member_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Database error while updating task assignment") from exc

    if task is None:
        raise HTTPException(status_code=404, detail="Task or team member not found")

    return _model_to_task(task)


def _model_to_project(project_model) -> Project:
    team = [_model_to_team_member(member) for member in project_model.team]
    phases = [_model_to_phase(phase) for phase in project_model.phases]

    return Project(
        id=project_model.id,
        name=project_model.name,
        description=project_model.description,
        start_date=project_model.start_date,
        end_date=project_model.end_date,
        total_working_days=project_model.total_working_days,
        created_at=project_model.created_at,
        phases=phases,
        team=team,
    )


def _model_to_phase(phase_model) -> Phase:
    activities = [_model_to_activity(activity) for activity in phase_model.activities]
    return Phase(
        id=phase_model.id,
        project_id=phase_model.project_id,
        title=phase_model.title,
        description=phase_model.description,
        order=phase_model.order,
        activities=activities,
    )


def _model_to_activity(activity_model) -> Activity:
    tasks = [_model_to_task(task) for task in activity_model.tasks]
    return Activity(
        id=activity_model.id,
        phase_id=activity_model.phase_id,
        title=activity_model.title,
        description=activity_model.description,
        tasks=tasks,
    )


def _model_to_task(task_model) -> Task:
    return Task(
        id=task_model.id,
        activity_id=task_model.activity_id,
        assigned_to=task_model.assigned_to,
        assigned_name=task_model.assigned_name,
        title=task_model.title,
        description=task_model.description,
        task_type=task_model.task_type,
        status=task_model.status,
        estimated_hours=task_model.estimated_hours,
        start_date=task_model.start_date,
        end_date=task_model.end_date,
        dependencies=_str_to_list(task_model.dependencies),
        skills_required=_str_to_list(task_model.skills_required),
        is_critical=task_model.is_critical,
        slack=task_model.slack,
    )


def _model_to_team_member(member_model) -> TeamMember:
    return TeamMember(
        id=member_model.id,
        name=member_model.name,
        role=member_model.role,
        skills=_str_to_list(member_model.skills),
        experience=member_model.experience,
    )


def _str_to_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _compute_total_duration_days(project: Project) -> int:
    start = project.start_date
    end_candidates = [task.end_date for task in _iter_tasks(project) if task.end_date]
    if not end_candidates:
        return 0
    end = max(end_candidates)
    return _count_working_days(start, end)


def _iter_tasks(project: Project):
    for phase in project.phases:
        for activity in phase.activities:
            for task in activity.tasks:
                yield task


def _count_working_days(start: date, end: date) -> int:
    if end < start:
        return 0
    day = start
    count = 0
    while day <= end:
        if day.weekday() < 5:
            count += 1
        day += timedelta(days=1)
    return count