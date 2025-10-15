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

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  node_id: string;
  input_json: Record<string, any>;
  output_json: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowLedgerEntry {
  id: string;
  workflow_id: string;
  node_id: string;
  run_id: string;
  node_type: string;
  input_json: Record<string, any>;
  output_json: Record<string, any> | null;
  tool_calls: Record<string, any> | null;
  created_at: string;
  updated_at: string;
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

  async executeWorkflow(
    workflowId: string,
    inputData: Record<string, any>,
    token: string
  ): Promise<{ run_id: string; message: string }> {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}/execute`, {
      method: "POST",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(inputData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to execute workflow",
      }));
      throw new Error(error.detail || "Failed to execute workflow");
    }

    return response.json();
  }

  async getWorkflowRuns(
    workflowId: string,
    token: string
  ): Promise<WorkflowRun[]> {
    const response = await fetch(`${API_URL}/api/workflows/${workflowId}/runs`, {
      method: "GET",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch workflow runs",
      }));
      throw new Error(error.detail || "Failed to fetch workflow runs");
    }

    return response.json();
  }

  async getRunLedger(
    runId: string,
    token: string
  ): Promise<WorkflowLedgerEntry[]> {
    const response = await fetch(
      `${API_URL}/api/runs/${runId}/ledger`,
      {
        method: "GET",
        headers: this.getAuthHeaders(token),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch run ledger",
      }));
      throw new Error(error.detail || "Failed to fetch run ledger");
    }

    return response.json();
  }

  async approveNode(
    workflowId: string,
    runId: string,
    nodeId: string,
    decision: "yes" | "no",
    token: string
  ): Promise<{ success: boolean; message: string; run_id: string }> {
    const response = await fetch(
      `${API_URL}/api/workflows/${workflowId}/runs/${runId}/nodes/${nodeId}/approve`,
      {
        method: "POST",
        headers: this.getAuthHeaders(token),
        body: JSON.stringify({ decision }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to approve node",
      }));
      throw new Error(error.detail || "Failed to approve node");
    }

    return response.json();
  }

  async replayRun(
    runId: string,
    token: string
  ): Promise<{
    success: boolean;
    message: string;
    original_run_id: string;
    workflow_id: string;
    job_id: string;
  }> {
    const response = await fetch(`${API_URL}/api/runs/${runId}/replay`, {
      method: "POST",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to replay workflow",
      }));
      throw new Error(error.detail || "Failed to replay workflow");
    }

    return response.json();
  }
}

export const workflowService = new WorkflowService();
