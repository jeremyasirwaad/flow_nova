import { Handle, Position, type NodeProps } from "reactflow";

export default function GuardrailsNode({ data }: NodeProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-cyan-200 min-w-[200px]">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-cyan-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">
            {data.label || "Guardrails"}
          </div>
          {data.description && (
            <div className="text-xs text-gray-500 mt-0.5">
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
    </div>
  );
}
