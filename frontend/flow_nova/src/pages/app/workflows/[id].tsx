import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { workflowService } from "@/services/workflow";
import type { WorkflowWithDetails } from "@/services/workflow";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import toast from "react-hot-toast";

// Import custom node components
import StartNode from "@/components/workflow-nodes/StartNode";
import EndNode from "@/components/workflow-nodes/EndNode";
import AgentNode from "@/components/workflow-nodes/AgentNode";
import IfElseNode from "@/components/workflow-nodes/IfElseNode";
import UserApprovalNode from "@/components/workflow-nodes/UserApprovalNode";

const nodeTypes = [
  {
    id: "if_else",
    label: "If/Else",
    type: "logic",
    description: "Conditional branching",
  },
  {
    id: "user_approval",
    label: "User Approval",
    type: "logic",
    description: "Wait for user approval",
  },
  {
    id: "agent",
    label: "Agent Node",
    type: "agent",
    description: "AI Agent execution",
  },
  {
    id: "end",
    label: "End Node",
    type: "end",
    description: "Workflow termination",
  },
];

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [workflow, setWorkflow] = useState<WorkflowWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Register custom node types
  const customNodeTypes = useMemo(
    () => ({
      start: StartNode,
      end: EndNode,
      agent: AgentNode,
      if_else: IfElseNode,
      user_approval: UserApprovalNode,
    }),
    []
  );

  useEffect(() => {
    loadWorkflow();
  }, [id]);

  const loadWorkflow = async () => {
    if (!token || !id) return;

    try {
      setLoading(true);
      const data = await workflowService.getWorkflowById(id, token);
      setWorkflow(data);

      // Convert workflow nodes to React Flow nodes
      const flowNodes: Node[] = data.workflow_nodes.map((node) => {
        // Map backend node types to custom node components
        let nodeType = "default";
        if (node.data.type === "start") nodeType = "start";
        else if (node.data.type === "end") nodeType = "end";
        else if (node.data.type === "agent") nodeType = "agent";
        else if (node.data.type === "if_else") nodeType = "if_else";
        else if (node.data.type === "user_approval") nodeType = "user_approval";

        return {
          id: node.id,
          type: nodeType,
          position: { x: node.x_pos, y: node.y_pos },
          data: {
            label: node.name,
            ...node.data,
          },
        };
      });

      // Convert workflow edges to React Flow edges
      const flowEdges: Edge[] = data.workflow_edges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: "smoothstep",
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error("Failed to load workflow:", error);
      toast.error("Failed to load workflow");
      navigate("/app/workflows");
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Loading workflow...</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Workflow not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Node Types */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <div className="mb-6 cursor-pointer">
          <button
            onClick={() => navigate("/app/workflows")}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <span className="mr-2 cursor-pointer">←</span> Back to Workflows
          </button>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {workflow.name}
          </h2>
          {workflow.description && (
            <p className="text-sm text-gray-600">{workflow.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Available Nodes
          </h3>

          {/* Logic Nodes */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Logic Nodes
            </h4>
            {nodeTypes
              .filter((node) => node.type === "logic")
              .map((node) => (
                <div
                  key={node.id}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2 cursor-move hover:bg-blue-100 transition-colors"
                  draggable 
                >
                  <div className="text-sm font-medium text-gray-900">
                    {node.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {node.description}
                  </div>
                </div>
              ))}
          </div>

          {/* Agent Node */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Agent Node
            </h4>
            {nodeTypes
              .filter((node) => node.type === "agent")
              .map((node) => (
                <div
                  key={node.id}
                  className="p-3 bg-purple-50 border border-purple-200 rounded-lg mb-2 cursor-move hover:bg-purple-100 transition-colors"
                  draggable
                >
                  <div className="text-sm font-medium text-gray-900">
                    {node.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {node.description}
                  </div>
                </div>
              ))}
          </div>

          {/* End Node */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              End Node
            </h4>
            {nodeTypes
              .filter((node) => node.type === "end")
              .map((node) => (
                <div
                  key={node.id}
                  className="p-3 bg-red-50 border border-red-200 rounded-lg mb-2 cursor-move hover:bg-red-100 transition-colors"
                  draggable
                >
                  <div className="text-sm font-medium text-gray-900">
                    {node.label}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {node.description}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Main Canvas - React Flow */}
      <div className="flex-1 bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={customNodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
