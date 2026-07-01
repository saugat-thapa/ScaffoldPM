from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Iterable

import numpy as np
from sentence_transformers import SentenceTransformer

from app.models.schemas import Project, Task, TeamMember, TaskType


# Lightweight and strong for short skill/task phrases; keeps inference fast.
_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_EMBEDDER = SentenceTransformer(_MODEL_NAME)
_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class _MemberProfile:
	member: TeamMember
	text: str


def assign_tasks_to_members(project: Project, team_members: list[TeamMember] | None = None) -> Project:
	members = team_members or project.team
	if not members:
		return project

	tasks = list(_iter_tasks(project))
	if not tasks:
		return project

	member_profiles = [_build_member_profile(member) for member in members]
	member_vectors = _embed_texts([profile.text for profile in member_profiles])

	task_profiles = [_build_task_profile(task) for task in tasks]
	task_vectors = _embed_texts([profile.text for profile in task_profiles])

	assigned_counts = {member.id: 0 for member in members}
	task_order = sorted(
		range(len(tasks)),
		key=lambda idx: _task_complexity(tasks[idx]),
		reverse=True,
	)

	for task_idx in task_order:
		task = tasks[task_idx]
		similarities = member_vectors @ task_vectors[task_idx]
		best_member = None
		best_score = float("-inf")

		for member_idx, similarity in enumerate(similarities):
			profile = member_profiles[member_idx]
			score = _score_match(
				similarity=float(similarity),
				member=profile.member,
				task=task,
				assigned_counts=assigned_counts,
			)
			if score > best_score:
				best_score = score
				best_member = profile.member

		if best_member is not None:
			task.assigned_to = best_member.id
			task.assigned_name = best_member.name
			assigned_counts[best_member.id] += 1

	if tasks:
		distribution = {member.name: assigned_counts.get(member.id, 0) for member in members}
		_LOGGER.info("Skill matching assigned %d tasks. Distribution=%s", len(tasks), distribution)
		for task in tasks[:5]:
			_LOGGER.info("Match sample: task='%s' -> '%s'", task.title, task.assigned_name)

	return project


def _iter_tasks(project: Project) -> Iterable[Task]:
	for phase in project.phases:
		for activity in phase.activities:
			for task in activity.tasks:
				yield task


def _build_member_profile(member: TeamMember) -> _MemberProfile:
	skills = ", ".join(member.skills)
	text = f"{member.role}. Skills: {skills}. Experience: {member.experience}."
	return _MemberProfile(member=member, text=text)


@dataclass(frozen=True)
class _TaskProfile:
	text: str


def _build_task_profile(task: Task) -> _TaskProfile:
	skills = ", ".join(task.skills_required)
	description = task.description or ""
	text = f"{task.title}. {description} Type: {task.task_type}. Skills: {skills}."
	return _TaskProfile(text=text)


def _embed_texts(texts: list[str]) -> np.ndarray:
	embeddings = _EMBEDDER.encode(texts, normalize_embeddings=True)
	return np.asarray(embeddings)


def _task_complexity(task: Task) -> float:
	score = 1.0
	if task.task_type in {TaskType.RESEARCH, TaskType.FEATURE}:
		score += 0.3
	elif task.task_type == TaskType.BUGFIX:
		score += 0.1
	if task.description and len(task.description) > 200:
		score += 0.2
	if len(task.skills_required) >= 4:
		score += 0.2
	return score


def _score_match(
	similarity: float,
	member: TeamMember,
	task: Task,
	assigned_counts: dict[str, int],
) -> float:
	complexity = _task_complexity(task)
	experience = member.experience.lower()
	if complexity >= 1.2:
		exp_multiplier = {"junior": 0.9, "mid": 1.0, "senior": 1.1}.get(experience, 1.0)
	else:
		exp_multiplier = {"junior": 1.05, "mid": 1.0, "senior": 0.98}.get(experience, 1.0)

	load_penalty = 1 + (assigned_counts.get(member.id, 0) * 0.15)
	return (similarity * exp_multiplier) / load_penalty
