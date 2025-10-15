const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ToolParameter {
  name: string;
  description: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  api_url: string;
  method: HttpMethod;
  request_body?: Record<string, any> | null;
  headers?: Record<string, any> | null;
  parameters: ToolParameter[];
  user_id?: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateToolData {
  name: string;
  description: string;
  api_url: string;
  method: HttpMethod;
  request_body?: Record<string, any> | null;
  headers?: Record<string, any> | null;
  parameters: ToolParameter[];
}

export interface UpdateToolData {
  name?: string;
  description?: string;
  api_url?: string;
  method?: HttpMethod;
  request_body?: Record<string, any> | null;
  headers?: Record<string, any> | null;
  parameters?: ToolParameter[];
}

class ToolService {
  private getAuthHeaders(token: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async createTool(data: CreateToolData, token: string): Promise<Tool> {
    // Validate max 3 parameters
    if (data.parameters.length > 3) {
      throw new Error("Maximum 3 parameters allowed");
    }

    const response = await fetch(`${API_URL}/api/tools`, {
      method: "POST",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to create tool",
      }));
      throw new Error(error.detail || "Failed to create tool");
    }

    return response.json();
  }

  async getTools(token: string): Promise<Tool[]> {
    const response = await fetch(`${API_URL}/api/tools`, {
      method: "GET",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch tools",
      }));
      throw new Error(error.detail || "Failed to fetch tools");
    }

    const data = await response.json();
    return data.tools || [];
  }

  async getToolById(toolId: string, token: string): Promise<Tool> {
    const response = await fetch(`${API_URL}/api/tools/${toolId}`, {
      method: "GET",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to fetch tool",
      }));
      throw new Error(error.detail || "Failed to fetch tool");
    }

    return response.json();
  }

  async updateTool(
    toolId: string,
    data: UpdateToolData,
    token: string
  ): Promise<Tool> {
    // Validate max 3 parameters if provided
    if (data.parameters && data.parameters.length > 3) {
      throw new Error("Maximum 3 parameters allowed");
    }

    const response = await fetch(`${API_URL}/api/tools/${toolId}`, {
      method: "PUT",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to update tool",
      }));
      throw new Error(error.detail || "Failed to update tool");
    }

    return response.json();
  }

  async deleteTool(toolId: string, token: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/tools/${toolId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({
        detail: "Failed to delete tool",
      }));
      throw new Error(error.detail || "Failed to delete tool");
    }
  }

  async executeTool(
    toolId: string,
    extractedParams: Record<string, any>,
    token: string
  ): Promise<any> {
    const response = await fetch(`${API_URL}/api/tools/${toolId}/execute`, {
      method: "POST",
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({ parameters: extractedParams }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Failed to execute tool",
      }));
      throw new Error(error.detail || "Failed to execute tool");
    }

    return response.json();
  }
}

export const toolService = new ToolService();
