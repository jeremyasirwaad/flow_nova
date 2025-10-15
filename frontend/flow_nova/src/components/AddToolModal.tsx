import { useState } from "react";
import type { CreateToolData, HttpMethod, ToolParameter } from "../services/tool";

interface AddToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toolData: CreateToolData) => Promise<void>;
}

export default function AddToolModal({
  isOpen,
  onClose,
  onSubmit,
}: AddToolModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    api_url: "",
    method: "GET" as HttpMethod,
  });
  const [bodyJson, setBodyJson] = useState("{\n  \n}");
  const [headersJson, setHeadersJson] = useState("{\n  \n}");
  const [parameters, setParameters] = useState<ToolParameter[]>([
    { name: "", description: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddParameter = () => {
    if (parameters.length >= 3) {
      setError("Maximum 3 parameters allowed");
      return;
    }
    setParameters([...parameters, { name: "", description: "" }]);
  };

  const handleRemoveParameter = (index: number) => {
    if (parameters.length <= 1) {
      setError("At least one parameter is required");
      return;
    }
    setParameters(parameters.filter((_, idx) => idx !== index));
  };

  const handleParameterChange = (
    index: number,
    field: keyof ToolParameter,
    value: string
  ) => {
    const updated = [...parameters];
    updated[index][field] = value;
    setParameters(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.description || !formData.api_url) {
        throw new Error("Name, description, and URL are required");
      }

      // Parse body JSON if provided
      let request_body: Record<string, any> | null = null;
      if (bodyJson.trim() && bodyJson.trim() !== "{}" && bodyJson.trim() !== "{\n  \n}") {
        try {
          request_body = JSON.parse(bodyJson);
        } catch {
          throw new Error("Invalid JSON format in body");
        }
      }

      // Parse headers JSON if provided
      let headers: Record<string, any> | null = null;
      if (headersJson.trim() && headersJson.trim() !== "{}" && headersJson.trim() !== "{\n  \n}") {
        try {
          headers = JSON.parse(headersJson);
        } catch {
          throw new Error("Invalid JSON format in headers");
        }
      }

      // Filter out empty parameters
      const validParameters = parameters.filter(
        (p) => p.name.trim() !== "" && p.description.trim() !== ""
      );

      // Validate at least one parameter is required
      if (validParameters.length === 0) {
        throw new Error("At least one parameter is required");
      }

      const toolData: CreateToolData = {
        name: formData.name,
        description: formData.description,
        api_url: formData.api_url,
        method: formData.method,
        request_body,
        headers,
        parameters: validParameters,
      };

      await onSubmit(toolData);

      // Reset form
      setFormData({
        name: "",
        description: "",
        api_url: "",
        method: "GET",
      });
      setBodyJson("{\n  \n}");
      setHeadersJson("{\n  \n}");
      setParameters([{ name: "", description: "" }]);
    } catch (err: any) {
      setError(err.message || "Failed to create tool");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 my-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Add New Tool
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
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
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tool Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    // Convert to lowercase and replace spaces with underscores
                    const formattedName = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '_');
                    setFormData({ ...formData, name: formattedName });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., weather_api"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Name will be automatically formatted: lowercase with underscores
                </p>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of what this tool does"
                  rows={2}
                  required
                />
              </div>

              {/* URL and Method */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label
                    htmlFor="url"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    API URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={formData.api_url}
                    onChange={(e) =>
                      setFormData({ ...formData, api_url: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://api.example.com/endpoint"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="method"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="method"
                    value={formData.method}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        method: e.target.value as HttpMethod,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              {/* Body JSON */}
              <div>
                <label
                  htmlFor="body"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Request Body (JSON) <span className="text-gray-500 text-xs">Optional</span>
                </label>
                <textarea
                  id="body"
                  value={bodyJson}
                  onChange={(e) => setBodyJson(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{\n  "key": "value"\n}'
                  rows={4}
                />
              </div>

              {/* Headers JSON */}
              <div>
                <label
                  htmlFor="headers"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Headers (JSON) <span className="text-gray-500 text-xs">Optional</span>
                </label>
                <textarea
                  id="headers"
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'
                  rows={4}
                />
              </div>

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Parameters for LLM Extraction{" "}
                    <span className="text-red-500">*</span>{" "}
                    <span className="text-gray-500 text-xs">(At least 1, Max 3)</span>
                  </label>
                  {parameters.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddParameter}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Parameter
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Define parameters that the LLM will extract from user input to
                  make the API call. At least one parameter is required.
                </p>

                <div className="space-y-3">
                  {parameters.map((param, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Parameter {idx + 1}
                        </span>
                        {parameters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParameter(idx)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) =>
                            handleParameterChange(idx, "name", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Parameter name (e.g., city, date)"
                        />
                        <input
                          type="text"
                          value={param.description}
                          onChange={(e) =>
                            handleParameterChange(
                              idx,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Description for LLM (e.g., The city name to get weather for)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Tool
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
