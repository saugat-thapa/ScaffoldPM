from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Iterable
from uuid import uuid4

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.models.schemas import Activity, Phase, Project, Task, TaskType, TeamMember


class LLMTask(BaseModel):
	title: str
	description: str
	task_type: TaskType = TaskType.OTHER
	skills_required: list[str] = Field(default_factory=list)
	dependencies: list[str] = Field(default_factory=list)


class LLMActivity(BaseModel):
	title: str
	description: str | None = None
	tasks: list[LLMTask] = Field(default_factory=list)


class LLMPhase(BaseModel):
	title: str
	description: str | None = None
	activities: list[LLMActivity] = Field(default_factory=list)


class LLMProject(BaseModel):
	description: str | None = None
	phases: list[LLMPhase] = Field(default_factory=list)


def generate_wbs(
	scope_text: str,
	project_name: str,
	team_members: list[TeamMember],
	start_date: date,
	end_date: date,
) -> Project:
	total_working_days = _count_working_days(start_date, end_date)
	llm_project = _generate_llm_project(
		scope_text=scope_text,
		project_name=project_name,
		team_members=team_members,
		start_date=start_date,
		end_date=end_date,
		total_working_days=total_working_days,
	)

	project_id = str(uuid4())
	phases: list[Phase] = []
	tasks_by_title: dict[str, list[str]] = {}
	pending_dependencies: dict[str, list[str]] = {}
	all_tasks: list[Task] = []

	for phase_index, phase in enumerate(llm_project.phases, start=1):
		phase_id = str(uuid4())
		activities: list[Activity] = []

		for activity in phase.activities:
			activity_id = str(uuid4())
			tasks: list[Task] = []

			for task in activity.tasks:
				task_id = str(uuid4())
				task_model = Task(
					id=task_id,
					activity_id=activity_id,
					title=task.title.strip(),
					description=task.description.strip(),
					task_type=task.task_type,
					skills_required=[skill.strip() for skill in task.skills_required if skill.strip()],
				)
				tasks.append(task_model)
				all_tasks.append(task_model)

				title_key = _normalize_title(task.title)
				tasks_by_title.setdefault(title_key, []).append(task_id)
				pending_dependencies[task_id] = [dep.strip() for dep in task.dependencies if dep.strip()]

			activities.append(
				Activity(
					id=activity_id,
					phase_id=phase_id,
					title=activity.title.strip(),
					description=(activity.description or "").strip() or None,
					tasks=tasks,
				)
			)

		phases.append(
			Phase(
				id=phase_id,
				project_id=project_id,
				title=phase.title.strip(),
				description=(phase.description or "").strip() or None,
				order=phase_index,
				activities=activities,
			)
		)

	_resolve_dependencies(all_tasks, tasks_by_title, pending_dependencies)

	return Project(
		id=project_id,
		name=project_name.strip(),
		description=(llm_project.description or "").strip() or None,
		start_date=start_date,
		end_date=end_date,
		total_working_days=total_working_days,
		phases=phases,
		team=team_members,
	)


def _generate_llm_project(
	scope_text: str,
	project_name: str,
	team_members: list[TeamMember],
	start_date: date,
	end_date: date,
	total_working_days: int,
) -> LLMProject:
	parser = PydanticOutputParser(pydantic_object=LLMProject)
	llm = ChatOpenAI(
		model="gpt-5.4-mini",
		temperature=0.2,
		openai_api_key=settings.OPENAI_API_KEY,
	)
	team_payload = [
		{
			"name": member.name,
			"role": member.role,
			"skills": member.skills,
			"experience": member.experience,
		}
		for member in team_members
	]

	for attempt in range(2):
		prompt = _build_prompt(parser, retry=attempt > 0)
		response = llm.invoke(
			prompt.format_messages(
				project_name=project_name,
				scope_text=scope_text,
				team_members=json.dumps(team_payload, indent=2),
				start_date=start_date.isoformat(),
				end_date=end_date.isoformat(),
				total_working_days=total_working_days,
			)
		)

		try:
			return parser.parse(response.content)
		except (ValidationError, ValueError) as exc:
			if attempt == 1:
				raise ValueError("Failed to parse WBS JSON output") from exc

	raise ValueError("Failed to generate WBS")


def _build_prompt(parser: PydanticOutputParser, retry: bool) -> ChatPromptTemplate:
	system_note = (
		"You are an expert project manager building a detailed work breakdown structure for a software project."
		" Use the provided scope to design a realistic plan that matches the project context."
	)
	if retry:
		system_note += " The previous output was invalid. Return only valid JSON that matches the schema."

	user_note = (
		"Project name: {project_name}\n"
		"Project start date: {start_date}\n"
		"Project end date: {end_date}\n"
		"Total working days: {total_working_days}\n\n"
		"Team members and skills (JSON):\n{team_members}\n\n"
		"Scope document (verbatim text):\n{scope_text}\n\n"
		"Generate a structured WBS with 4 to 6 phases, 3 to 6 activities per phase, and 4 to 8 tasks per activity."
		" Every task must include a clear title, a detailed description, a task_type, skills_required, and dependencies."
		" Dependencies should be expressed as task titles and must match unique task titles across the entire project."
		" The WBS must reflect the actual scope and avoid generic templates."
		" Return only valid JSON with no markdown, no explanations.\n\n"
		"{format_instructions}"
	)

	return ChatPromptTemplate.from_messages(
		[
			("system", system_note),
			("human", user_note),
		]
	).partial(format_instructions=parser.get_format_instructions())


def _resolve_dependencies(
	tasks: Iterable[Task],
	tasks_by_title: dict[str, list[str]],
	pending_dependencies: dict[str, list[str]],
) -> None:
	for task in tasks:
		resolved: list[str] = []
		for dep_title in pending_dependencies.get(task.id, []):
			title_key = _normalize_title(dep_title)
			candidates = tasks_by_title.get(title_key, [])
			for candidate in candidates:
				if candidate != task.id and candidate not in resolved:
					resolved.append(candidate)
					break
		task.dependencies = resolved


def _normalize_title(title: str) -> str:
	return " ".join(title.lower().split())


def _count_working_days(start_date: date, end_date: date) -> int:
	if end_date < start_date:
		return 0
	day = start_date
	count = 0
	while day <= end_date:
		if day.weekday() < 5:
			count += 1
		day += timedelta(days=1)
	return count
