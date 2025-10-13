export default function Actions() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Actions</h1>
          <p className="text-gray-600">
            Manage and configure your custom actions
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔧</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No actions yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first action to extend functionality
          </p>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Create Action
          </button>
        </div>
      </div>
    </div>
  );
}
