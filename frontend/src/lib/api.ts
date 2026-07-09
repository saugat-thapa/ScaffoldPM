const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
}

export interface WBSResponse {
  project: any; // We can type this out more strictly later
  summary?: string;
  total_duration_days: number;
  critical_path?: string[];
}

/**
 * Fetch all project summaries
 */
export async function getProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_BASE_URL}/project/`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  return response.json();
}

/**
 * Fetch a specific project by ID
 */
export async function getProject(id: string): Promise<WBSResponse> {
  const response = await fetch(`${API_BASE_URL}/project/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch project details");
  }
  return response.json();
}

/**
 * Generate a new WBS from a file and payload
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  experience: string;
}

/**
 * Generate a new WBS from a file and payload
 */
export async function generateWBS(file: File, payload: any): Promise<WBSResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("payload", JSON.stringify(payload));

  const response = await fetch(`${API_BASE_URL}/project/generate-wbs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to generate WBS");
  }
  return response.json();
}

/**
 * Fetch all team members
 */
export async function getMembers(): Promise<TeamMember[]> {
  const response = await fetch(`${API_BASE_URL}/project/members`);
  if (!response.ok) {
    throw new Error("Failed to fetch team members");
  }
  return response.json();
}

/**
 * Update the status of a task
 */
export async function updateTaskStatus(taskId: string, newStatus: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/project/task/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ task_id: taskId, new_status: newStatus }),
  });
  if (!response.ok) {
    throw new Error("Failed to update task status");
  }
  return response.json();
}

/**
 * Update the assignee of a task
 */
export async function updateTaskAssignment(taskId: string, memberId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/project/task/assign`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ task_id: taskId, member_id: memberId }),
  });
  if (!response.ok) {
    throw new Error("Failed to update task assignment");
  }
  return response.json();
}

