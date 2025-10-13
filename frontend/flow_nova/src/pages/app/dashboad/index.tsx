import { NavLink } from "react-router";
import { MdSpaceDashboard } from "react-icons/md";
import { RiTestTubeFill } from "react-icons/ri";
import { LuWorkflow } from "react-icons/lu";
import { FaCircleNodes } from "react-icons/fa6";

export default function Dashboard() {
  const cards = [
    {
      title: "Dashboard",
      description: "View your analytics and insights",
      icon: <MdSpaceDashboard className="text-3xl" />,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      path: "/app/dashboard",
    },
    {
      title: "Playground",
      description: "Test and experiment with agents",
      icon: <RiTestTubeFill className="text-3xl" />,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      path: "/app/playground",
    },
    {
      title: "Workflows",
      description: "Automate your processes",
      icon: <LuWorkflow className="text-3xl" />,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      path: "/app/workflows",
    },
    {
      title: "Actions",
      description: "Manage custom actions",
      icon: <FaCircleNodes className="text-3xl" />,
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
      path: "/app/actions",
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, User
        </h1>
        <p className="text-gray-600 mb-8">
          Design and productionize agents effortlessly in minutes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <NavLink
              key={card.path}
              to={card.path}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all"
            >
              <div
                className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center mb-4`}
              >
                <span className={card.iconColor}>{card.icon}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600">{card.description}</p>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
