export default function Playground() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Playground</h1>
          <p className="text-gray-600">
            Test and experiment with your agents
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎮</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Interactive Playground
          </h3>
          <p className="text-gray-600 mb-6">
            Test your agents in a sandbox environment
          </p>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Start Testing
          </button>
        </div>
      </div>
    </div>
  );
}
