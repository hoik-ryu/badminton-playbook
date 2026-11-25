import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'

import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { Sheet } from '../../components/Sheet'
import { useSheetRoute } from '../../components/sheetHooks'
import { StateView } from '../../components/StateView'
import { useToast } from '../../components/toastContext'
import { isApiError } from '../../lib/api'
import { CLUB_ERRORS, finishClub, getClubMatchView, recordResult, type ClubMatchView, type ClubRun, type Person } from './api'
import { ClubSwapSheet } from './ClubSwapSheet'
import { isMalformedMatchId } from './detailErrors'
import { ParticipantsPanel } from './ParticipantsPanel'
import { SubstituteSheet } from './SubstituteSheet'
import { ClubMatchScope } from './ui/ClubMatchBadge'
import { CmActionButton, CmOpsGameCard, CmRanking, CmSection, CmTeamWins } from './ui/DetailCards'

// 청백전 운영 기능(운영진·슈퍼 관리자만) — 통합 상세 SCR-112(/club-matches/:matchId, UX Spec r6 UXD-085)의 운영 기능 영역(ST13·ST14).
// (B12, UX Spec r9) 확정 전 단계(ST9–ST12: 방식·참가자·대진 설정·생성·다시 생성·확정)는 생성 페이지(SCR-241–245)로 옮겨 지웠습니다.
//   준비 중 청백전을 운영진이 열면 생성 페이지로 보냅니다(UXD-085 r8·UXD-099). 여기는 확정 이후(결과·되돌리기·종료·교체·중도 귀가)만 합니다.
// 이전 SCR-223 운영 상세(/ops/club-matches/:matchId)의 상태·행동·시트·확인 창을 옮겼고, 그 주소는 운영진에게 이 화면으로 리다이렉트됩니다(4단계).
// (5-B2) 이전 SCR-223 배치(variant='legacy', ClubGameCard·StandingsCard)는 쓰는 곳이 없어 지웠습니다.
// 머리글·공개 영역은 화면이 그림(renderPublic: 운영 응답 하나로 공개 영역을 그려 요청 중복·데이터 불일치가 없게 함)
// 요청·응답 계약, 서버 권한 검사(AdminUser), 문구·확인 창은 바꾸지 않았습니다.
// 추적: US-014·015·016·022, FLOW-005, AC-044·047·065·070·073–077·080–082·084·085, UXD-003·006·010·032·034·036·037·042·070–072
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'notFound' } | { kind: 'forbidden' } | { kind: 'ok'; view: ClubMatchView }
type Ask = { kind: 'finish' } | { kind: 'result'; no: number; winner: 1 | 2 } | { kind: 'revert'; no: number } | null
// 안내 상자에 서버 문구를 그대로 보여 주는 오류(그 밖은 화면별 기본 문구)
const SHOWN = new Set<string>([CLUB_ERRORS.notRecorded, CLUB_ERRORS.locked, CLUB_ERRORS.notEligible, CLUB_ERRORS.sameMatchup])

type Props = {
  matchId: string
  /** 머리글(최신 운영 응답 기준) */
  header?: (view: ClubMatchView | null) => ReactNode
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
  const toast = useToast()
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

  const fail = (e: unknown, fallback: string) => {
    if (isApiError(e) && e.code === CLUB_ERRORS.conflict) setConflict(true)
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
  const excludeKey = sheet?.startsWith('participants/exclude:') ? sheet.slice('participants/exclude:'.length) : null
  const swap = sheet?.startsWith('swap:') ? { no: Number(sheet.split(':')[1]), key: sheet.split(':').slice(2).join(':') } : null // 'swap:<경기>:<사람 키>'
  const swapGame = swap && view ? view.games.find((g) => g.no === swap.no) : undefined
  const swapTarget: Person | null = swap && swapGame ? [...swapGame.team1, ...swapGame.team2].find((p) => p.key === swap.key) ?? null : null
  const openParticipants = () => open('participants')
  const panel = view && <ParticipantsPanel key={`${view.id}:${view.method}`} view={view} onExclude={(key) => open(`participants/exclude:${key}`, { stack: true })} />

  // (UX Spec r9, UXD-085 r8·UXD-099) 운영진이 준비 중 청백전을 열면 이 화면 대신 생성 페이지(저장된 데이터로 계산한 단계, AC-131)
  if (view?.status === 'draft') return <Navigate to={`/club-matches/${encodeURIComponent(view.id)}/setup`} replace />
  const stUnified = load.kind === 'loading' ? 'SCR-112-ST2' : load.kind === 'notFound' || load.kind === 'forbidden' ? 'SCR-112-ST5' : conflict ? 'SCR-112-ST6' : notice ? 'SCR-112-ST4' : !view ? 'SCR-112-ST4' : view.status === 'finished' ? 'SCR-112-ST14' : 'SCR-112-ST13'

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
          <span className="tabular-nums">{view.method === 'team' ? `참가자 ${view.summary.count}명 · 청 ${view.summary.blue.n} 백 ${view.summary.white.n}` : `참가자 ${view.summary.count}명`}</span>
          <ChevronRight aria-hidden className="size-5 text-ink-muted" />
        </button>
        <p className="m-0 text-body tabular-nums text-ink-muted" data-testid="ops-settings">
          {settingsLine}
        </p>
      </CmSection>

      {view.status === 'confirmed' && (
        <CmSection title="결과 요약">
          {view.method === 'team' ? <CmTeamWins blue={view.team.blue} white={view.team.white} unrecorded={view.unrecorded} /> : <CmRanking view={view} />}
        </CmSection>
      )}

      {hasGames && (
        <CmSection title={`경기 1–${view.games.length}`}>
          <div className="flex flex-col gap-3" data-testid="cards">
            {view.games.map((g) => (
              <CmOpsGameCard
                key={g.no}
                game={g}
                method={view.method}
                showResult
                busy={busy}
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
      {view.status === 'confirmed' && (
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
      {header?.(view)}
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
