import { useState, useEffect } from "react";
import { GiToolbox } from "react-icons/gi";
import { useAuth } from "../../../context/AuthContext";
import { toolService } from "../../../services/tool";
import type { Tool, CreateToolData } from "../../../services/tool";
import AddToolModal from "../../../components/AddToolModal";

export default function Tools() {
  const { token } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await toolService.getTools(token);
      setTools(data);
    } catch (err: any) {
      setError(err.message || "Failed to load tools");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTool = async (toolData: CreateToolData) => {
    if (!token) return;

    try {
      await toolService.createTool(toolData, token);
      await loadTools();
      setIsModalOpen(false);
    } catch (err: any) {
      throw err;
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this tool?")) return;

    try {
      await toolService.deleteTool(toolId, token);
      await loadTools();
    } catch (err: any) {
      alert(err.message || "Failed to delete tool");
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading tools...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tools</h1>
            <p className="text-gray-600">
              Discover and manage the utilities that power your workflows.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Tool
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {tools.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-indigo-600">
                <GiToolbox />
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No tools available yet
            </h3>
            <p className="text-gray-600 mb-6">
              Integrate third-party services or add internal utilities to get
              started.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add Tool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {tool.description}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      tool.method === "GET"
                        ? "bg-blue-100 text-blue-700"
                        : tool.method === "POST"
                        ? "bg-green-100 text-green-700"
                        : tool.method === "PUT"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {tool.method}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 font-medium">URL:</span>
                    <span className="text-gray-700 truncate">{tool.api_url}</span>
                  </div>

                  {tool.parameters.length > 0 && (
                    <div>
                      <span className="text-gray-500 font-medium text-sm">
                        Parameters:
                      </span>
                      <ul className="mt-1 space-y-1">
                        {tool.parameters.map((param, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-gray-700 ml-4 flex items-start gap-2"
                          >
                            <span className="text-gray-400">•</span>
                            <div>
                              <span className="font-medium">{param.name}</span>
                              <span className="text-gray-500">
                                {" "}
                                - {param.description}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteTool(tool.id)}
                    className="flex-1 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AddToolModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddTool}
        />
      </div>
    </div>
  );
}
