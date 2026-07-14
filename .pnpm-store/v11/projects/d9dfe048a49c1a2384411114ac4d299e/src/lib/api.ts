const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskType =
  | "feature"
  | "bugfix"
  | "documentation"
  | "research"
  | "other";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  experience: string;
}

export interface Task {
  id: string;
  activity_id: string;
  assigned_to: string | null;
  assigned_name: string | null;
  title: string;
  description?: string | null;
  task_type: TaskType;
  status: TaskStatus;
  estimated_hours?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  dependencies: string[];
  skills_required: string[];
  is_critical: boolean;
  slack: number;
}

export interface Activity {
  id: string;
  phase_id: string;
  title: string;
  description?: string | null;
  tasks: Task[];
}

export interface Phase {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  order: number;
  activities: Activity[];
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  total_working_days: number;
  created_at: string;
  phases: Phase[];
  team: TeamMember[];
}

export interface WBSResponse {
  project: Project;
  summary?: string;
  total_duration_days: number;
  critical_path?: string[];
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new ApiError(fallbackMessage, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch all project summaries
 */
export async function getProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_BASE_URL}/project/`);
  return parseResponse<ProjectSummary[]>(response, "Failed to fetch projects");
}

/**
 * Fetch a specific project by ID
 */
export async function getProject(id: string): Promise<WBSResponse> {
  const response = await fetch(`${API_BASE_URL}/project/${id}`);
  return parseResponse<WBSResponse>(response, "Failed to fetch project details");
}

/**
 * Generate a new WBS from a file and payload
 */
export interface GenerateWBSPayload {
  project_name: string;
  start_date: string;
  end_date: string;
  team_members: TeamMember[];
}

/**
 * Generate a new WBS from a file and payload
 */
export async function generateWBS(
  file: File,
  payload: GenerateWBSPayload,
): Promise<WBSResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("payload", JSON.stringify(payload));

  const response = await fetch(`${API_BASE_URL}/project/generate-wbs`, {
    method: "POST",
    body: formData,
  });

  return parseResponse<WBSResponse>(response, "Failed to generate WBS");
}

/**
 * Fetch all team members
 */
export async function getMembers(): Promise<TeamMember[]> {
  const response = await fetch(`${API_BASE_URL}/project/members`);
  return parseResponse<TeamMember[]>(response, "Failed to fetch team members");
}

