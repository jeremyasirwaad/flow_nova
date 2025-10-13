const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface WorkflowNode {
  id: string;
  name: string;
  x_pos: number;
  y_pos: number;
  data: Record<string, any>;
  workflow_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string | null;
  target_handle?: string | null;
  workflow_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface WorkflowWithDetails extends Workflow {
  workflow_nodes: WorkflowNode[];
  workflow_edges: WorkflowEdge[];
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
}

export interface UpdateWorkflowNodeData {
  id: string;
  name: string;
  x_pos: number;
  y_pos: number;
  data: Record<string, any>;
}

export interface UpdateWorkflowEdgeData {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface UpdateWorkflowData {
  name: string;
  description?: string;
  nodes: UpdateWorkflowNodeData[];
  edges: UpdateWorkflowEdgeData[];
}

class WorkflowService {
  private getAuthHeaders(token: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async createWorkflow(
    data: CreateWorkflowData,
    token: string
  ): Promise<Workflow> {
    const response = await fetch(`${API_URL}/api/workflows`, {
      method: "POST",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to create workflow",
      }));
      throw new Error(error.detail || "Failed to create workflow");
    }

    return response.json();
  }

  async getWorkflows(token: string): Promise<Workflow[]> {
    const response = await fetch(`${API_URL}/api/workflows`, {
      method: "GET",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch workflows",
      }));
      throw new Error(error.detail || "Failed to fetch workflows");
    }

    return response.json();
  }

  async getWorkflowById(
    workflowId: string,
    token: string
  ): Promise<WorkflowWithDetails> {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}`, {
      method: "GET",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch workflow",
      }));
      throw new Error(error.detail || "Failed to fetch workflow");
    }

    return response.json();
  }

  async deleteWorkflow(workflowId: string, token: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({
        detail: "Failed to delete workflow",
      }));
      throw new Error(error.detail || "Failed to delete workflow");
    }
  }

  async updateWorkflow(
    workflowId: string,
    data: UpdateWorkflowData,
    token: string
  ): Promise<WorkflowWithDetails> {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}`, {
      method: "PUT",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to update workflow",
      }));
      throw new Error(error.detail || "Failed to update workflow");
    }

    return response.json();
  }
}

export const workflowService = new WorkflowService();
