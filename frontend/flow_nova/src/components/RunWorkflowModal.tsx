import { useState } from "react";

interface RunWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inputData: any) => void;
  workflowName: string;
}

export default function RunWorkflowModal({
  isOpen,
  onClose,
  onSubmit,
  workflowName,
}: RunWorkflowModalProps) {
  const [jsonInput, setJsonInput] = useState("{\n  \n}");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Get workflow-specific example based on workflow name
  const getExampleForWorkflow = () => {
    const name = workflowName.toLowerCase();

    if (name.includes("content summarizer")) {
      return {
        article_text: "An adult tree can absorb about 22 kilograms of carbon per year, according to the European Environment Agency. With newer research suggesting that only a third of the previously estimated trees (around 330 billion) may be needed to cool the planet by 1°C, the case for growing trees offers hope in a time when an increasingly erratic climate desperately needs solutions."
      };
    } else if (name.includes("age validator")) {
      return { age: 18 };
    } else if (name.includes("user approval")) {
      return { start: "none" };
    } else if (name.includes("customer support") || name.includes("ticket handler")) {
      return { ticket: "I need help with my order, do get back when available" };
    } else {
      // Default example
      return {
        test_param: "hello world",
        user_id: "12345"
      };
    }
  };

  const exampleData = getExampleForWorkflow();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const parsedData = JSON.parse(jsonInput);
      onSubmit(parsedData);
      onClose();
      setJsonInput("{\n  \n}"); // Reset
    } catch (err) {
      setError("Invalid JSON format. Please check your input.");
    }
  };

  const handleUseExample = () => {
    setJsonInput(JSON.stringify(exampleData, null, 2));
    setError(null);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Run Workflow: {workflowName}
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
          <div className="px-6 py-4">
            <label
              htmlFor="jsonInput"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Input Data (JSON)
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Provide the input parameters for this workflow execution as a JSON
              object.
            </p>
            <textarea
              id="jsonInput"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder='{\n  "param1": "value1",\n  "param2": "value2"\n}'
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            )}

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">
                  Example:
                </h4>
                <button
                  type="button"
                  onClick={handleUseExample}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium underline"
                >
                  Use this example
                </button>
              </div>
              <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(exampleData, null, 2)}
              </pre>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
              Run Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
