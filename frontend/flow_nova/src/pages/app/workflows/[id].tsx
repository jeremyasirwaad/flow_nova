import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

// Import custom node components
import StartNode from "@/components/workflow-nodes/StartNode";
import EndNode from "@/components/workflow-nodes/EndNode";
import AgentNode from "@/components/workflow-nodes/AgentNode";
import IfElseNode from "@/components/workflow-nodes/IfElseNode";
import UserApprovalNode from "@/components/workflow-nodes/UserApprovalNode";
import GuardrailsNode from "@/components/workflow-nodes/GuardrailsNode";
import NodeConfigPanel from "@/components/NodeConfigPanel";

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
    id: "guardrails",
    label: "Guardrails",
    type: "guardrails",
    description: "Safety and validation checks",
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
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Register custom node types
  const customNodeTypes = useMemo(
    () => ({
      start: StartNode,
      end: EndNode,
      agent: AgentNode,
      if_else: IfElseNode,
      user_approval: UserApprovalNode,
      guardrails: GuardrailsNode,
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
        else if (node.data.type === "guardrails") nodeType = "guardrails";

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

      // Get valid node IDs
      const validNodeIds = new Set(flowNodes.map((node) => node.id));

      // Convert workflow edges to React Flow edges, filtering out invalid edges
      const flowEdges: Edge[] = data.workflow_edges
        .filter((edge) => {
          // Only include edges where both source and target nodes exist
          const isValid = validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
          if (!isValid) {
            console.warn(`Skipping invalid edge: ${edge.source} → ${edge.target}`);
          }
          return isValid;
        })
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.source_handle || undefined,
          targetHandle: edge.target_handle || undefined,
          type: "bezier",
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

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (confirm("Delete this connection?")) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        toast.success("Connection deleted");
      }
    },
    [setEdges]
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        })
      );
      toast.success("Node updated successfully");
    },
    [setNodes]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      toast.success("Node deleted successfully");
    },
    [setNodes, setEdges]
  );

  // Drag and drop handlers
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string,
    label: string
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("application/nodelabel", label);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const nodeType = event.dataTransfer.getData("application/reactflow");
      const nodeLabel = event.dataTransfer.getData("application/nodelabel");

      if (!nodeType) return;

      // Calculate position on the canvas
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: uuidv4(),
        type: nodeType,
        position,
        data: {
          label: nodeLabel,
          type: nodeType,
          description: nodeTypes.find((n) => n.id === nodeType)?.description || "",
        },
      };

      setNodes((nds) => nds.concat(newNode));
      toast.success(`${nodeLabel} added to canvas`);
    },
    [reactFlowInstance, setNodes]
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

  const handleSaveWorkflow = async () => {
    if (!token || !id || !workflow) return;

    try {
      // Transform React Flow nodes to API format
      const apiNodes = nodes.map((node) => ({
        id: node.id,
        name: node.data.label || "Unnamed Node",
        x_pos: node.position.x,
        y_pos: node.position.y,
        data: node.data,
      }));

      // Transform React Flow edges to API format
      const apiEdges = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
      }));

      const updateData = {
        name: workflow.name,
        description: workflow.description || "",
        nodes: apiNodes,
        edges: apiEdges,
      };

      const updatedWorkflow = await workflowService.updateWorkflow(
        id,
        updateData,
        token
      );

      setWorkflow(updatedWorkflow);
      toast.success("Workflow saved successfully!");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save workflow"
      );
    }
  };

  const handleRunWorkflow = async () => {
    // TODO: Implement run workflow functionality
    toast.success("Workflow execution started!");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/workflows")}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Workflows
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {workflow.name}
            </h1>
            {workflow.description && (
              <p className="text-xs text-gray-500">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveWorkflow}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            Save
          </button>
          <button
            onClick={handleRunWorkflow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
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
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Run
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Node Types */}
        <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
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
                  onDragStart={(event) => onDragStart(event, node.id, node.label)}
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

          {/* Guardrails Node */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Guardrails Node
            </h4>
            {nodeTypes
              .filter((node) => node.type === "guardrails")
              .map((node) => (
                <div
                  key={node.id}
                  className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg mb-2 cursor-move hover:bg-cyan-100 transition-colors"
                  draggable
                  onDragStart={(event) => onDragStart(event, node.id, node.label)}
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
                  onDragStart={(event) => onDragStart(event, node.id, node.label)}
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
                  onDragStart={(event) => onDragStart(event, node.id, node.label)}
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
      <div className="flex-1 bg-gray-50" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={customNodeTypes}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Node Configuration Panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onDelete={handleNodeDelete}
          onUpdate={handleNodeUpdate}
        />
      )}
      </div>
    </div>
  );
}
