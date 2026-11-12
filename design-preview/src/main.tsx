import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css' // VD-003 자체 호스팅
import './app.css'
import './tokens.css'
import './preview.css'
import { PreviewApp } from './PreviewApp'

// ?safe=34: 기기 하단 안전 영역(가정값)을 흉내 냄. 실제 기기는 env(safe-area-inset-bottom)
const safe = new URLSearchParams(window.location.search).get('safe')
if (safe) document.documentElement.style.setProperty('--safe-bottom', `${Number(safe)}px`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
)
