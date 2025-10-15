import { useState, useEffect } from "react";
import type { Node } from "reactflow";
import { useAuth } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onUpdate: (nodeId: string, data: NodeFormData) => void;
}

interface NodeFormData {
  label?: string;
  description?: string;
  llm_model?: string;
  system_prompt?: string;
  user_prompt?: string;
  tools?: string[] | string;
  structured_output?: boolean;
  structured_output_schema?: string;
  lhs?: string;
  condition?: string;
  rhs?: string;
  message?: string;
  guardrail?: string;
  cognitive_instruction?: string;
  type?: string;
  [key: string]: unknown;
}

interface AgentModel {
  id: string;
  object?: string;
  [key: string]: unknown;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  [key: string]: unknown;
}

export default function NodeConfigPanel({
  node,
  onClose,
  onDelete,
  onUpdate,
}: NodeConfigPanelProps) {
  const [formData, setFormData] = useState<NodeFormData>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [models, setModels] = useState<AgentModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const { token } = useAuth();

  const getReferenceHintStyles = (nodeType?: string) => {
    switch (nodeType) {
      case "agent":
        return {
          container: "bg-purple-50 border-purple-200",
          text: "text-purple-800",
          code: "text-purple-700",
        };
      case "if_else":
        return {
          container: "bg-blue-50 border-blue-200",
          text: "text-blue-800",
          code: "text-blue-700",
        };
      case "user_approval":
        return {
          container: "bg-amber-50 border-amber-200",
          text: "text-amber-800",
          code: "text-amber-700",
        };
      case "guardrails":
        return {
          container: "bg-cyan-50 border-cyan-200",
          text: "text-cyan-800",
          code: "text-cyan-700",
        };
      case "cognitive":
        return {
          container: "bg-indigo-50 border-indigo-200",
          text: "text-indigo-800",
          code: "text-indigo-700",
        };
      default:
        return {
          container: "bg-gray-50 border-gray-200",
          text: "text-gray-600",
          code: "text-gray-700",
        };
    }
  };

  useEffect(() => {
    if (node) {
      const dataWithoutProvider = { ...(node.data || {}) } as NodeFormData;
      if ("llm_provider" in dataWithoutProvider) {
        delete (dataWithoutProvider as Record<string, unknown>)["llm_provider"];
      }
      setFormData(dataWithoutProvider);
    }
  }, [node]);

  useEffect(() => {
    if (!node || node.data?.type !== "agent") {
      setModels([]);
      setModelsError(null);
      setLoadingModels(false);
      return;
    }

    if (!token) {
      setModels([]);
      setModelsError("Authentication required to load models.");
      setLoadingModels(false);
      return;
    }

    const controller = new AbortController();
    setLoadingModels(true);
    setModelsError(null);

    const fetchModels = async () => {
      try {
        const response = await fetch(`${API_URL}/api/agents/models`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }

        const data = await response.json();
        const modelsList: AgentModel[] = Array.isArray(data?.data) ? data.data : [];
        setModels(modelsList);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching models:", error);
        setModels([]);
        setModelsError("Unable to load models. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingModels(false);
        }
      }
    };

    fetchModels();

    return () => {
      controller.abort();
    };
  }, [node, token]);

  useEffect(() => {
    if (
      node?.data?.type === "agent" &&
      !formData.llm_model &&
      models.length > 0
    ) {
      setFormData((prev: NodeFormData) => ({
        ...prev,
        llm_model: prev.llm_model || models[0].id,
      }));
    }
  }, [models, node, formData.llm_model]);

  // Fetch tools for agent nodes
  useEffect(() => {
    if (!node || node.data?.type !== "agent") {
      setTools([]);
      setToolsError(null);
      setLoadingTools(false);
      return;
    }

    if (!token) {
      setTools([]);
      setToolsError("Authentication required to load tools.");
      setLoadingTools(false);
      return;
    }

    const controller = new AbortController();
    setLoadingTools(true);
    setToolsError(null);

    const fetchTools = async () => {
      try {
        const response = await fetch(`${API_URL}/api/tools`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch tools");
        }

        const data = await response.json();
        const toolsList: Tool[] = Array.isArray(data?.tools) ? data.tools : [];
        setTools(toolsList);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching tools:", error);
        setTools([]);
        setToolsError("Unable to load tools. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingTools(false);
        }
      }
    };

    fetchTools();

    return () => {
      controller.abort();
    };
  }, [node, token]);

  if (!node) return null;

  const referenceHintStyles = getReferenceHintStyles(node.data?.type);
  const selectedModelExists =
    !!formData.llm_model &&
    models.some((model) => model.id === formData.llm_model);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev: NodeFormData) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors.includes(field)) {
      setErrors((prev) => prev.filter((e) => e !== field));
    }
  };

  const validateForm = (): { isValid: boolean; errorFields: string[] } => {
    const errorFields: string[] = [];

    switch (node.data.type) {
      case "agent":
        if (!formData.description?.trim()) errorFields.push("description");
        if (!formData.llm_model?.trim()) errorFields.push("llm_model");
        if (!formData.system_prompt?.trim()) errorFields.push("system_prompt");
        if (!formData.user_prompt?.trim()) errorFields.push("user_prompt");
        // tools field is optional
        if (formData.structured_output && !formData.structured_output_schema?.trim()) {
          errorFields.push("structured_output_schema");
        }
        break;

      case "if_else":
        if (!formData.lhs?.trim()) errorFields.push("lhs");
        if (!formData.condition?.trim()) errorFields.push("condition");
        if (!formData.rhs?.trim()) errorFields.push("rhs");
        break;

      case "user_approval":
        if (!formData.message?.trim()) errorFields.push("message");
        break;

      case "guardrails":
        if (!formData.guardrail?.trim()) errorFields.push("guardrail");
        break;

      case "cognitive":
        if (!formData.cognitive_instruction?.trim()) errorFields.push("cognitive_instruction");
        break;
    }

    return { isValid: errorFields.length === 0, errorFields };
  };

  const handleSave = () => {
    const validation = validateForm();

    if (!validation.isValid) {
      setErrors(validation.errorFields);
      return;
    }

    setErrors([]);
    const payload: NodeFormData = { ...formData };
    if ("llm_provider" in payload) {
      delete (payload as Record<string, unknown>)["llm_provider"];
    }

    // Ensure tools is always an array for agent nodes
    if (node.data.type === "agent") {
      if (!payload.tools || (Array.isArray(payload.tools) && payload.tools.length === 0)) {
        payload.tools = [];
      } else if (!Array.isArray(payload.tools)) {
        payload.tools = [payload.tools as string];
      }
    }

    onUpdate(node.id, payload);
    onClose();
  };

  const handleDelete = () => {
    onDelete(node.id);
    onClose();
  };

  const getInputClassName = (fieldName: string, baseClassName: string) => {
    const hasError = errors.includes(fieldName);
    if (hasError) {
      return baseClassName.replace(
        "border-gray-300",
        "border-red-500 ring-2 ring-red-200"
      );
    }
    return baseClassName;
  };

  const renderConfigForm = () => {
    switch (node.data.type) {
      case "agent":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={2}
                className={getInputClassName(
                  "description",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                )}
                placeholder="Agent description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Model <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.llm_model || ""}
                onChange={(e) => handleInputChange("llm_model", e.target.value)}
                disabled={
                  loadingModels || !!modelsError || models.length === 0
                }
                className={getInputClassName(
                  "llm_model",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                )}
              >
                <option value="" disabled={models.length > 0}>
                  {loadingModels
                    ? "Loading models..."
                    : modelsError
                    ? "Unable to load models"
                    : models.length === 0
                    ? "No models available"
                    : "Select a model"}
                </option>
                {!selectedModelExists && formData.llm_model && (
                  <option value={formData.llm_model}>
                    {formData.llm_model}
                  </option>
                )}
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
              </select>
              {modelsError && (
                <p className="text-xs text-red-500 mt-1">{modelsError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.system_prompt || ""}
                onChange={(e) =>
                  handleInputChange("system_prompt", e.target.value)
                }
                rows={3}
                className={getInputClassName(
                  "system_prompt",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                )}
                placeholder="System prompt for the agent..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.user_prompt || ""}
                onChange={(e) => handleInputChange("user_prompt", e.target.value)}
                rows={3}
                className={getInputClassName(
                  "user_prompt",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                )}
                placeholder="User prompt for the agent..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tools
              </label>
              {loadingTools ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 text-sm">
                  Loading tools...
                </div>
              ) : toolsError ? (
                <div className="w-full px-3 py-2 bg-red-50 border border-red-300 rounded-lg text-red-600 text-sm">
                  {toolsError}
                </div>
              ) : tools.length === 0 ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 text-sm">
                  No tools available. Create tools first.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-white">
                  {tools.map((tool) => {
                    const selectedTools = Array.isArray(formData.tools)
                      ? formData.tools
                      : formData.tools
                      ? [formData.tools]
                      : [];
                    const isSelected = selectedTools.includes(tool.id);

                    return (
                      <label
                        key={tool.id}
                        className="flex items-start gap-2 p-2 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const currentTools = Array.isArray(formData.tools)
                              ? formData.tools
                              : formData.tools
                              ? [formData.tools]
                              : [];

                            const newTools = e.target.checked
                              ? [...currentTools, tool.id]
                              : currentTools.filter((id) => id !== tool.id);

                            handleInputChange("tools", newTools);
                          }}
                          className="mt-1 w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {tool.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tool.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select tools that this agent can use
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.structured_output || false}
                  onChange={(e) =>
                    handleInputChange("structured_output", e.target.checked)
                  }
                  className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  Enable Structured Output
                </span>
              </label>
            </div>

            {formData.structured_output && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Structured Output Schema (JSON)
                </label>
                <textarea
                  value={formData.structured_output_schema || ""}
                  onChange={(e) =>
                    handleInputChange("structured_output_schema", e.target.value)
                  }
                  rows={4}
                  className={getInputClassName(
                    "structured_output_schema",
                    "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-xs"
                  )}
                  placeholder='{"type": "object", "properties": {...}}'
                />
              </div>
            )}
          </div>
        );

      case "if_else":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Left Hand Side (LHS) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lhs || ""}
                onChange={(e) => handleInputChange("lhs", e.target.value)}
                className={getInputClassName(
                  "lhs",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                )}
                placeholder="e.g., {{input.variable_name}}"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condition <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.condition || ">"}
                onChange={(e) => handleInputChange("condition", e.target.value)}
                className={getInputClassName(
                  "condition",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                )}
              >
                <option value=">">Greater than (&gt;)</option>
                <option value="<">Less than (&lt;)</option>
                <option value="=">Equal to (=)</option>
                <option value=">=">Greater than or equal (&gt;=)</option>
                <option value="<=">Less than or equal (&lt;=)</option>
                <option value="!=">Not equal (!=)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Right Hand Side (RHS) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.rhs || ""}
                onChange={(e) => handleInputChange("rhs", e.target.value)}
                className={getInputClassName(
                  "rhs",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                )}
                placeholder="e.g., 10 or input.another_variable"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Example:</strong> If LHS = "input.age", Condition = "&gt;", RHS = "18"
                <br />
                Then: True branch executes when age is greater than 18
              </p>
            </div>
          </div>
        );

      case "user_approval":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.message || ""}
                onChange={(e) => handleInputChange("message", e.target.value)}
                rows={4}
                className={getInputClassName(
                  "message",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                )}
                placeholder="Enter user question..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Message to show when requesting user approval
              </p>
            </div>
          </div>
        );

      case "guardrails":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guardrail <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.guardrail || ""}
                onChange={(e) => handleInputChange("guardrail", e.target.value)}
                rows={4}
                className={getInputClassName(
                  "guardrail",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                )}
                placeholder="What to check for..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Define what safety checks and validation to perform
              </p>
            </div>
          </div>
        );

      case "cognitive":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="What this cognitive node does..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cognitive Instruction <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.cognitive_instruction || ""}
                onChange={(e) => handleInputChange("cognitive_instruction", e.target.value)}
                rows={6}
                className={getInputClassName(
                  "cognitive_instruction",
                  "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                )}
                placeholder="Describe the workflow you want the AI to generate and execute..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.cognitive_instruction?.length || 0} characters
              </p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs text-indigo-800">
                <strong>How it works:</strong>
                <br />
                1. The AI generates a workflow based on your instruction
                <br />
                2. The generated workflow executes autonomously
                <br />
                3. Final output is passed to the next node
                <br />
                <br />
                <strong>Example:</strong> "Analyze customer sentiment from reviews, categorize feedback, and generate a summary report"
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Node Name
              </label>
              <input
                type="text"
                value={formData.label || ""}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                placeholder="Enter node name..."
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Node Configuration</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                node.data.type === "agent"
                  ? "bg-purple-100 text-purple-600"
                  : node.data.type === "if_else"
                  ? "bg-blue-100 text-blue-600"
                  : node.data.type === "user_approval"
                  ? "bg-amber-100 text-amber-600"
                  : node.data.type === "guardrails"
                  ? "bg-cyan-100 text-cyan-600"
                  : node.data.type === "cognitive"
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <span className="text-xl font-bold">
                {node.data.label?.charAt(0) || "N"}
              </span>
            </div>
            <div>
              <h3 className="text-gray-900 font-semibold">{node.data.label}</h3>
              <p className="text-xs text-gray-500">{node.data.description}</p>
            </div>
          </div>
        </div>

        <div
          className={`mb-4 border rounded-lg p-3 ${referenceHintStyles.container}`}
        >
          <p className={`text-xs ${referenceHintStyles.text}`}>
            Use{" "}
            <code className={`font-mono ${referenceHintStyles.code}`}>
              {"{{input.variable_name}}"}
            </code>{" "}
            to refer the variables.
          </p>
        </div>

        {renderConfigForm()}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Only show delete button if not start or end node */}
        {node.data.type !== "start" && node.data.type !== "end" && (
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
