import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { OverflowMenu } from '../../components/OverflowMenu'
import { RoundProgressCard } from '../../components/RoundProgressCard'
import { RoundSection } from '../../components/RoundSection'
import { Sheet } from '../../components/Sheet'
import { useSheetRoute } from '../../components/sheetHooks'
import { StateView } from '../../components/StateView'
import { useToast } from '../../components/toastContext'
import { isApiError } from '../../lib/api'
import { canDeleteClubMatch, CLUB_ERRORS, deleteClubMatch, finishClub, getClubMatchView, nextRound, recordResult, undoRound, type ClubMatchView, type ClubRun, type GameView, type Person } from './api'
import { ClubSwapSheet } from './ClubSwapSheet'
import { isMalformedMatchId } from './detailErrors'
import { deleteTitle, formatMatchDate, todayKst } from './display'
import { ParticipantsPanel } from './ParticipantsPanel'
import { SubstituteSheet } from './SubstituteSheet'
import { ClubMatchScope } from './ui/ClubMatchBadge'
import { CmActionButton, CmBadge, CmOpsGameCard, CmRanking, CmSection, CmTeamWins } from './ui/DetailCards'

// 청백전 운영 기능(운영진·슈퍼 관리자만) — 통합 상세 SCR-112(/club-matches/:matchId, UX Spec r6 UXD-085)의 운영 기능 영역(ST13·ST14).
// (B12, UX Spec r9) 확정 전 단계(ST9–ST12: 방식·참가자·대진 설정·생성·다시 생성·확정)는 생성 페이지(SCR-241–245)로 옮겨 지웠습니다.
//   준비 중 청백전을 운영진이 열면 생성 페이지로 보냅니다(UXD-085 r8·UXD-099). 여기는 확정 이후(결과·되돌리기·종료·교체·중도 귀가)만 합니다.
// 이전 SCR-223 운영 상세(/ops/club-matches/:matchId)의 상태·행동·시트·확인 창을 옮겼고, 그 주소는 운영진에게 이 화면으로 리다이렉트됩니다(4단계).
// (5-B2) 이전 SCR-223 배치(variant='legacy', ClubGameCard·StandingsCard)는 쓰는 곳이 없어 지웠습니다.
// 머리글·공개 영역은 화면이 그림(renderPublic: 운영 응답 하나로 공개 영역을 그려 요청 중복·데이터 불일치가 없게 함)
// 요청·응답 계약, 서버 권한 검사(AdminUser), 문구·확인 창은 바꾸지 않았습니다.
// 추적: US-014·015·016·022, FLOW-005, AC-044·047·065·070·073–077·080–082·084·085, UXD-003·006·010·032·034·036·037·042·070–072
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'notFound' } | { kind: 'forbidden' } | { kind: 'ok'; view: ClubMatchView }
type Ask = { kind: 'finish' } | { kind: 'result'; no: number; winner: 1 | 2 } | { kind: 'revert'; no: number } | { kind: 'undoRound' } | { kind: 'delete' } | null
// 안내 상자에 서버 문구를 그대로 보여 주는 오류(그 밖은 화면별 기본 문구)
// (B17, C-37) 라운드 진행 거부: 시작 전 결과(ST20)·처리되지 않은 경기·시작 취소 불가(ST19)·취소된 경기·라운드 범위
const SHOWN = new Set<string>([
  CLUB_ERRORS.notRecorded,
  CLUB_ERRORS.locked,
  CLUB_ERRORS.notEligible,
  CLUB_ERRORS.sameMatchup,
  CLUB_ERRORS.roundNotStarted,
  CLUB_ERRORS.matchNotStarted,
  CLUB_ERRORS.roundIncomplete,
  CLUB_ERRORS.roundHasResults,
  CLUB_ERRORS.gameCancelled,
  CLUB_ERRORS.invalidRound,
])

// (B17) 라운드 기반 청백전(courtCount 있음)의 진행 계산 — UX Spec r11 SCR-112 ST16–ST23, AC-154–157·161
/** 처리된 경기 = 결과 기록 또는 취소(C-37) */
const processed = (g: GameView) => g.winner !== null || g.cancelled !== null
function roundStateOf(view: ClubMatchView) {
  const current = view.currentRound ?? 1
  const last = Math.max(1, ...view.games.map((g) => g.round ?? 1))
  const cur = view.games.filter((g) => g.round === current)
  const done = cur.filter(processed).length
  const cancelled = cur.filter((g) => g.cancelled).length
  const left = cur.length - done
  const canUndo = current >= 2 && cur.every((g) => !processed(g))
  const unprocessed = view.games.filter((g) => !processed(g)).length
  const endReason = current < last ? '마지막 라운드를 시작해야 종료할 수 있습니다' : unprocessed ? `처리되지 않은 경기 ${unprocessed}개` : null
  return { current, last, cur, done, cancelled, left, canUndo, endReason }
}
const roundsOf = (games: GameView[]) => [...new Set(games.map((g) => g.round ?? 1))].sort((a, b) => a - b).map((r) => ({ round: r, games: games.filter((g) => (g.round ?? 1) === r).sort((a, b) => (a.court ?? 0) - (b.court ?? 0)) }))

type Props = {
  matchId: string
  /** 머리글(최신 운영 응답 기준). (CP-001) menu: 진행 예정이면 '청백전 삭제' 더보기 메뉴(UXD-114) */
  header?: (view: ClubMatchView | null, menu?: ReactNode) => ReactNode
  /** 공개 영역(확정 후, 운영 기능 영역 위) */
  renderPublic?: (view: ClubMatchView) => ReactNode
}

export function ClubMatchOps({ matchId, header, renderPublic }: Props) {
  const { sheet, open, close } = useSheetRoute()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [ask, setAsk] = useState<Ask>(null)
  const [conflict, setConflict] = useState(false)
  const [subEpoch, setSubEpoch] = useState(0) // 대체 선수 시트 다시 그리기(충돌 뒤)
  const [noticeSt, setNoticeSt] = useState<string | null>(null) // (B17) 안내 상자가 가리키는 상태(ST20·ST21)
  // (B17) 라운드 구역 접기: 기본은 지난 라운드 접힘·진행 중·시작 전 펼침. 직접 접은 값은 진행 라운드가 바뀌면 처음으로
  const [folds, setFolds] = useState<{ cur: number | null; map: Map<number, boolean> }>({ cur: null, map: new Map() })
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  // 변경 요청은 한 줄로 차례대로(직전 응답의 version 사용): 같은 화면의 연속 조작은 서로 충돌하지 않고,
  // 다른 운영진이 그사이 바꿨을 때만 409 conflict(C-19·U9)
  const versionRef = useRef<number | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const apply = useCallback((v: ClubMatchView) => {
    versionRef.current = v.version
    setLoad({ kind: 'ok', view: v })
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
    } catch (e) {
      // 없는 청백전(404)·주소 식별자 형식 오류(422, D-2)·권한 없음(403)을 구분(서버가 판단)
      if ((isApiError(e) && e.status === 404) || isMalformedMatchId(e)) setLoad({ kind: 'notFound' })
      else if (isApiError(e) && e.status === 403) setLoad({ kind: 'forbidden' })
      else setLoad({ kind: 'error' })
    }
  }, [matchId, apply])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const view = load.kind === 'ok' ? load.view : null
  const hasGames = (view?.games.length ?? 0) > 0
  // (2026-11-27) 진행 예정(날짜가 오늘(KST)보다 뒤)에는 결과를 기록하지 않음: 결과 버튼 자리에 '시작 전' + 안내
  const beforeDay = !!view && view.status === 'confirmed' && view.date > todayKst()

  const fail = (e: unknown, fallback: string) => {
    setNoticeSt(null)
    if (isApiError(e) && e.code === CLUB_ERRORS.conflict) setConflict(true)
    else if (isApiError(e) && e.code === CLUB_ERRORS.roundLocked) {
      // (B17, ST21·AC-157) 지난 라운드 결과 되돌리기 거부. 진행 라운드에 결과·취소가 없으면 시작 취소 뒤에 되돌릴 수 있음을 함께 알림
      const rs = view && roundStateOf(view)
      setNotice(`지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다${rs?.canUndo ? ". '라운드 시작 취소' 뒤에 되돌릴 수 있습니다" : ''}`)
      setNoticeSt('SCR-112-ST21')
    } else if (isApiError(e) && SHOWN.has(e.code)) {
      setNotice(e.message)
      if (e.code === CLUB_ERRORS.roundNotStarted) setNoticeSt('SCR-112-ST20')
    } else setNotice(fallback)
    void refresh() // 실패하면 최신 상태(version)를 다시 받음
  }
  /** 저장 요청 공통: 성공하면 최신 응답(실패면 null) */
  const actView = async (work: (version: number) => Promise<ClubMatchView>, fallback: string, done?: string | ((v: ClubMatchView) => string)): Promise<ClubMatchView | null> => {
    setBusy(true)
    setNotice(null)
    try {
      const v = await run(work) // 응답(최신 상세)으로 바로 갱신: 다시 조회하지 않음
      if (done) toast(typeof done === 'function' ? done(v) : done)
      return v
    } catch (e) {
      fail(e, fallback)
      return null
    } finally {
      setBusy(false)
    }
  }
  const act = async (work: (version: number) => Promise<ClubMatchView>, fallback: string, done?: string) => {
    await actView(work, fallback, done)
  }
  const onResult = (no: number, winner: 1 | 2) => {
    const g = view?.games.find((x) => x.no === no)
    if (!view || !g || g.winner === winner) return
    // 처음 기록은 바로 저장, 기록된 결과를 바꿀 때만 확인 창(UXD-032·036)
    if (g.winner === null) void act((v) => recordResult(view.id, v, no, winner), '결과를 저장하지 못했습니다')
    else setAsk({ kind: 'result', no, winner })
  }
  const scrollToFirstUnrecorded = () => document.querySelector('[data-cmp=CMP-041][data-recorded=false]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // ── (B17) 라운드 진행 ──
  const isRound = !!view && view.courtCount != null && view.currentRound != null && view.status !== 'draft'
  const rs = isRound && view ? roundStateOf(view) : null
  const isFolded = (r: number) => {
    if (!rs || view?.status !== 'confirmed') return false
    const map = folds.cur === rs.current ? folds.map : new Map<number, boolean>()
    return map.get(r) ?? r < rs.current
  }
  const toggleFold = (r: number) => {
    if (!rs) return
    const map = new Map(folds.cur === rs.current ? folds.map : [])
    map.set(r, !isFolded(r))
    setFolds({ cur: rs.current, map })
  }
  const scrollToRound = (r: number, smooth = true) => document.getElementById(`live-r${r}`)?.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  const startNext = async () => {
    if (!view || !rs) return
    const v = await actView((ver) => nextRound(view.id, ver), '다음 라운드를 시작하지 못했습니다', (x) => `${x.currentRound}라운드를 시작했습니다`)
    if (v?.currentRound) setTimeout(() => scrollToRound(v.currentRound!), 50)
  }
  const jumpToUnprocessed = () => {
    const g = rs?.cur.find((x) => !processed(x))
    if (g) document.getElementById(`live-g${g.no}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }
  // 확정 직후(생성 페이지에서 옴) 토스트 '1라운드를 시작했습니다'(ST16, AC-154). 한 번만: 이동 상태를 지움
  const confirmedNow = (location.state as { confirmed?: boolean } | null)?.confirmed === true
  useEffect(() => {
    if (!confirmedNow || !view) return
    if (view.courtCount != null && view.currentRound != null) toast(`${view.currentRound}라운드를 시작했습니다`)
    void navigate(location.pathname + location.search, { replace: true, state: null })
  }, [confirmedNow, view, toast, navigate, location.pathname, location.search])
  // 열면 진행 중 구역으로 스크롤(UXD-111, 2라운드 이상)
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current || !view || view.status !== 'confirmed' || view.courtCount == null || (view.currentRound ?? 1) < 2) return
    scrolled.current = true
    document.getElementById(`live-r${view.currentRound}`)?.scrollIntoView?.({ block: 'start' })
  }, [view])

  // ── 시트 ──
  const participantsSheet = !!sheet?.startsWith('participants')
  const excludeKey = sheet?.startsWith('participants/exclude:') ? sheet.slice('participants/exclude:'.length) : null
  const swap = sheet?.startsWith('swap:') ? { no: Number(sheet.split(':')[1]), key: sheet.split(':').slice(2).join(':') } : null // 'swap:<경기>:<사람 키>'
  const swapGame = swap && view ? view.games.find((g) => g.no === swap.no) : undefined
  const swapTarget: Person | null = swap && swapGame ? [...swapGame.team1, ...swapGame.team2].find((p) => p.key === swap.key) ?? null : null
  const openParticipants = () => open('participants')
  const panel = view && <ParticipantsPanel key={`${view.id}:${view.method}`} view={view} onExclude={(key) => open(`participants/exclude:${key}`, { stack: true })} />

  // (UX Spec r9, UXD-085 r8·UXD-099) 운영진이 준비 중 청백전을 열면 이 화면 대신 생성 페이지(저장된 데이터로 계산한 단계, AC-131)
  if (view?.status === 'draft') return <Navigate to={`/club-matches/${encodeURIComponent(view.id)}/setup`} replace />
  // (B17) 라운드 기반: ST19 시작 취소 확인 · ST20/21 거부 안내 · ST23 마지막 라운드 종료 조건 · ST18 처리 남음 · ST17 시작 가능 · ST16 기본. 라운드 정보 없는 청백전은 기존 ST13·ST14(ST24)
  const roundSt = rs && view?.status === 'confirmed' ? (ask?.kind === 'undoRound' ? 'SCR-112-ST19' : rs.current >= rs.last ? (rs.endReason ? 'SCR-112-ST23' : 'SCR-112-ST16') : rs.left > 0 ? 'SCR-112-ST18' : 'SCR-112-ST17') : null
  const stUnified = load.kind === 'loading' ? 'SCR-112-ST2' : load.kind === 'notFound' || load.kind === 'forbidden' ? 'SCR-112-ST5' : conflict ? 'SCR-112-ST6' : ask?.kind === 'delete' ? 'SCR-112-ST25' : notice ? (noticeSt ?? 'SCR-112-ST4') : !view ? 'SCR-112-ST4' : view.status === 'finished' ? 'SCR-112-ST14' : roundSt ?? 'SCR-112-ST13'

  // ── (CP-001, AC-166·UXD-114) 진행 예정 청백전 삭제: 머리글 더보기 메뉴 → 이름 있는 확인 창(ST25) → 목록 + 토스트. 실패는 화면 유지 + 안내(ST4), 충돌 ST6 ──
  const deleteMenu = view && canDeleteClubMatch(view) ? <OverflowMenu items={[{ label: '청백전 삭제', tone: 'danger', onSelect: () => setAsk({ kind: 'delete' }) }]} /> : undefined
  const removeMatch = async () => {
    if (!view) return
    setBusy(true)
    setNotice(null)
    setNoticeSt(null)
    try {
      await deleteClubMatch(view.id, versionRef.current ?? view.version)
      toast('청백전을 삭제했습니다')
      void navigate('/club-matches', { replace: true })
    } catch (e) {
      if (isApiError(e) && e.status === 404) void navigate('/club-matches', { replace: true }) // 이미 삭제됨(재시도)
      else if (isApiError(e) && e.code === CLUB_ERRORS.conflict) {
        setConflict(true)
        void refresh()
      } else {
        setNotice(isApiError(e) && e.code === CLUB_ERRORS.locked ? e.message : '청백전을 삭제하지 못했습니다. 다시 시도해 주세요')
        void refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const notices = notice && <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => setNotice(null)}>닫기</Button>}>{notice}</NoticeBox>
  // (3.5단계) 통합 상세 운영 기능 영역 — Preview r5 ClubMatchOps 배치: [운영 표시 줄·참가자·대진 설정 요약] → (ST13) 결과 요약 → 경기 1–n.
  // 기능·문구·확인 창·요청은 이전 SCR-223과 같고 표현만 Preview r5(ui/DetailCards)를 따릅니다. 최종 결과 카드는 공개 영역이 보여 줌
  const onOff = (on: boolean) => (on ? '켜짐' : '꺼짐')
  const settingsLine = view ? `대진 설정 · 총 ${view.totalGames}경기 · 밸런스 ${onOff(view.rules.balance)} · 성별 조합 ${onOff(view.rules.gender)}` : ''
  const opsUnified = view && (
    <section aria-labelledby="ops-h" data-testid="ops-area" data-st={stUnified} className="flex flex-col gap-6 border-t-8 border-surface pt-4">
      <CmSection>
        <h2 id="ops-h" className="m-0 flex items-center gap-2 text-title font-bold text-ink">
          운영
          <span className="text-body font-normal text-ink-muted" data-testid="ops-visibility">
            · 회원 공개됨
          </span>
        </h2>
        {notices}
        <button type="button" data-testid="open-participants" onClick={openParticipants} className="flex h-11 items-center justify-between rounded-md border border-line-strong bg-page px-3 text-body text-ink">
          <span className="tabular-nums">
            {view.method === 'team' ? `참가자 ${view.summary.count}명 · 청 ${view.summary.blue.n} 백 ${view.summary.white.n}` : `참가자 ${view.summary.count}명`}
            {isRound && ` · 코트 ${view.courtCount}`}
          </span>
          <ChevronRight aria-hidden className="size-5 text-ink-muted" />
        </button>
        <p className="m-0 text-body tabular-nums text-ink-muted" data-testid="ops-settings">
          {settingsLine}
        </p>
        {beforeDay && (
          <NoticeBox tone="info">
            {formatMatchDate(view.date)}부터 결과를 기록할 수 있습니다
          </NoticeBox>
        )}
        {rs && view.status === 'confirmed' && (
          <RoundProgressCard round={rs.current} done={rs.done} total={rs.cur.length} cancelled={rs.cancelled} last={rs.current >= rs.last} canUndo={rs.canUndo} busy={busy} onNext={() => void startNext()} onUndo={() => setAsk({ kind: 'undoRound' })} onJump={jumpToUnprocessed} />
        )}
      </CmSection>

      {view.status === 'confirmed' && (
        <CmSection title="결과 요약">
          {view.method === 'team' ? <CmTeamWins blue={view.team.blue} white={view.team.white} unrecorded={view.unrecorded} /> : <CmRanking view={view} />}
        </CmSection>
      )}

      {hasGames && rs && (
        <CmSection title={`경기 1–${view.games.length}`}>
          <div className="flex flex-col gap-3" data-testid="rounds">
            {roundsOf(view.games).map(({ round, games }) => {
              const done = games.filter(processed).length
              const confirmed = view.status === 'confirmed'
              const status = !confirmed || round < rs.current ? <CmBadge tone="neutral">완료</CmBadge> : round === rs.current ? <CmBadge tone="live">진행 중</CmBadge> : <CmBadge tone="pending">시작 전</CmBadge>
              return (
                <div key={round} id={`live-r${round}`} className="scroll-mt-2">
                  <RoundSection id={`lh-${round}`} round={round} phase="live" caption={`처리 ${done}/${games.length}`} status={status} current={confirmed && round === rs.current} folded={isFolded(round)} onFold={() => toggleFold(round)}>
                    <div className="flex flex-col gap-3">
                      {games.map((g) => {
                        const future = confirmed && round > rs.current
                        const cancelled = g.cancelled !== null
                        return (
                          <CmOpsGameCard
                            key={g.no}
                            id={`live-g${g.no}`}
                            game={g}
                            method={view.method}
                            showResult
                            busy={busy}
                            label={
                              <>
                                코트 {g.court}
                                <span className="font-normal text-ink-muted"> · {g.no}경기</span>
                              </>
                            }
                            // 경기 이름은 기존과 같은 'n경기'(라운드·코트는 보이는 제목과 라운드 구역 이름이 알려 줌)
                            ariaLabel={`${g.no}경기${cancelled ? ', 취소됨' : future ? ', 시작 전' : ''}`}
                            locked={future || beforeDay}
                            cancelled={cancelled}
                            onResult={(w) => onResult(g.no, w)}
                            // 미기록으로 되돌리기는 진행 라운드만(지난 라운드는 승패 바꾸기만, AC-157)
                            onRevert={confirmed && round === rs.current && g.winner ? () => setAsk({ kind: 'revert', no: g.no }) : undefined}
                            onPlayer={confirmed && !g.winner && !cancelled ? (p) => open(`swap:${g.no}:${p.key}`) : undefined}
                          />
                        )
                      })}
                    </div>
                  </RoundSection>
                </div>
              )
            })}
          </div>
        </CmSection>
      )}

      {hasGames && !rs && (
        <CmSection title={`경기 1–${view.games.length}`}>
          <div className="flex flex-col gap-3" data-testid="cards">
            {view.games.map((g) => (
              <CmOpsGameCard
                key={g.no}
                game={g}
                method={view.method}
                showResult
                busy={busy}
                locked={beforeDay}
                onResult={(w) => onResult(g.no, w)}
                onRevert={view.status === 'confirmed' && g.winner ? () => setAsk({ kind: 'revert', no: g.no }) : undefined}
                onPlayer={view.status === 'confirmed' && !g.winner ? (p) => open(`swap:${g.no}:${p.key}`) : undefined}
              />
            ))}
          </div>
        </CmSection>
      )}
    </section>
  )
  // 하단 고정 행동 바(Preview ActionBar: 위 테두리, 좌우 space.4·위아래 space.2, 버튼 높이 48·간격 space.3)
  const unifiedBar = view && view.status !== 'finished' && (
    <div className="app-fixed-bar bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 flex gap-3 border-t border-line bg-page px-4 py-2" data-testid="action-bar">
      {view.status === 'confirmed' && rs && (
        // (B17, ST23·AC-161) 마지막 라운드가 진행 중이고 처리되지 않은 경기가 0일 때만 종료.
        // (2026-11-27) 보이는 안내 문구는 없앰(비활성 버튼만, 세로 배치로 버튼이 눌리던 문제 해결). 이유는 화면 읽기용으로만 유지
        <>
          <CmActionButton disabled={busy || !!rs.endReason} onClick={() => setAsk({ kind: 'finish' })} aria-describedby={rs.endReason ? 'end-why' : undefined}>
            청백전 종료
          </CmActionButton>
          {rs.endReason && (
            <span id="end-why" className="sr-only" data-testid="end-why">
              {rs.endReason}
            </span>
          )}
        </>
      )}
      {view.status === 'confirmed' && !rs && (
        <>
          <CmActionButton disabled={busy || view.unrecorded > 0} onClick={() => setAsk({ kind: 'finish' })} aria-describedby={view.unrecorded > 0 ? 'unrecorded-left' : undefined}>
            청백전 종료
          </CmActionButton>
          {view.unrecorded > 0 && (
            // UX Spec r6 02 SCR-112: 비활성 + 'n경기 남음'(누르면 첫 미기록 경기로 스크롤). Preview는 한 버튼에 합쳐 표시 — 명세 동작 유지(보고 대상)
            <button type="button" id="unrecorded-left" onClick={scrollToFirstUnrecorded} className="flex h-12 shrink-0 items-center px-2 text-body font-bold text-ink-accent">
              {view.unrecorded}경기 남음
            </button>
          )}
        </>
      )}
    </div>
  )

  const main = (
    <ClubMatchScope data-scr="SCR-112" data-st={stUnified} data-role="admin" className="cm-page flex w-full max-w-[600px] flex-1 flex-col">
      {header?.(view, deleteMenu)}
      {/* Preview r5 SCR-112: main 섹션 사이 space.6(위 space.2), 각 섹션이 좌우 space.4 */}
      <div className="flex flex-col gap-6 pt-2 pb-6">
        {load.kind === 'loading' && <StateView kind="loading" rows={4} label="청백전을 불러오는 중" className="px-4" />}
        {load.kind === 'error' && <div className="px-4"><StateView kind="error" title="청백전을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} /></div>}
        {(load.kind === 'notFound' || load.kind === 'forbidden') && (
          <div className="px-4">
            <StateView
              kind="notFound"
              title="청백전을 찾을 수 없습니다"
              action={
                <Button asChild variant="secondary" fullWidth>
                  <Link to="/club-matches">청백전 목록으로</Link>
                </Button>
              }
            />
          </div>
        )}
        {view && renderPublic?.(view)}
        {/* 운영 기능 영역: 제목 '운영'을 둔 별도 영역(02 모바일·접근성 메모) */}
        {opsUnified}
        {view && view.status !== 'finished' && <div aria-hidden className="h-20" />}
      </div>
      {unifiedBar}
    </ClubMatchScope>
  )

  return (
    <div className="flex min-w-0">
      {main}
      {participantsSheet && view && (
        <Sheet open title={view.method === 'team' ? '팀 구성' : '참가자'} onRequestClose={close} height="70%" testId="participants-sheet">
          {panel}
        </Sheet>
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
        open={ask?.kind === 'undoRound'}
        onOpenChange={(o) => !o && setAsk(null)}
        title={rs ? `${rs.current}라운드 시작을 취소하고 ${rs.current - 1}라운드로 돌아갈까요?` : ''}
        description={rs ? `${rs.current - 1}라운드 경기를 다시 고치거나 미기록으로 되돌릴 수 있습니다` : undefined}
        confirmLabel="시작 취소"
        onConfirm={() => {
          if (!view || !rs) return
          const cur = rs.current
          void actView((v) => undoRound(view.id, v), '라운드 시작을 취소하지 못했습니다', `${cur}라운드 시작을 취소했습니다`).then((v) => v?.currentRound && setTimeout(() => scrollToRound(v.currentRound!), 50))
        }}
      />
      <ConfirmDialog
        open={ask?.kind === 'delete'}
        onOpenChange={(o) => !o && setAsk(null)}
        tone="danger"
        title={view ? deleteTitle(view.name) : ''}
        // (2026-11-27) 진행 중 삭제 허용: 기록된 결과가 있으면 전적에서도 빠진다는 것을 함께 알림
        description={view?.games.some((g) => g.winner !== null) ? '참가자·대진·기록된 결과가 함께 지워지고 전적에서도 빠집니다. 되돌릴 수 없습니다' : '참가자와 대진도 함께 지워지고 되돌릴 수 없습니다'}
        confirmLabel="삭제"
        onConfirm={() => void removeMatch()}
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
