import { createBrowserRouter, Navigate } from "react-router";
import Login from "./pages/login";
import Signup from "./pages/signup";

export const router = createBrowserRouter([
  {
    path: "/",
    element:  <Navigate to="login" replace />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
]);
