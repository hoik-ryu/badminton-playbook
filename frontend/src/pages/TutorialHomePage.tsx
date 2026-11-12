import { useCallback, useEffect, useState } from 'react'
import { useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { getMyTutorialProgress, type ProgressMap } from '../features/tutorial/api'
import { LEVELS, stagesOf } from '../features/tutorial/content/stages'
import { StageCard } from '../features/tutorial/StageCard'
import type { ShellData } from '../routes/guards'

// SCR-101 튜토리얼 홈(/tutorial, 로그인 후 첫 화면). US-024·025, FLOW-006-S1·S1a·S1b·S2, AC-049·050·067·093·094, UXD-058·062·063·066·068
// - 맨 위 공통 안내 '처음이라면 입문자부터'(개인별 추천 없음, C-22·23) → 난이도 섹션(입문자·왕초보) 머리에 '튜토리얼 난이도 · 입문자'와 'n/3 통과'
//   → 스테이지 카드(CMP-047: 통과·최고 점수 n/5, 모두 열림) → 맨 아래 접힌 '준비 중'(초보, D조 이상, 누를 수 없음)
// - ST2 스켈레톤 / ST3 기록 없음: 모두 '-'·0/3(별도 빈 화면 없음) / ST4 진행 기록 실패: 카드는 보이고 진행 자리에 "진행 기록을 불러오지 못했습니다 · 다시 시도"
// - 튜토리얼 난이도는 회원 급수와 별개(AC-093). 본인 진행만(AC-067)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; progress: ProgressMap }

export function TutorialHomePage() {
  const data = useRouteLoaderData('member') as ShellData | undefined
  const meId = data?.me.id ?? null
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    if (!meId) return
    setLoad({ kind: 'loading' })
    try {
      setLoad({ kind: 'ok', progress: await getMyTutorialProgress(meId) })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [meId])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const available = LEVELS.filter((l) => l.available)
  const comingSoon = LEVELS.filter((l) => !l.available)
  const progress = load.kind === 'ok' ? load.progress : null
  const anyRecord = progress ? Object.keys(progress).length > 0 : false
  const st = load.kind === 'loading' ? 'SCR-101-ST2' : load.kind === 'error' ? 'SCR-101-ST4' : anyRecord ? 'SCR-101-ST1' : 'SCR-101-ST3'

  return (
    <section data-scr="SCR-101" data-st={st} className="flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader title="튜토리얼" />
      <div className="flex flex-col gap-5 px-4 pb-6">
        <NoticeBox tone="info">처음이라면 입문자부터</NoticeBox>
        {load.kind === 'loading' ? (
          <StateView kind="loading" rows={4} label="튜토리얼을 불러오는 중" />
        ) : (
          <>
            {load.kind === 'error' && (
              <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => void refresh()}>다시 시도</Button>}>
                진행 기록을 불러오지 못했습니다
              </NoticeBox>
            )}
            {available.map((level) => {
              const stages = stagesOf(level.id)
              const passed = progress ? stages.filter((s) => progress[s.id]?.passed).length : null
              return (
                <section key={level.id} aria-labelledby={`level-${level.id}`} data-level={level.id} className="flex flex-col gap-2">
                  <header className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                    <h2 id={`level-${level.id}`} className="m-0 text-body font-bold text-ink">
                      <span className="font-normal text-ink-muted">튜토리얼 난이도 · </span>
                      {level.name}
                    </h2>
                    {passed !== null && (
                      <span className="text-body font-bold tabular-nums text-ink" aria-label={`${stages.length}개 중 ${passed}개 통과`}>
                        {passed}/{stages.length} 통과
                      </span>
                    )}
                  </header>
                  <ul className="m-0 flex flex-col gap-2 p-0" aria-label={`${level.name} 스테이지`}>
                    {stages.map((s) => {
                      const rec = progress?.[s.id]
                      return (
                        <StageCard
                          key={s.id}
                          to={`/tutorial/stages/${s.id}`}
                          no={s.no}
                          title={s.title}
                          total={s.situations.length}
                          status={rec ? (rec.passed ? 'passed' : 'failed') : 'notPlayed'}
                          best={rec ? rec.best : null}
                          progressUnknown={progress === null}
                        />
                      )
                    })}
                  </ul>
                </section>
              )
            })}
            <details data-cmp="CMP-047" data-status="comingSoon" className="rounded-md border border-line px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-body font-bold text-ink-muted">준비 중 ({comingSoon.map((l) => l.name).join(', ')})</summary>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 pb-2">
                {comingSoon.map((l) => (
                  <li key={l.id} className="text-body text-ink-muted">
                    튜토리얼 난이도 · {l.name} — 준비 중입니다
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </section>
  )
}
