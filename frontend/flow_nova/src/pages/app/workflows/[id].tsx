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
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { useWorkflowWebSocket } from "@/hooks/useWorkflowWebSocket";

// Import custom node components
import StartNode from "@/components/workflow-nodes/StartNode";
import EndNode from "@/components/workflow-nodes/EndNode";
import AgentNode from "@/components/workflow-nodes/AgentNode";
import IfElseNode from "@/components/workflow-nodes/IfElseNode";
import UserApprovalNode from "@/components/workflow-nodes/UserApprovalNode";
import GuardrailsNode from "@/components/workflow-nodes/GuardrailsNode";
import ForkNode from "@/components/workflow-nodes/ForkNode";
import CognitiveNode from "@/components/workflow-nodes/CognitiveNode";
import NodeConfigPanel from "@/components/NodeConfigPanel";
import RunWorkflowModal from "@/components/RunWorkflowModal";
import RunHistoryPanel from "@/components/RunHistoryPanel";
import ApprovalModal from "@/components/ApprovalModal";

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
    id: "fork",
    label: "Fork",
    type: "parallel",
    description: "Parallel branching",
  },
  {
    id: "cognitive",
    label: "Cognitive",
    type: "cognitive",
    description: "AI workflow generation",
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
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [wsEventHandler, setWsEventHandler] = useState<((event: any) => void) | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    message: string;
    nodeId: string;
  }>({
    isOpen: false,
    message: "",
    nodeId: "",
  });
  const [isApprovingNode, setIsApprovingNode] = useState(false);

  // WebSocket connection callbacks
  const handleWebSocketConnected = useCallback(() => {
    console.log("Connected to workflow WebSocket");
  }, []);

  const handleRunStarted = useCallback((event: any) => {
    toast.success("Workflow execution started!");
    console.log("Run started:", event);

    // Extract run_id from the event
    const runId = event.run_id || event.data?.run_id;
    if (runId) {
      setCurrentRunId(runId);
    }

    setIsExecuting(true);
    // Open history panel automatically when execution starts
    setIsHistoryPanelOpen(true);

    // Forward event to RunHistoryPanel
    if (wsEventHandler) {
      wsEventHandler(event);
    }
  }, [wsEventHandler]);

  const handleNodeStarted = useCallback((event: any) => {
    console.log("Node started:", event);
    // Forward event to RunHistoryPanel
    if (wsEventHandler) {
      wsEventHandler(event);
    }
  }, [wsEventHandler]);

  const handleNodeCompleted = useCallback((event: any) => {
    console.log("Node completed:", event);
    // Forward event to RunHistoryPanel
    if (wsEventHandler) {
      wsEventHandler(event);
    }
  }, [wsEventHandler]);

  const handleRunCompleted = useCallback((event: any) => {
    toast.success("Workflow execution completed!");
    console.log("Run completed:", event);
    setIsExecuting(false);

    // Keep completed states visible for a moment, then reset after 5 seconds
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            executionState: "idle",
          },
        }))
      );
    }, 5000);
  }, [setNodes]);

  const handleWebSocketError = useCallback((error: any) => {
    console.error("WebSocket error:", error);
  }, []);

  const handleApprovalNeeded = useCallback((event: any) => {
    console.log("Approval needed:", event);
    toast("Workflow paused - Approval required!", { icon: "⏸️" });

    setApprovalModal({
      isOpen: true,
      message: event.message || event.data?.message || "Do you want to continue with this workflow?",
      nodeId: event.node_id || event.data?.node_id || "",
    });
  }, []);

  const handleApproval = useCallback(async (decision: "yes" | "no") => {
    if (!token || !id || !currentRunId || !approvalModal.nodeId) {
      toast.error("Missing required information for approval");
      return;
    }

    try {
      setIsApprovingNode(true);
      await workflowService.approveNode(
        id,
        currentRunId,
        approvalModal.nodeId,
        decision,
        token
      );

      toast.success(`Workflow ${decision === "yes" ? "approved" : "rejected"} - Continuing execution`);

      // Close modal
      setApprovalModal({
        isOpen: false,
        message: "",
        nodeId: "",
      });
    } catch (error) {
      console.error("Failed to approve node:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve node"
      );
    } finally {
      setIsApprovingNode(false);
    }
  }, [token, id, currentRunId, approvalModal.nodeId]);

  // WebSocket connection for workflow execution events
  const { nodeExecutionStatus } = useWorkflowWebSocket({
    workflowId: id || "",
    token: token || "",
    onConnected: handleWebSocketConnected,
    onRunStarted: handleRunStarted,
    onNodeStarted: handleNodeStarted,
    onNodeCompleted: handleNodeCompleted,
    onRunCompleted: handleRunCompleted,
    onApprovalNeeded: handleApprovalNeeded,
    onError: handleWebSocketError,
  });

  // Register custom node types
  const customNodeTypes = useMemo(
    () => ({
      start: StartNode,
      end: EndNode,
      agent: AgentNode,
      if_else: IfElseNode,
      user_approval: UserApprovalNode,
      guardrails: GuardrailsNode,
      fork: ForkNode,
      cognitive: CognitiveNode,
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
        else if (node.data.type === "fork") nodeType = "fork";
        else if (node.data.type === "cognitive") nodeType = "cognitive";

        return {
          id: node.id,
          type: nodeType,
          position: { x: node.x_pos, y: node.y_pos },
          data: {
            label: node.name,
            ...node.data,
            executionState: "idle",
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

  // Handle ledger updates from the history panel
  const handleLedgerUpdate = useCallback((ledgerEntries: any[]) => {
    // Create a map of node execution states from ledger
    const nodeStates: { [nodeId: string]: string } = {};

    ledgerEntries.forEach((entry) => {
      // If output_json exists, node has completed
      if (entry.output_json !== null) {
        nodeStates[entry.node_id] = "completed";
      } else {
        // If no output yet, node is executing
        nodeStates[entry.node_id] = "executing";
      }
    });

    // Update nodes with execution states
    setNodes((nds) =>
      nds.map((node) => {
        const executionState = nodeStates[node.id] || node.data.executionState || "idle";
        return {
          ...node,
          data: {
            ...node.data,
            executionState,
          },
        };
      })
    );
  }, [setNodes]);

  const handleSaveWorkflow = useCallback(async () => {
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
  }, [token, id, workflow, nodes, edges]);

  const handleRunWorkflow = useCallback(() => {
    setIsRunModalOpen(true);
  }, []);

  const handleExecuteWorkflow = useCallback(async (inputData: any) => {
    if (!token || !id) return;

    try {
      const result = await workflowService.executeWorkflow(id, inputData, token);
      console.log("Workflow execution initiated:", result);
      // Set the current run ID for tracking
      if (result.run_id) {
        setCurrentRunId(result.run_id);
      }
    } catch (error) {
      console.error("Failed to execute workflow:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to execute workflow"
      );
    }
  }, [token, id]);

  // Update nodes with execution status - MUST be before early returns to maintain hook order
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionState: nodeExecutionStatus[node.id]?.state || "idle",
        },
      }))
    );
  }, [nodeExecutionStatus, setNodes]);

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
            onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
            className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isHistoryPanelOpen
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
            title="View run history"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
            {isExecuting && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
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

          {/* Parallel Nodes */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Parallel Nodes
            </h4>
            {nodeTypes
              .filter((node) => node.type === "parallel")
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

          {/* Cognitive Node */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Cognitive Node
            </h4>
            {nodeTypes
              .filter((node) => node.type === "cognitive")
              .map((node) => (
                <div
                  key={node.id}
                  className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-2 cursor-move hover:bg-indigo-100 transition-colors"
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

      {/* Run Workflow Modal */}
      <RunWorkflowModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onSubmit={handleExecuteWorkflow}
        workflowName={workflow?.name || "Workflow"}
      />

      {/* Run History Panel */}
      <RunHistoryPanel
        workflowId={id || ""}
        workflowNodes={workflow?.workflow_nodes || []}
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        currentRunId={currentRunId}
        isExecuting={isExecuting}
        onWebSocketEvent={(handler) => setWsEventHandler(() => handler)}
        onLedgerUpdate={handleLedgerUpdate}
      />

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, message: "", nodeId: "" })}
        onApprove={handleApproval}
        message={approvalModal.message}
        nodeId={approvalModal.nodeId}
        isSubmitting={isApprovingNode}
      />
      </div>
    </div>
  );
}
