import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { workflowService } from "@/services/workflow";
import type {
  WorkflowRun,
  WorkflowLedgerEntry,
  WorkflowNode,
} from "@/services/workflow";
import toast from "react-hot-toast";

interface LiveExecutionEntry {
  id: string;
  node_id: string;
  node_type: string;
  event_type: string;
  input_data?: any;
  output_data?: any;
  timestamp: string;
  duration?: number;
}

interface RunHistoryPanelProps {
  workflowId: string;
  workflowNodes: WorkflowNode[];
  isOpen: boolean;
  onClose: () => void;
  currentRunId?: string | null;
  isExecuting?: boolean;
  onWebSocketEvent?: (event: any) => void;
  onLedgerUpdate?: (ledgerEntries: WorkflowLedgerEntry[]) => void;
}

type TabType = "live" | "history";

export default function RunHistoryPanel({
  workflowId,
  workflowNodes,
  isOpen,
  onClose,
  currentRunId,
  isExecuting = false,
  onWebSocketEvent,
}: RunHistoryPanelProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [liveExecutionEntries, setLiveExecutionEntries] = useState<LiveExecutionEntry[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunLedger, setSelectedRunLedger] = useState<
    WorkflowLedgerEntry[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const ledgerRef = useRef<HTMLDivElement>(null);

  // Get node name by ID
  const getNodeName = (nodeId: string): string => {
    const node = workflowNodes.find((n) => n.id === nodeId);
    return node?.name || nodeId.substring(0, 8);
  };

  // Load runs
  const loadRuns = async () => {
    if (!token) return;

    try {
      const data = await workflowService.getWorkflowRuns(workflowId, token);
      setRuns(data);
    } catch (error) {
      console.error("Failed to load runs:", error);
      toast.error("Failed to load run history");
    }
  };

  // Handle WebSocket events for live execution
  const handleWebSocketEvent = useCallback((event: any) => {
    if (!event || !event.event_type) return;

    // Only process node_started and node_completed events
    if (event.event_type === "node_started" || event.event_type === "node_completed") {
      setLiveExecutionEntries((prev) => {
        // Check if this is a completion event for an existing entry
        if (event.event_type === "node_completed") {
          const existingIndex = prev.findIndex((e) => e.node_id === event.node_id);

          if (existingIndex !== -1) {
            // Update the existing entry with completion data
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              output_data: event.output_data,
              duration: event.duration,
              event_type: "node_completed",
              timestamp: event.timestamp,
            };
            return updated;
          }
        }

        // Check if this is a started event and node already exists
        if (event.event_type === "node_started") {
          const existingIndex = prev.findIndex((e) => e.node_id === event.node_id);
          if (existingIndex !== -1) {
            // Don't add duplicate, just return current state
            return prev;
          }
        }

        // Add new entry
        const entry: LiveExecutionEntry = {
          id: `${event.node_id}-${Date.now()}`,
          node_id: event.node_id,
          node_type: event.node_type,
          event_type: event.event_type,
          input_data: event.input_data,
          output_data: event.output_data,
          timestamp: event.timestamp,
          duration: event.duration,
        };

        return [...prev, entry];
      });

      // Auto-scroll to bottom
      setTimeout(() => {
        if (ledgerRef.current) {
          ledgerRef.current.scrollTop = ledgerRef.current.scrollHeight;
        }
      }, 100);
    }

    // Reset live entries when a new run starts
    if (event.event_type === "run_started") {
      setLiveExecutionEntries([]);
    }
  }, []);

  // Load ledger for a specific run
  const loadRunLedger = async (runId: string) => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await workflowService.getRunLedger(runId, token);
      setSelectedRunLedger(data);
      setSelectedRunId(runId);
    } catch (error) {
      console.error("Failed to load run ledger:", error);
      toast.error("Failed to load run details");
    } finally {
      setLoading(false);
    }
  };

  // Toggle entry expansion
  const toggleEntry = (entryId: string) => {
    setExpandedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  // Toggle run expansion
  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(runId)) {
        newSet.delete(runId);
        if (selectedRunId === runId) {
          setSelectedRunId(null);
          setSelectedRunLedger([]);
        }
      } else {
        newSet.add(runId);
        loadRunLedger(runId);
      }
      return newSet;
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  // Get node type badge color
  const getNodeTypeBadgeColor = (nodeType: string): string => {
    switch (nodeType) {
      case "start":
        return "bg-green-100 text-green-700";
      case "end":
        return "bg-red-100 text-red-700";
      case "agent":
        return "bg-purple-100 text-purple-700";
      case "if_else":
        return "bg-blue-100 text-blue-700";
      case "user_approval":
        return "bg-yellow-100 text-yellow-700";
      case "guardrails":
        return "bg-cyan-100 text-cyan-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Handle replay
  const handleReplay = async (runId: string) => {
    if (!token) return;

    try {
      toast.loading("Starting replay...", { id: "replay" });
      await workflowService.replayRun(runId, token);
      toast.success("Workflow replay started! Check the Live Execution tab.", {
        id: "replay",
        duration: 3000,
      });
      setActiveTab("live");
    } catch (error) {
      console.error("Failed to replay run:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to replay workflow",
        { id: "replay" }
      );
    }
  };

  // Load runs on mount
  useEffect(() => {
    if (isOpen) {
      loadRuns();
    }
  }, [isOpen]);

  // Expose handleWebSocketEvent to parent
  useEffect(() => {
    if (onWebSocketEvent) {
      onWebSocketEvent(handleWebSocketEvent);
    }
  }, [onWebSocketEvent, handleWebSocketEvent]);

  // Switch to live tab when execution starts
  useEffect(() => {
    if (isExecuting && currentRunId) {
      setActiveTab("live");
    }
  }, [isExecuting, currentRunId]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[500px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Workflow Runs</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "live"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {isExecuting && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
            Live Execution
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab("history");
            loadRuns();
          }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          Run History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "live" ? (
          <div className="p-4 space-y-3" ref={ledgerRef}>
            {!currentRunId && !isExecuting && (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <p className="text-sm">No active execution</p>
                <p className="text-xs mt-1">
                  Click "Run" to start a workflow execution
                </p>
              </div>
            )}

            {liveExecutionEntries.length === 0 && currentRunId && (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm">Waiting for execution data...</p>
              </div>
            )}

            {liveExecutionEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleEntry(entry.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${getNodeTypeBadgeColor(
                            entry.node_type
                          )}`}
                        >
                          {entry.node_type}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {getNodeName(entry.node_id)}
                        </span>
                        {entry.event_type === "node_completed" && (
                          <span className="text-xs text-green-600 font-medium">✓</span>
                        )}
                        {entry.event_type === "node_started" && (
                          <span className="text-xs text-blue-600 font-medium">⋯</span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                        expandedEntries.has(entry.id) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Always visible Input preview */}
                  {entry.input_data && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Input:
                      </div>
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-100 overflow-x-auto max-h-20 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.input_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Always visible Output preview */}
                  {entry.output_data && Object.keys(entry.output_data).length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Output:
                      </div>
                      <div className="text-xs bg-green-50 p-2 rounded border border-green-100 overflow-x-auto max-h-20 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.output_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Show duration if available */}
                  {entry.duration && (
                    <div className="mt-2 text-xs text-gray-600">
                      <span className="font-semibold">Duration:</span> {entry.duration.toFixed(3)}s
                    </div>
                  )}
                </div>

                {/* Expanded view with full details */}
                {expandedEntries.has(entry.id) && (
                  <div className="border-t border-gray-200 p-3 space-y-3 bg-gray-50">
                    {/* Full Input */}
                    {entry.input_data && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          Full Input Data
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(entry.input_data, null, 2));
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                        <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-60 overflow-y-auto">
                          {JSON.stringify(entry.input_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Full Output */}
                    {entry.output_data && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-2">
                          Full Output Data
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(entry.output_data, null, 2));
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                        <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-60 overflow-y-auto">
                          {JSON.stringify(entry.output_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-gray-600">Node ID:</span>
                          <div className="font-mono text-gray-800 truncate" title={entry.node_id}>
                            {entry.node_id.substring(0, 8)}...
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">Event:</span>
                          <div className="text-gray-800">
                            {entry.event_type}
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-600">Timestamp:</span>
                          <div className="text-gray-800">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        {entry.duration && (
                          <div>
                            <span className="font-semibold text-gray-600">Duration:</span>
                            <div className="text-gray-800">
                              {entry.duration.toFixed(3)}s
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {runs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm">No runs yet</p>
                <p className="text-xs mt-1">
                  Execute the workflow to see run history
                </p>
              </div>
            )}

            {runs.map((run) => (
              <div
                key={run.id}
                className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleRun(run.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                          {run.id.substring(0, 8)}...
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(run.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy Run ID"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReplay(run.id);
                          }}
                          className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                          title="Replay this run with the same inputs"
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
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(run.created_at)}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        expandedRuns.has(run.id) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Input preview */}
                  {Object.keys(run.input_json).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      <span className="font-medium">Input:</span>{" "}
                      {JSON.stringify(run.input_json).substring(0, 50)}
                      {JSON.stringify(run.input_json).length > 50 && "..."}
                    </div>
                  )}
                </div>

                {/* Expanded ledger */}
                {expandedRuns.has(run.id) && (
                  <div className="border-t border-gray-200 bg-white">
                    {loading && selectedRunId === run.id && (
                      <div className="p-4 text-center">
                        <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
                      </div>
                    )}

                    {!loading && selectedRunId === run.id && (
                      <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
                        {selectedRunLedger.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-4">
                            No ledger entries found
                          </p>
                        )}

                        {selectedRunLedger.map((entry, idx) => (
                          <div
                            key={entry.id}
                            className="border border-gray-200 rounded bg-white overflow-hidden"
                          >
                            {/* Header */}
                            <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
                              <span className="font-mono text-gray-500 text-xs">
                                {idx + 1}.
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded ${getNodeTypeBadgeColor(
                                  entry.node_type
                                )}`}
                              >
                                {entry.node_type}
                              </span>
                              <span className="font-medium text-gray-900 text-xs">
                                {getNodeName(entry.node_id)}
                              </span>
                            </div>

                            {/* Input and Output side by side */}
                            <div className="grid grid-cols-2 gap-2 p-2">
                              {/* Input Column */}
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1 px-2 py-1 bg-blue-50 rounded-t">
                                  Input
                                </div>
                                <pre className="text-xs bg-blue-50 p-2 rounded-b border border-blue-100 overflow-x-auto max-h-40 overflow-y-auto">
                                  {JSON.stringify(entry.input_json, null, 2)}
                                </pre>
                              </div>

                              {/* Output Column */}
                              <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1 px-2 py-1 bg-green-50 rounded-t">
                                  Output
                                </div>
                                {entry.output_json && Object.keys(entry.output_json).length > 0 ? (
                                  <pre className="text-xs bg-green-50 p-2 rounded-b border border-green-100 overflow-x-auto max-h-40 overflow-y-auto">
                                    {JSON.stringify(entry.output_json, null, 2)}
                                  </pre>
                                ) : (
                                  <div className="text-xs bg-gray-50 p-2 rounded-b border border-gray-200 text-gray-500 italic">
                                    No output
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tool Calls (if present) */}
                            {entry.tool_calls && (
                              <div className="p-2 border-t border-gray-200">
                                <div className="text-xs font-semibold text-gray-700 mb-1 px-2 py-1 bg-purple-50 rounded-t">
                                  Tool Calls
                                </div>
                                <pre className="text-xs bg-purple-50 p-2 rounded-b border border-purple-100 overflow-x-auto max-h-32 overflow-y-auto">
                                  {JSON.stringify(entry.tool_calls, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
