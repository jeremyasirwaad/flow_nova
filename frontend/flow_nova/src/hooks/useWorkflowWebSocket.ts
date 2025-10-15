import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export type NodeExecutionState = "idle" | "executing" | "completed" | "error";

export interface NodeExecutionStatus {
  [nodeId: string]: {
    state: NodeExecutionState;
    startTime?: string;
    endTime?: string;
    duration?: number;
  };
}

export interface WebSocketEvent {
  event_type: string;
  run_id?: string;
  workflow_id?: string;
  timestamp?: string;
  node_id?: string;
  node_type?: string;
  input_data?: any;
  output_data?: any;
  duration?: number;
  data?: any;
  message?: string;
}

interface UseWorkflowWebSocketOptions {
  workflowId: string;
  token: string;
  onConnected?: () => void;
  onRunStarted?: (event: WebSocketEvent) => void;
  onNodeStarted?: (event: WebSocketEvent) => void;
  onNodeCompleted?: (event: WebSocketEvent) => void;
  onNodeError?: (event: WebSocketEvent) => void;
  onRunCompleted?: (event: WebSocketEvent) => void;
  onApprovalNeeded?: (event: WebSocketEvent) => void;
  onError?: (error: Event) => void;
}

export const useWorkflowWebSocket = ({
  workflowId,
  token,
  onConnected,
  onRunStarted,
  onNodeStarted,
  onNodeCompleted,
  onNodeError,
  onRunCompleted,
  onApprovalNeeded,
  onError,
}: UseWorkflowWebSocketOptions) => {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nodeExecutionStatus, setNodeExecutionStatus] =
    useState<NodeExecutionStatus>({});
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Store callbacks in refs to avoid recreating connect function
  const callbacksRef = useRef({
    onConnected,
    onRunStarted,
    onNodeStarted,
    onNodeCompleted,
    onNodeError,
    onRunCompleted,
    onApprovalNeeded,
    onError,
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onConnected,
      onRunStarted,
      onNodeStarted,
      onNodeCompleted,
      onNodeError,
      onRunCompleted,
      onApprovalNeeded,
      onError,
    };
  }, [onConnected, onRunStarted, onNodeStarted, onNodeCompleted, onNodeError, onRunCompleted, onApprovalNeeded, onError]);

  const connect = useCallback(() => {
    if (!workflowId || !token) {
      console.log("Cannot connect: missing workflowId or token");
      return;
    }

    try {
      const wsUrl = `${WS_URL}/api/ws/workflows/${workflowId}?auth-token=${token}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          console.log("WebSocket event:", data);

          switch (data.event_type) {
            case "connected":
              callbacksRef.current.onConnected?.();
              break;

            case "run_started":
              // Reset all node states when a new run starts
              setNodeExecutionStatus({});
              callbacksRef.current.onRunStarted?.(data);
              break;

            case "node_started":
              if (data.node_id) {
                setNodeExecutionStatus((prev) => ({
                  ...prev,
                  [data.node_id!]: {
                    state: "executing",
                    startTime: data.timestamp,
                  },
                }));
              }
              callbacksRef.current.onNodeStarted?.(data);
              break;

            case "node_completed":
              if (data.node_id) {
                setNodeExecutionStatus((prev) => ({
                  ...prev,
                  [data.node_id!]: {
                    state: "completed",
                    startTime: prev[data.node_id!]?.startTime,
                    endTime: data.timestamp,
                    duration: data.duration,
                  },
                }));
              }
              callbacksRef.current.onNodeCompleted?.(data);
              break;

            case "node_error":
              if (data.node_id) {
                setNodeExecutionStatus((prev) => ({
                  ...prev,
                  [data.node_id!]: {
                    state: "error",
                    startTime: prev[data.node_id!]?.startTime,
                    endTime: data.timestamp,
                  },
                }));
              }
              callbacksRef.current.onNodeError?.(data);
              break;

            case "run_completed":
            case "run_failed":
              callbacksRef.current.onRunCompleted?.(data);
              break;

            case "approval_needed":
              // Mark the node as waiting for approval
              if (data.node_id) {
                setNodeExecutionStatus((prev) => ({
                  ...prev,
                  [data.node_id!]: {
                    state: "executing", // Keep as executing but with special status
                    startTime: prev[data.node_id!]?.startTime,
                  },
                }));
              }
              callbacksRef.current.onApprovalNeeded?.(data);
              break;

            default:
              console.log("Unknown event type:", data.event_type);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        callbacksRef.current.onError?.(error);
      };

      ws.current.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current += 1;
          console.log(
            `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [workflowId, token]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setIsConnected(false);
    setNodeExecutionStatus({});
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    nodeExecutionStatus,
    disconnect,
    reconnect: connect,
  };
};
