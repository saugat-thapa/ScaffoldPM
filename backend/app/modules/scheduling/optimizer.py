from __future__ import annotations

from collections import deque
from datetime import date, timedelta
from math import ceil
from typing import Iterable

from app.models.schemas import Project, Task


_HOURS_PER_DAY = 8.0


def schedule_project(project: Project) -> Project:
    tasks = list(_iter_tasks(project))
    if not tasks:
        return project

    task_map = {task.id: task for task in tasks}
    remaining_deps = {task.id: set(task.dependencies) for task in tasks}

    member_available: dict[str, date] = {}
    for member in project.team:
        member_available[member.id] = project.start_date

    ready = deque([task_id for task_id, deps in remaining_deps.items() if not deps])
    scheduled: set[str] = set()

    # Greedy schedule: always pick the ready task with earliest feasible start.
    while ready:
        candidates = list(ready)
        ready.clear()

        candidates.sort(key=lambda task_id: _earliest_start(task_map[task_id], task_map, member_available, project.start_date))
        for task_id in candidates:
            task = task_map[task_id]
            start = _earliest_start(task, task_map, member_available, project.start_date)
            duration_days = _duration_days(task)
            end = _add_working_days(start, duration_days - 1)

            task.start_date = start
            task.end_date = end

            if task.assigned_to:
                member_available[task.assigned_to] = _next_working_day(end + timedelta(days=1))

            scheduled.add(task_id)

            for successor_id, deps in remaining_deps.items():
                if task_id in deps:
                    deps.remove(task_id)
                    if not deps and successor_id not in scheduled:
                        ready.append(successor_id)

    return project


def _iter_tasks(project: Project) -> Iterable[Task]:
    for phase in project.phases:
        for activity in phase.activities:
            for task in activity.tasks:
                yield task


def _duration_days(task: Task) -> int:
    if task.estimated_hours is None:
        return 1
    return max(1, ceil(task.estimated_hours / _HOURS_PER_DAY))


def _earliest_start(task: Task, task_map: dict[str, Task], member_available: dict[str, date], project_start: date) -> date:
    earliest = project_start
    if task.dependencies:
        dep_end_dates = [task_map[dep_id].end_date for dep_id in task.dependencies if dep_id in task_map]
        dep_end_dates = [d for d in dep_end_dates if d is not None]
        if dep_end_dates:
            latest_dep_end = max(dep_end_dates)
            earliest = _next_working_day(latest_dep_end + timedelta(days=1))

    if task.assigned_to and task.assigned_to in member_available:
        earliest = max(earliest, member_available[task.assigned_to])

    return _next_working_day(earliest)


def _add_working_days(start: date, days: int) -> date:
    current = start
    remaining = max(0, days)
    while remaining > 0:
        current += timedelta(days=1)
        if _is_working_day(current):
            remaining -= 1
    return current


def _next_working_day(day: date) -> date:
    current = day
    while not _is_working_day(current):
        current += timedelta(days=1)
    return current


def _is_working_day(day: date) -> bool:
    return day.weekday() < 5
