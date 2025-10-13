import { createBrowserRouter, Navigate } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/login";
import Signup from "./pages/signup";
import AppLayout from "./pages/app";
import Dashboard from "./pages/app/dashboad";
import Agents from "./pages/app/agents";
import Workflows from "./pages/app/workflows";
import WorkflowEditor from "./pages/app/workflows/[id]";
import Actions from "./pages/app/actions";
import Playground from "./pages/app/playgroud";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="app" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "agents",
        element: <Agents />,
      },
      {
        path: "workflows",
        element: <Workflows />,
      },
      {
        path: "workflows/:id",
        element: <WorkflowEditor />,
      },
      {
        path: "actions",
        element: <Actions />,
      },
      {
        path: "playground",
        element: <Playground />,
      },
    ],
  },
]);
