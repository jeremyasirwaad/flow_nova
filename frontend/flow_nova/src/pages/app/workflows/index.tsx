import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { workflowService } from "@/services/workflow";
import type { Workflow, CreateWorkflowData } from "@/services/workflow";
import CreateWorkflowModal from "@/components/CreateWorkflowModal";
import DeleteWorkflowModal from "@/components/DeleteWorkflowModal";
import toast from "react-hot-toast";

export default function Workflows() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    workflowId: string | null;
    workflowName: string;
  }>({
    isOpen: false,
    workflowId: null,
    workflowName: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await workflowService.getWorkflows(token);
      setWorkflows(data);
    } catch (error) {
      console.error("Failed to load workflows:", error);
      toast.error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (data: CreateWorkflowData) => {
    if (!token) return;

    try {
      await workflowService.createWorkflow(data, token);
      toast.success("Workflow created successfully!");
      await loadWorkflows();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create workflow";
      toast.error(message);
      throw error;
    }
  };

  const openDeleteModal = (workflowId: string, workflowName: string) => {
    setDeleteModal({
      isOpen: true,
      workflowId,
      workflowName,
    });
  };

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({
        isOpen: false,
        workflowId: null,
        workflowName: "",
      });
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!token || !deleteModal.workflowId) return;

    try {
      setIsDeleting(true);
      await workflowService.deleteWorkflow(deleteModal.workflowId, token);
      toast.success("Workflow deleted successfully!");
      await loadWorkflows();
      closeDeleteModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete workflow";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflows</h1>
            <p className="text-gray-600">
              Multi-agent, follows a predefined path
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Create Workflow
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600">Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No workflows yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first workflow to get started
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg  cursor-pointer hover:bg-gray-800 transition-colors"
            >
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/app/workflows/${workflow.id}`)}
                >
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                    {workflow.name}
                  </h3>
                  {workflow.description && (
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {workflow.description}
                    </p>
                  )}
                  <div className="flex flex-col gap-1 text-sm text-gray-500 mb-4">
                    <span>
                      Created: {new Date(workflow.created_at).toLocaleDateString()}
                    </span>
                    {workflow.updated_at && (
                      <span>
                        Updated: {new Date(workflow.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDeleteModal(workflow.id, workflow.name);
                  }}
                  className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-red-200"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateWorkflowModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateWorkflow}
      />

      <DeleteWorkflowModal
        isOpen={deleteModal.isOpen}
        workflowName={deleteModal.workflowName}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteWorkflow}
        isDeleting={isDeleting}
      />
    </div>
  );
}
