import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css' // VD-001·VD-003 자체 호스팅
import './styles/tokens.css'
import './styles/tailwind.css'
import './styles/base.css'
// 인트로 결정은 라우터가 '/'를 리다이렉트하기 전에 계산해야 하므로 라우터보다 먼저 import
import './features/intro/initialEntry'
import { router } from './routes/router'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
