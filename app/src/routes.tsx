import { RouterProvider, createBrowserRouter } from "react-router";
import App from "@/app";
import { VariationPage } from "@/components/variation";
import type { RouteObject } from "react-router";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: ":variation",
        element: <VariationPage />,
      },
    ],
  },
];

const router = createBrowserRouter(routes);

export const Router = () => <RouterProvider router={router} />;
