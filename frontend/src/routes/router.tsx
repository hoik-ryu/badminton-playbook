import { createBrowserRouter, type RouteObject } from 'react-router'

import { RootLayout } from './RootLayout'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      // Add feature routes here, e.g. { path: 'examples', element: <ExamplesPage /> }
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
