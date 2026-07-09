from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.models import ProjectModel, PhaseModel, ActivityModel, TaskModel, TeamMemberModel
from app.models.schemas import Project, Phase, Activity, Task, TeamMember, TaskStatus, WBSResponse
import json

# ── Helpers ───────────────────────────────────────────────────────────────────

def _skills_to_str(skills: list[str]) -> str:
    return ",".join(skills)

def _str_to_list(s: str) -> list[str]:
    return [x.strip() for x in s.split(",") if x.strip()] if s else []

# ── Write: persist full WBS after generation ─────────────────────────────────

async def save_project(db: AsyncSession, wbs: WBSResponse) -> str:
    project = wbs.project

    # Upsert team members first
    for member in project.team:
        existing = await db.get(TeamMemberModel, member.id)
        if not existing:
            db.add(TeamMemberModel(
                id=member.id,
                name=member.name,
                role=member.role,
                skills=_skills_to_str(member.skills),
                experience=member.experience,
            ))

    # Create project
    proj_model = ProjectModel(
        id=project.id,
        name=project.name,
        description=project.description,
        start_date=project.start_date,
        end_date=project.end_date,
        total_working_days=project.total_working_days,
        summary=wbs.summary,
        total_duration_days=wbs.total_duration_days,
        created_at=project.created_at,
    )
    db.add(proj_model)

    # Phases → Activities → Tasks
    for phase in project.phases:
        phase_model = PhaseModel(
            id=phase.id,
            project_id=project.id,
            title=phase.title,
            description=phase.description,
            order=phase.order,
        )
        db.add(phase_model)

        for activity in phase.activities:
            act_model = ActivityModel(
                id=activity.id,
                phase_id=phase.id,
                title=activity.title,
                description=activity.description,
            )
            db.add(act_model)

            for task in activity.tasks:
                task_model = TaskModel(
                    id=task.id,
                    activity_id=activity.id,
                    assigned_to=task.assigned_to,
                    assigned_name=task.assigned_name,
                    title=task.title,
                    description=task.description,
                    task_type=task.task_type,
                    status=task.status,
                    estimated_hours=task.estimated_hours,
                    start_date=task.start_date,
                    end_date=task.end_date,
                    dependencies=_skills_to_str(task.dependencies),
                    skills_required=_skills_to_str(task.skills_required),
                    is_critical=task.is_critical,
                    slack=task.slack,
                )
                db.add(task_model)

    await db.commit()
    return project.id

# ── Read: fetch full project with all relations ───────────────────────────────

async def get_project(db: AsyncSession, project_id: str) -> ProjectModel | None:
    result = await db.execute(
        select(ProjectModel)
        .where(ProjectModel.id == project_id)
        .options(
            selectinload(ProjectModel.team),
            selectinload(ProjectModel.phases)
                .selectinload(PhaseModel.activities)
                .selectinload(ActivityModel.tasks)
        )
    )
    return result.scalar_one_or_none()

async def list_projects(db: AsyncSession) -> list[ProjectModel]:
    result = await db.execute(select(ProjectModel).order_by(ProjectModel.created_at.desc()))
    return result.scalars().all()

async def list_team_members(db: AsyncSession) -> list[TeamMemberModel]:
    result = await db.execute(select(TeamMemberModel).order_by(TeamMemberModel.name.asc()))
    return result.scalars().all()


# ── Update: Kanban status drag ────────────────────────────────────────────────

async def update_task_status(db: AsyncSession, task_id: str, new_status: TaskStatus) -> TaskModel | None:
    task = await db.get(TaskModel, task_id)
    if not task:
        return None
    task.status = new_status
    await db.commit()
    await db.refresh(task)
    return task

# ── Update: task assignment ───────────────────────────────────────────────────

async def update_task_assignment(db: AsyncSession, task_id: str, member_id: str) -> TaskModel | None:
    task = await db.get(TaskModel, task_id)
    if not task:
        return None
    if not member_id:
        task.assigned_to = None
        task.assigned_name = None
    else:
        member = await db.get(TeamMemberModel, member_id)
        if not member:
            return None
        task.assigned_to = member_id
        task.assigned_name = member.name
    await db.commit()
    await db.refresh(task)
    return task