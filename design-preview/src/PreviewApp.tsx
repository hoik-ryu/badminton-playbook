import { useEffect, useMemo, useState } from 'react'
import manifest from '../preview.manifest.json'
import { skipReason } from './previewLinks'
import { screens } from './registry'

type Viewport = 'mobile' | 'tablet' | 'desktop'
const WIDTH: Record<Viewport, number> = { mobile: 390, tablet: 768, desktop: 1280 }

function parseHash(): { screen?: string; state?: string; vp?: Viewport } {
  const [screen, state, vp] = window.location.hash.replace(/^#/, '').split('/')
  return { screen: screen || undefined, state: state || undefined, vp: (vp as Viewport) || undefined }
}

// ?bare=1: 화면만 전체 폭으로 그림(측정·기기 확인용). 셸(화면 목록·도구 막대)을 그리지 않음
const BARE = new URLSearchParams(window.location.search).has('bare')

export function PreviewApp() {
  const ids = useMemo(() => Object.keys(screens).sort(), [])
  const initial = parseHash()
  // 등록되지 않은 화면 ID도 받습니다(화면 안 링크가 아직 구현 전 화면을 가리킬 때 '미구현' 안내를 보여 주기 위함)
  const [screenId, setScreenId] = useState(initial.screen ?? ids[0])
  const screen = screenId ? screens[screenId] : undefined
  const [stateId, setStateId] = useState(initial.state ?? screen?.states[0]?.id ?? '')
  const [vp, setVp] = useState<Viewport>(initial.vp ?? (screen?.platform === 'responsive' ? 'desktop' : 'mobile'))

  useEffect(() => {
    // 방문 기록을 늘리지 않도록 replaceState로 동기화(화면 안 링크의 '뒤로'가 같은 화면으로 돌아오지 않게)
    if (screenId) window.history.replaceState(null, '', `#${screenId}/${stateId}/${vp}`)
  }, [screenId, stateId, vp])

  // 화면 안 링크(#SCR-xxx/…)를 누르면 해시가 바뀌므로 그에 맞춰 화면을 바꿉니다
  useEffect(() => {
    const onHash = () => {
      const h = parseHash()
      if (!h.screen) return
      setScreenId(h.screen)
      setStateId(h.state ?? screens[h.screen]?.states[0]?.id ?? '')
      if (h.vp) setVp(h.vp)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const select = (id: string) => {
    setScreenId(id)
    setStateId(screens[id].states[0]?.id ?? '')
    setVp(screens[id].platform === 'responsive' ? 'desktop' : 'mobile')
  }

  if (BARE) return <div className="pv-bare">{screen ? screen.render(stateId) : screenId && <Unimplemented id={screenId} />}</div>

  return (
    <div className="pv-root">
      <aside className="pv-nav" aria-label="화면 목록">
        <p className="pv-badge">정적 프리뷰 · 제품 코드 아님 · UX 설계 r{String(manifest.ux_spec_revision)}</p>
        {ids.length === 0 && <p>등록된 화면이 없습니다. src/registry.tsx에 화면을 등록하세요.</p>}
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <button type="button" aria-current={id === screenId} onClick={() => select(id)}>
                <span className="pv-id">{id}</span> {screens[id].title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="pv-main">
        {!screen && screenId && (
          <div className="pv-stage">
            <div className="pv-frame" style={{ width: WIDTH.mobile }} data-viewport="mobile">
              <Unimplemented id={screenId} />
            </div>
          </div>
        )}
        {screen && (
          <>
            <div className="pv-toolbar">
              <div role="tablist" aria-label="화면 상태">
                {screen.states.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={s.id === stateId} onClick={() => setStateId(s.id)}>
                    {s.label} <span className="pv-id">{s.id}</span>
                  </button>
                ))}
              </div>
              <div aria-label="화면 폭">
                {(Object.keys(WIDTH) as Viewport[]).map((v) => (
                  <button key={v} type="button" aria-pressed={v === vp} onClick={() => setVp(v)}>
                    {v} {WIDTH[v]}px
                  </button>
                ))}
              </div>
            </div>
            <div className="pv-stage">
              <div className="pv-frame" style={{ width: WIDTH[vp] }} data-viewport={vp}>
                {screen.render(stateId)}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// 프리뷰 셸 안내(제품 화면 아님): 화면 안 링크가 아직 프리뷰에 구현하지 않은 화면을 가리킬 때 보여 줍니다
function Unimplemented({ id }: { id: string }) {
  const reason = skipReason(id)
  return (
    <div className="pv-missing" role="status" data-preview-missing={id}>
      <p className="pv-badge">프리뷰 안내 · 제품 화면 아님</p>
      <h2>
        <span className="pv-id">{id}</span> 아직 프리뷰에 구현하지 않은 화면입니다
      </h2>
      <p>{reason ? `manifest 사유: ${reason}` : '02-screens.md에 없는 화면 ID입니다.'}</p>
      <button type="button" onClick={() => window.history.back()}>
        이전 화면으로
      </button>
    </div>
  )
}
