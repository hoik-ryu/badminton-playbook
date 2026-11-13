import { cn } from 'cn'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/RadioButtons'
import { Sheet } from '../components/Sheet'
import { useSheetRoute } from '../components/sheetHooks'
import { StateView } from '../components/StateView'
import { Switch } from '../components/Switch'
import { TextField } from '../components/TextField'
import { useToast } from '../components/toastContext'
import { isApiError } from '../lib/api'
import { CLUB_ERRORS, confirmClub, finishClub, generateClub, getClubMatchView, METHOD_LABEL, recordResult, setMethod, setSettings, type ClubMatchView, type ClubMethod, type ClubRun, type Person } from '../features/clubmatch/api'
import { ClubGameCard } from '../features/clubmatch/ClubGameCard'
import { ClubSwapSheet } from '../features/clubmatch/ClubSwapSheet'
import { ParticipantsPanel } from '../features/clubmatch/ParticipantsPanel'
import { StandingsCard } from '../features/clubmatch/StandingsCard'
import { SubstituteSheet } from '../features/clubmatch/SubstituteSheet'
import { ScoreEntrySheet } from '../features/roster/ScoreEntrySheet'

// SCR-223 청백전 운영 상세(/ops/club-matches/:matchId). US-014·015·016·022, FLOW-005, AC-044·047·065·070·073–077·080–082·084·085, UXD-003·006·010·032·034·036·037·042·070–072
// 상태: ST3 참가자 없음(패널 자동) → ST1 생성 전 → ST2 생성 중 → ST7 대진 검토 → ST8 확정(회원 공개, 결과 입력) → ST9 종료. ST4 오류, ST6 충돌(C-10·C-19)
// 반응형: 모바일 한 열 + 하단 고정 행동 바, PC 경기 카드 2열 + 오른쪽 옆 패널(참가자·팀 구성) + 위쪽 오른쪽 행동
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; view: ClubMatchView }
type Ask = { kind: 'method'; method: ClubMethod } | { kind: 'confirm' } | { kind: 'finish' } | { kind: 'result'; no: number; winner: 1 | 2 } | { kind: 'revert'; no: number } | null
// 안내 상자에 서버 문구를 그대로 보여 주는 오류(그 밖은 화면별 기본 문구)
const SHOWN = new Set<string>([CLUB_ERRORS.minPlayers, CLUB_ERRORS.notRecorded, CLUB_ERRORS.noGames, CLUB_ERRORS.locked, CLUB_ERRORS.notEligible, CLUB_ERRORS.sameMatchup, CLUB_ERRORS.inGames])
const mmdd = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`
const STATUS: Record<ClubMatchView['status'], string> = { draft: '대진 미확정', confirmed: '확정됨 · 회원 공개', finished: '종료' }

export function ClubMatchPage() {
  const { matchId = '' } = useParams()
  const { sheet, open, close } = useSheetRoute()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [changed, setChanged] = useState<'settings' | 'participants' | null>(null)
  const [ask, setAsk] = useState<Ask>(null)
  const [conflict, setConflict] = useState(false)
  const [gamesInput, setGamesInput] = useState('')
  const [keepInput, setKeepInput] = useState(false)
  const autoOpened = useRef(false)
  const [subEpoch, setSubEpoch] = useState(0) // 대체 선수 시트 다시 그리기(충돌 뒤)
  const toast = useToast()
  // 변경 요청은 한 줄로 차례대로(직전 응답의 version 사용): 같은 화면의 연속 조작은 서로 충돌하지 않고,
  // 다른 운영진이 그사이 바꿨을 때만 409 conflict(C-19·U9)
  const versionRef = useRef<number | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const apply = useCallback((v: ClubMatchView) => {
    versionRef.current = v.version
    setLoad({ kind: 'ok', view: v })
    setGamesInput((cur) => (cur === '' ? String(v.totalGames) : cur))
  }, [])
  const run = useCallback<ClubRun>(
    (work) => {
      const p = queue.current
        .then(() => work(versionRef.current ?? 0))
        .then((v) => {
          apply(v)
          return v
        })
      queue.current = p.catch(() => undefined)
      return p
    },
    [apply],
  )

  const refresh = useCallback(async () => {
    try {
      apply(await getClubMatchView(matchId))
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [matchId, apply])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const view = load.kind === 'ok' ? load.view : null
  const draft = view?.status === 'draft'
  const hasGames = (view?.games.length ?? 0) > 0

  // ST3: 참가자 없음 → 참가자 시트 자동 열림(UXD-038, PC·모바일 공통 하단 시트)
  useEffect(() => {
    if (!view || autoOpened.current || view.status !== 'draft' || view.summary.count > 0) return
    autoOpened.current = true
    if (!sheet) open('participants')
  }, [view, sheet, open])

  const fail = (e: unknown, fallback: string) => {
    if (isApiError(e) && e.code === CLUB_ERRORS.conflict) setConflict(true)
    else if (isApiError(e) && e.code === CLUB_ERRORS.unscored) setNotice(`점수 미설정 ${view?.summary.unscored.length ?? ''}명의 점수를 먼저 매겨 주세요`)
    else if (isApiError(e) && SHOWN.has(e.code)) setNotice(e.message)
    else setNotice(fallback)
    void refresh() // 실패하면 최신 상태(version)를 다시 받음
  }
  const act = async (work: (version: number) => Promise<ClubMatchView>, fallback: string, done?: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await run(work) // 응답(최신 상세)으로 바로 갱신: 다시 조회하지 않음
      if (done) toast(done)
    } catch (e) {
      fail(e, fallback)
    } finally {
      setBusy(false)
    }
  }
  const generate = async () => {
    if (!view) return
    setGenerating(true)
    setChanged(null)
    await act((v) => generateClub(view.id, v), '대진을 만들지 못했습니다. 다시 시도해 주세요')
    setGenerating(false)
  }
  const saveSettings = (patch: Partial<{ totalGames: number; rules: ClubMatchView['rules'] }>) => {
    if (!view) return
    const next = { totalGames: patch.totalGames ?? view.totalGames, rules: patch.rules ?? view.rules }
    if (hasGames) setChanged('settings')
    run((v) => setSettings(view.id, v, next)).catch((e: unknown) => fail(e, '설정을 저장하지 못했습니다'))
  }
  const onGamesInput = (value: string) => {
    setGamesInput(value)
    setKeepInput(false)
    const n = Number(value)
    if (Number.isInteger(n) && n >= 1) saveSettings({ totalGames: n })
  }
  const gamesError = gamesInput !== '' && !(Number.isInteger(Number(gamesInput)) && Number(gamesInput) >= 1) ? '경기 수를 1 이상으로 입력해 주세요' : undefined

  const onResult = (no: number, winner: 1 | 2) => {
    const g = view?.games.find((x) => x.no === no)
    if (!view || !g || g.winner === winner) return
    // 처음 기록은 바로 저장, 기록된 결과를 바꿀 때만 확인 창(UXD-032·036)
    if (g.winner === null) void act((v) => recordResult(view.id, v, no, winner), '결과를 저장하지 못했습니다')
    else setAsk({ kind: 'result', no, winner })
  }
  const scrollToFirstUnrecorded = () => document.querySelector('[data-cmp=CMP-041][data-recorded=false]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // ── 시트 ──
  const participantsSheet = !!sheet?.startsWith('participants')
  const scoresOpen = sheet === 'scores' || sheet === 'participants/scores'
  const excludeKey = sheet?.startsWith('participants/exclude:') ? sheet.slice('participants/exclude:'.length) : null
  const swap = sheet?.startsWith('swap:') ? { no: Number(sheet.split(':')[1]), key: sheet.split(':').slice(2).join(':') } : null // 'swap:<경기>:<사람 키>'
  const swapGame = swap && view ? view.games.find((g) => g.no === swap.no) : undefined
  const swapTarget: Person | null = swap && swapGame ? [...swapGame.team1, ...swapGame.team2].find((p) => p.key === swap.key) ?? null : null
  const openParticipants = () => open('participants')
  const openScores = () => (sheet?.startsWith('participants') ? open('participants/scores', { stack: true }) : open('scores'))

  const panel = view && (
    <ParticipantsPanel
      key={`${view.id}:${view.method}`}
      view={view}
      run={run}
      onChanged={(what) => {
        if (hasGames && draft && what === 'participants') setChanged('participants')
      }}
      onConflict={() => {
        setConflict(true)
        void refresh()
      }}
      onScores={openScores}
      onExclude={(key) => open(`participants/exclude:${key}`, { stack: true })}
    />
  )

  const st = load.kind === 'loading' || generating ? 'SCR-223-ST2' : conflict ? 'SCR-223-ST6' : notice ? 'SCR-223-ST4' : !view ? 'SCR-223-ST4' : view.status === 'finished' ? 'SCR-223-ST9' : view.status === 'confirmed' ? 'SCR-223-ST8' : view.summary.count === 0 ? 'SCR-223-ST3' : hasGames ? 'SCR-223-ST7' : 'SCR-223-ST1'
  const unscored = view?.summary.unscored.length ?? 0
  const preview = view?.preview
  const previewText = view && preview ? `${view.summary.count}명 · ${view.totalGames}경기 → ${preview.groups.map((g) => `${g.people}명 ${g.games}경기`).join(', ')}` : ''

  const actions = view && (
    <div className="flex w-full flex-wrap items-center gap-2">
      {draft && !hasGames && (
        <Button className="flex-1" disabled={busy || unscored > 0 || view.summary.count === 0} loading={generating} onClick={() => void generate()}>
          대진 생성
        </Button>
      )}
      {draft && hasGames && (
        <>
          <Button variant="secondary" className="flex-1" disabled={busy || unscored > 0} loading={generating} onClick={() => void generate()}>
            다시 생성
          </Button>
          <Button className="flex-1" disabled={busy || generating} onClick={() => setAsk({ kind: 'confirm' })}>
            확정
          </Button>
        </>
      )}
      {view.status === 'confirmed' && (
        <>
          <Button className="flex-1" disabled={busy || view.unrecorded > 0} onClick={() => setAsk({ kind: 'finish' })} aria-describedby={view.unrecorded > 0 ? 'unrecorded-left' : undefined}>
            청백전 종료
          </Button>
          {view.unrecorded > 0 && (
            <Button id="unrecorded-left" variant="text" size="md" onClick={scrollToFirstUnrecorded}>
              {view.unrecorded}경기 남음
            </Button>
          )}
        </>
      )}
    </div>
  )

  const main = (
    <div data-scr="SCR-223" data-st={st} className="flex min-w-0 flex-1 flex-col">
      <PageHeader title={view ? `${view.name} ${mmdd(view.date)}` : '청백전'} leading="back" backTo="/ops/club-matches" badge={view ? <Badge tone={draft ? 'warning' : view.status === 'confirmed' ? 'info' : 'success'}>{STATUS[view.status]}</Badge> : undefined} />
      <div className="flex flex-col gap-3 px-4 pb-4">
        {load.kind === 'loading' && <StateView kind="loading" rows={4} label="청백전을 불러오는 중" />}
        {load.kind === 'error' && <StateView kind="error" title="청백전을 불러오지 못했습니다" description="없는 청백전이거나 네트워크 문제입니다" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />}
        {notice && <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => setNotice(null)}>닫기</Button>}>{notice}</NoticeBox>}
        {view && (
          <>
            {view.status === 'finished' && <StandingsCard view={view} final />}
            {draft && (
              <SegmentedControl
                label="방식"
                options={(['individual', 'team'] as const).map((v) => ({ value: v, label: METHOD_LABEL[v] }))}
                value={view.method}
                onChange={(m) => (m === view.method ? undefined : hasGames ? setAsk({ kind: 'method', method: m }) : void act((v) => setMethod(view.id, v, m), '방식을 바꾸지 못했습니다'))}
              />
            )}
            {!draft && <p className="m-0 text-body text-ink-muted">방식: {METHOD_LABEL[view.method]}</p>}
            <Button variant="secondary" className="self-start" onClick={openParticipants}>
              {view.method === 'team' ? `참가자 ${view.summary.count}명 · 청 ${view.summary.blue.n} 백 ${view.summary.white.n}` : `참가자 ${view.summary.count}명`} ›
            </Button>
            {draft && view.summary.count === 0 && <StateView kind="empty" title="참가자를 먼저 정하세요" />}
            {draft && view.summary.count > 0 && (
              <details open={!hasGames} className="rounded-md border border-line px-4 py-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-body font-bold text-ink">
                  대진 설정{hasGames ? ` · ${view.totalGames}경기 · 밸런스 ${view.rules.balance ? '켬' : '끔'} · 성별 조합 ${view.rules.gender ? '켬' : '끔'}` : ''}
                </summary>
                <div className="flex flex-col gap-3 pb-2">
                  <TextField label="총 경기 수" type="number" inputMode="numeric" min={1} value={gamesInput} onChange={(e) => onGamesInput(e.target.value)} error={gamesError} />
                  <p className="m-0 text-body text-ink" aria-live="polite">{previewText}</p>
                  {!preview?.even && !keepInput && preview?.proposals.length ? (
                    <div className="flex flex-wrap gap-2">
                      {preview.proposals.map((p) => (
                        <Button key={p.totalGames} variant="secondary" size="md" onClick={() => onGamesInput(String(p.totalGames))}>
                          {p.totalGames}경기 · {p.each.blue === p.each.white ? `모두 ${p.each.blue}경기` : `청 ${p.each.blue}경기 · 백 ${p.each.white}경기`}
                        </Button>
                      ))}
                      <Button variant="text" size="md" onClick={() => setKeepInput(true)}>
                        입력값 유지
                      </Button>
                    </div>
                  ) : null}
                  <Switch label="밸런스" checked={view.rules.balance} onCheckedChange={(on) => saveSettings({ rules: { ...view.rules, balance: on } })} />
                  <Switch label="성별 조합" checked={view.rules.gender} onCheckedChange={(on) => saveSettings({ rules: { ...view.rules, gender: on } })} />
                </div>
              </details>
            )}
            {!draft && <p className="m-0 text-body text-ink-muted">대진 설정 · {view.totalGames}경기 · 밸런스 {view.rules.balance ? '켬' : '끔'} · 성별 조합 {view.rules.gender ? '켬' : '끔'}</p>}
            {draft && unscored > 0 && (
              <button type="button" onClick={openScores} className="w-full text-left">
                <NoticeBox tone="warning" action={<span aria-hidden className="text-title text-warning-fg">›</span>}>
                  점수 미설정 {unscored}명의 점수를 먼저 매겨 주세요
                </NoticeBox>
              </button>
            )}
            {changed === 'settings' && draft && hasGames && <NoticeBox tone="info">설정이 바뀌었습니다. 다시 생성하면 반영됩니다</NoticeBox>}
            {changed === 'participants' && draft && hasGames && <NoticeBox tone="info">참가자가 바뀌었습니다. 다시 생성하면 반영됩니다</NoticeBox>}
            {draft && hasGames && !preview?.even && <NoticeBox tone="info">경기 수가 다른 사람이 있어 순위표에 사람별 경기 수를 표시합니다</NoticeBox>}
            {view.status === 'confirmed' && <StandingsCard view={view} />}
            {generating ? (
              <div aria-busy="true" aria-label="대진을 만드는 중" className="grid gap-3">
                {Array.from({ length: Math.min(6, Math.max(2, view.totalGames)) }, (_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
                ))}
              </div>
            ) : (
              hasGames && (
                <section aria-label="경기" className="grid gap-3">
                  {view.games.map((g) => (
                    <ClubGameCard
                      key={g.no}
                      game={g}
                      method={view.method}
                      showResult={!draft}
                      busy={busy}
                      onResult={(w) => onResult(g.no, w)}
                      onRevert={view.status === 'confirmed' && g.winner ? () => setAsk({ kind: 'revert', no: g.no }) : undefined}
                      onPlayer={draft || (view.status === 'confirmed' && !g.winner) ? (p) => open(`swap:${g.no}:${p.key}`) : undefined}
                    />
                  ))}
                </section>
              )
            )}
          </>
        )}
        {view && view.status !== 'finished' && <div aria-hidden className="h-20" />}
      </div>
      {view && view.status !== 'finished' && actions && <div className={cn('app-fixed-bar bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 border-t border-line bg-page px-4 py-3')}>{actions}</div>}
    </div>
  )

  return (
    <div className="flex min-w-0">
      {main}
      {participantsSheet && view && (
        <Sheet open title={view.method === 'team' ? '팀 구성' : '참가자'} onRequestClose={close} height="70%" testId="participants-sheet">
          {panel}
        </Sheet>
      )}
      {scoresOpen && view && view.summary.unscored.length > 0 && (
        <ScoreEntrySheet
          // 점수 저장은 명단 setScore(api 모드: PUT /api/roster/{kind}s/{id}/score + 이전 점수, Mock 모드: Mock 저장소). I3-d4
         
          people={view.summary.unscored.flatMap((p) => (p.gender && p.grade ? [{ id: p.id, kind: p.kind, name: p.name, gender: p.gender, grade: p.grade, score: p.score, tutorialRecommendedUnpassed: false }] : []))}
          onClose={close}
          onAllDone={() => {
            close()
            void refresh()
          }}
        />
      )}
      {swap && swapTarget && view && <ClubSwapSheet key={view.version} view={view} gameNo={swap.no} target={swapTarget} onClose={close} onDone={apply} onConflict={() => { setConflict(true); void refresh() }} />}
      {/* key: 충돌(ST6) 뒤 최신 상태를 받은 다음에만 다시 마운트. version으로 두면 반영 직후 새 인스턴스의 이탈 확인이 닫기를 막음 */}
      {excludeKey && view && (
        <SubstituteSheet
          key={`${excludeKey}:${subEpoch}`}
          view={view}
          leaverKey={excludeKey}
          onClose={close}
          onDone={apply}
          onConflict={() => {
            setConflict(true)
            void refresh().then(() => setSubEpoch((n) => n + 1))
          }}
        />
      )}
      <ConfirmDialog
        open={ask?.kind === 'method'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="방식을 바꾸면 만든 대진과 팀 배정이 초기화됩니다"
        description="참가자는 유지됩니다"
        confirmLabel="바꾸기"
        onConfirm={() => (view && ask?.kind === 'method' ? act((v) => setMethod(view.id, v, ask.method), '방식을 바꾸지 못했습니다') : undefined)}
      />
      <ConfirmDialog
        open={ask?.kind === 'confirm'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="대진을 확정하고 회원에게 공개할까요?"
        description="확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다"
        confirmLabel="확정"
        onConfirm={() => (view ? act((v) => confirmClub(view.id, v), '확정하지 못했습니다') : undefined)}
      />
      <ConfirmDialog
        open={ask?.kind === 'finish'}
        onOpenChange={(o) => !o && setAsk(null)}
        title="청백전을 종료할까요?"
        description="종료 후에도 결과는 고칠 수 있습니다"
        confirmLabel="종료"
        onConfirm={() => (view ? act((v) => finishClub(view.id, v), '종료하지 못했습니다') : undefined)}
      />
      <ConfirmDialog
        open={ask?.kind === 'result'}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask?.kind === 'result' && view ? `${ask.no}경기 결과를 '${view.method === 'team' ? (ask.winner === 1 ? '청' : '백') : `${ask.winner}팀`} 승'으로 바꿀까요?` : ''}
        description={view?.status === 'finished' ? '순위·팀 승수·랭크가 다시 계산됩니다' : undefined}
        confirmLabel="바꾸기"
        onConfirm={() => (view && ask?.kind === 'result' ? act((v) => recordResult(view.id, v, ask.no, ask.winner), '결과를 저장하지 못했습니다') : undefined)}
      />
      <ConfirmDialog
        open={ask?.kind === 'revert'}
        onOpenChange={(o) => !o && setAsk(null)}
        title={ask?.kind === 'revert' ? `${ask.no}경기 결과를 미기록으로 되돌릴까요?` : ''}
        description="기록된 결과가 삭제되고 순위·승수가 다시 계산됩니다"
        tone="danger"
        confirmLabel="되돌리기"
        onConfirm={() => (view && ask?.kind === 'revert' ? act((v) => recordResult(view.id, v, ask.no, null), '결과를 되돌리지 못했습니다', '경기 결과가 미기록으로 변경되었습니다.') : undefined)}
      />
      <ConfirmDialog
        open={conflict}
        onOpenChange={(o) => !o && setConflict(false)}
        title="다른 운영진이 청백전을 변경했습니다"
        description="방금 한 작업은 처리되지 않았습니다. 닫으면 최신 상태를 보여 줍니다"
        tone="conflict"
        onConfirm={() => {
          setConflict(false)
          void refresh()
        }}
      />
    </div>
  )
}
