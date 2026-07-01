from __future__ import annotations

from datetime import date, timedelta
from math import ceil
from typing import Iterable

import networkx as nx

from app.models.schemas import Project, Task


_HOURS_PER_DAY = 8.0


def analyze_critical_path(project: Project) -> tuple[Project, list[str]]:
	tasks = list(_iter_tasks(project))
	if not tasks:
		return project, []

	graph = nx.DiGraph()
	durations: dict[str, int] = {}

	for task in tasks:
		duration = _duration_days(task)
		durations[task.id] = duration
		graph.add_node(task.id)

	for task in tasks:
		for dep_id in task.dependencies:
			if dep_id in durations:
				graph.add_edge(dep_id, task.id)

	topological = list(nx.topological_sort(graph))
	earliest_start: dict[str, int] = {}
	earliest_finish: dict[str, int] = {}

	for node in topological:
		preds = list(graph.predecessors(node))
		if not preds:
			earliest_start[node] = 0
		else:
			earliest_start[node] = max(earliest_finish[pred] for pred in preds)
		earliest_finish[node] = earliest_start[node] + durations[node]

	project_duration = max(earliest_finish.values(), default=0)

	latest_start: dict[str, int] = {}
	latest_finish: dict[str, int] = {}

	for node in reversed(topological):
		succs = list(graph.successors(node))
		if not succs:
			latest_finish[node] = project_duration
		else:
			latest_finish[node] = min(latest_start[succ] for succ in succs)
		latest_start[node] = latest_finish[node] - durations[node]

	slack_by_id: dict[str, float] = {}
	for node in topological:
		slack = float(latest_start[node] - earliest_start[node])
		slack_by_id[node] = slack

	task_map = {task.id: task for task in tasks}
	for task_id, slack in slack_by_id.items():
		task = task_map[task_id]
		task.slack = slack
		task.is_critical = slack == 0.0

	critical_path = [task_id for task_id in topological if slack_by_id.get(task_id) == 0.0]
	return project, critical_path


def _iter_tasks(project: Project) -> Iterable[Task]:
	for phase in project.phases:
		for activity in phase.activities:
			for task in activity.tasks:
				yield task


def _duration_days(task: Task) -> int:
	if task.estimated_hours is None:
		return 1
	return max(1, ceil(task.estimated_hours / _HOURS_PER_DAY))
