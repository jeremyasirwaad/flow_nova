import { Handle, Position, type NodeProps } from "reactflow";

export default function StartNode({ data }: NodeProps) {
  const executionState = data.executionState || "idle";

  const getBorderColor = () => {
    switch (executionState) {
      case "executing":
        return "border-blue-400";
      case "completed":
        return "border-emerald-400";
      case "error":
        return "border-red-400";
      default:
        return "border-emerald-200";
    }
  };

  const getAnimationClass = () => {
    if (executionState === "executing") {
      return "animate-pulse";
    }
    return "";
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg border-2 ${getBorderColor()} ${getAnimationClass()} min-w-[180px] relative`}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 relative">
          {executionState === "executing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600 animate-spin"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
          {executionState === "completed" && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <svg
            className={`w-5 h-5 text-emerald-600 ${executionState === "executing" ? "opacity-30" : ""}`}
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
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {data.label || "Start"}
          </div>
          {data.description && (
            <div className="text-xs text-gray-500 mt-0.5">
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
}
