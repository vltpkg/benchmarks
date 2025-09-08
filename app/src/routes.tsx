import App from "@/app";
import { Navigate, RouterProvider, createHashRouter } from "react-router";
import { VariationPage } from "@/components/variation";

import type { RouteObject } from "react-router";

const packageManagerRoutes: RouteObject = {
  path: "package-managers",
  children: [
    { index: true, element: <Navigate to="clean" replace={true} /> },
    { path: ":variation", element: <VariationPage /> },
    { path: ":variation/:section", element: <VariationPage /> },
    { path: ":variation/:section/:fixture", element: <VariationPage /> },
  ],
};

const taskRunnerRoutes: RouteObject = {
  path: "task-runners",
  children: [
    { index: true, element: <Navigate to="run" replace={true} /> },
    { path: ":variation", element: <VariationPage /> },
    { path: ":variation/:section", element: <VariationPage /> },
    { path: ":variation/:section/:fixture", element: <VariationPage /> },
  ],
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [packageManagerRoutes, taskRunnerRoutes],
  },
];

const router = createHashRouter(routes);

export const Router = () => <RouterProvider router={router} />;
