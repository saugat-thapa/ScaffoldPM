from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TaskStatus(str, Enum):
	TODO = "todo"
	IN_PROGRESS = "in_progress"
	DONE = "done"


class TaskType(str, Enum):
	FEATURE = "feature"
	BUGFIX = "bugfix"
	DOCUMENTATION = "documentation"
	RESEARCH = "research"
	OTHER = "other"


class TeamMember(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	name: str
	role: str
	skills: List[str] = Field(default_factory=list)
	experience: str = "mid"


class Task(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	activity_id: str
	assigned_to: Optional[str] = None
	assigned_name: Optional[str] = None
	title: str
	description: Optional[str] = None
	task_type: TaskType = TaskType.OTHER
	status: TaskStatus = TaskStatus.TODO
	estimated_hours: Optional[float] = None
	start_date: Optional[date] = None
	end_date: Optional[date] = None
	dependencies: List[str] = Field(default_factory=list)
	skills_required: List[str] = Field(default_factory=list)
	is_critical: bool = False
	slack: float = 0.0


class Activity(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	phase_id: str
	title: str
	description: Optional[str] = None
	tasks: List[Task] = Field(default_factory=list)


class Phase(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	project_id: str
	title: str
	description: Optional[str] = None
	order: int
	activities: List[Activity] = Field(default_factory=list)


class Project(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: str
	name: str
	description: Optional[str] = None
	start_date: date
	end_date: date
	total_working_days: int = 0
	created_at: datetime = Field(default_factory=datetime.utcnow)
	phases: List[Phase] = Field(default_factory=list)
	team: List[TeamMember] = Field(default_factory=list)


class WBSResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	project: Project
	summary: Optional[str] = None
	total_duration_days: int = 0
