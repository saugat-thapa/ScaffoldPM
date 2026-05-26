from __future__ import annotations

from pathlib import Path
import logging
from typing import Iterable

import joblib
import numpy as np

from app.models.schemas import Project, Task, TaskType, TeamMember


_MODEL_PATH = Path(__file__).resolve().parents[3] / "data" / "models" / "duration_model.pkl"
_MODEL = None
_MODEL_LOADED = False
_LOGGER = logging.getLogger(__name__)


def estimate_task_durations(project: Project) -> Project:
	tasks = list(_iter_tasks(project))
	if not tasks:
		return project

	model = _load_model()
	if model is None:
		_LOGGER.info("Duration model not found. Using heuristic estimates.")
		for task in tasks:
			task.estimated_hours = _round_hours(_heuristic_estimate(task, project.team))
		_log_estimate_summary(tasks)
		return project

	features = np.array([_build_features(task, project.team) for task in tasks], dtype=float)
	predictions = model.predict(features)

	for task, prediction in zip(tasks, predictions, strict=False):
		task.estimated_hours = _round_hours(_clamp_hours(float(prediction)))

	_LOGGER.info("Duration model loaded from %s", _MODEL_PATH)
	_log_estimate_summary(tasks)

	return project


def _iter_tasks(project: Project) -> Iterable[Task]:
	for phase in project.phases:
		for activity in phase.activities:
			for task in activity.tasks:
				yield task


def _load_model():
	global _MODEL_LOADED, _MODEL
	if _MODEL_LOADED:
		return _MODEL
	_MODEL_LOADED = True
	if _MODEL_PATH.exists():
		_MODEL = joblib.load(_MODEL_PATH)
	return _MODEL


def _build_features(task: Task, team: list[TeamMember]) -> list[float]:
	task_type = _task_type_to_value(task.task_type)
	description_words = _word_count(task.description)
	skills_count = len(task.skills_required)
	experience_value = _experience_to_value(_task_experience(task, team))
	hours_estimate = _heuristic_estimate(task, team)
	return [task_type, description_words, skills_count, experience_value, hours_estimate]


def _task_type_to_value(task_type: TaskType) -> int:
	mapping = {
		TaskType.FEATURE: 0,
		TaskType.BUGFIX: 1,
		TaskType.DOCUMENTATION: 2,
		TaskType.RESEARCH: 3,
		TaskType.OTHER: 4,
	}
	return mapping.get(task_type, 4)


def _task_experience(task: Task, team: list[TeamMember]) -> str:
	by_id = {member.id: member.experience for member in team}
	by_name = {member.name: member.experience for member in team}
	if task.assigned_to and task.assigned_to in by_id:
		return by_id[task.assigned_to]
	if task.assigned_name and task.assigned_name in by_name:
		return by_name[task.assigned_name]
	return "mid"


def _experience_to_value(exp: str) -> int:
	return {"junior": 0, "mid": 1, "senior": 2}.get(exp.lower(), 1)


def _word_count(text: str | None) -> int:
	if not text:
		return 0
	return len(text.split())


def _heuristic_estimate(task: Task, team: list[TeamMember]) -> float:
	base = {
		TaskType.FEATURE: 16.0,
		TaskType.BUGFIX: 6.0,
		TaskType.DOCUMENTATION: 4.0,
		TaskType.RESEARCH: 12.0,
		TaskType.OTHER: 8.0,
	}.get(task.task_type, 8.0)

	experience = _task_experience(task, team).lower()
	exp_factor = {"junior": 1.2, "mid": 1.0, "senior": 0.85}.get(experience, 1.0)

	skills_factor = min(len(task.skills_required), 6) * 1.5
	text_factor = min(_word_count(task.description), 300) / 100 * 0.8

	estimate = (base * exp_factor) + skills_factor + text_factor
	return _clamp_hours(estimate)


def _clamp_hours(value: float) -> float:
	return max(2.0, min(40.0, value))


def _round_hours(value: float) -> float:
	return round(value * 2) / 2


def _log_estimate_summary(tasks: list[Task]) -> None:
	values = [task.estimated_hours for task in tasks if task.estimated_hours is not None]
	if not values:
		return
	_LOGGER.info(
		"Estimated hours stats: min=%.1f avg=%.1f max=%.1f (n=%d)",
		min(values),
		sum(values) / len(values),
		max(values),
		len(values),
	)
	for task in tasks[:5]:
		_LOGGER.info("Estimate sample: task='%s' hours=%.1f", task.title, task.estimated_hours)
