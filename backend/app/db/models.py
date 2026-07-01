from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    Date, DateTime, ForeignKey, Text, Enum as SAEnum, Table
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime
from app.models.schemas import TaskStatus, TaskType

class Base(DeclarativeBase):
    pass

# ── Junction: project ↔ team members ─────────────────────────────────────────
project_members = Table(
    "project_members", Base.metadata,
    Column("project_id",    String, ForeignKey("projects.id"),     primary_key=True),
    Column("team_member_id",String, ForeignKey("team_members.id"), primary_key=True),
)

# ── Team Members ──────────────────────────────────────────────────────────────
class TeamMemberModel(Base):
    __tablename__ = "team_members"

    id         = Column(String,  primary_key=True)
    name       = Column(String,  nullable=False)
    role       = Column(String,  nullable=False)
    skills     = Column(Text,    nullable=False)   # stored as comma-separated
    experience = Column(String,  default="mid")

    projects   = relationship("ProjectModel", secondary=project_members, back_populates="team")
    tasks      = relationship("TaskModel",    back_populates="assignee")

# ── Projects ──────────────────────────────────────────────────────────────────
class ProjectModel(Base):
    __tablename__ = "projects"

    id                  = Column(String,   primary_key=True)
    name                = Column(String,   nullable=False)
    description         = Column(Text,     nullable=True)
    start_date          = Column(Date,     nullable=False)
    end_date            = Column(Date,     nullable=False)
    total_working_days  = Column(Integer,  default=0)
    summary             = Column(Text,     nullable=True)   # AI-generated plan summary
    total_duration_days = Column(Integer,  default=0)
    created_at          = Column(DateTime, default=datetime.now)

    phases = relationship("PhaseModel",      back_populates="project",
                          cascade="all, delete-orphan", order_by="PhaseModel.order")
    team   = relationship("TeamMemberModel", secondary=project_members,
                          back_populates="projects")

# ── Phases ────────────────────────────────────────────────────────────────────
class PhaseModel(Base):
    __tablename__ = "phases"

    id          = Column(String,  primary_key=True)
    project_id  = Column(String,  ForeignKey("projects.id"), nullable=False)
    title       = Column(String,  nullable=False)
    description = Column(Text,    nullable=True)
    order       = Column(Integer, nullable=False)

    project    = relationship("ProjectModel",   back_populates="phases")
    activities = relationship("ActivityModel",  back_populates="phase",
                              cascade="all, delete-orphan")

# ── Activities ────────────────────────────────────────────────────────────────
class ActivityModel(Base):
    __tablename__ = "activities"

    id          = Column(String, primary_key=True)
    phase_id    = Column(String, ForeignKey("phases.id"), nullable=False)
    title       = Column(String, nullable=False)
    description = Column(Text,   nullable=True)

    phase = relationship("PhaseModel",  back_populates="activities")
    tasks = relationship("TaskModel",   back_populates="activity",
                         cascade="all, delete-orphan")

# ── Tasks ─────────────────────────────────────────────────────────────────────
class TaskModel(Base):
    __tablename__ = "tasks"

    id              = Column(String,  primary_key=True)
    activity_id     = Column(String,  ForeignKey("activities.id"), nullable=False)
    assigned_to     = Column(String,  ForeignKey("team_members.id"), nullable=True)
    assigned_name   = Column(String,  nullable=True)
    title           = Column(String,  nullable=False)
    description     = Column(Text,    nullable=True)
    task_type       = Column(SAEnum(TaskType),   default=TaskType.OTHER)
    status          = Column(SAEnum(TaskStatus), default=TaskStatus.TODO)
    estimated_hours = Column(Float,   nullable=True)
    start_date      = Column(Date,    nullable=True)
    end_date        = Column(Date,    nullable=True)
    dependencies    = Column(Text,    default="")   # comma-separated task IDs
    skills_required = Column(Text,    default="")   # comma-separated
    is_critical     = Column(Boolean, default=False)
    slack           = Column(Float,   default=0.0)

    activity = relationship("ActivityModel",  back_populates="tasks")
    assignee = relationship("TeamMemberModel",back_populates="tasks")