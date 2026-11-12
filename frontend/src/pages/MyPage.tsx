import { CircleHelp, LogOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRevalidator, useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { Sheet } from '../components/Sheet'
import { useSheetRoute } from '../components/sheetHooks'
import { StateView } from '../components/StateView'
import { logout } from '../features/auth/api'
import { getMyProfile, getMyRecord, type MyRecord, type Profile } from '../features/me/api'
import { ProfileSheet } from '../features/me/ProfileSheet'
import { RANK_MIN_GAMES } from '../features/me/rank'
import type { ShellData } from '../routes/guards'

// SCR-121 마이페이지(/me). US-019·016·025, FLOW-007-S1·S1a, AC-005·017·045·046·053·055·067, UXD-054·056·057
// - 순서: 랭크 카드(CMP-045 self: 등급 글자·승률 / '랭크 없음 · 랭크까지 n경기', '?' → 랭크 기준 시트) → 청백전 전적(경기·승·패·승률, '청백전 기록 보기' → SCR-111)
//   → 프로필(이름 · 성별 · '급수 B조', '프로필 수정' → SCR-122 시트) → 로그아웃(확인 없이 → SCR-001)
// - 1–10 점수·튜토리얼 권장 여부는 없음(AC-017·066). 튜토리얼 진행은 튜토리얼 홈(B6)
// - ST2 로딩 스켈레톤 / ST3 기록 없음 "청백전 기록이 없습니다" + '랭크까지 10경기' / ST4 블록 오류 + 다시 시도(로그아웃은 항상) / ST7 랭크 없음
// - 로그아웃: 기존 logout()(Mock: Mock 세션 해제 / api: POST /api/auth/logout). 성공 → /login 으로 기록 교체, 실패 → 안내(성공처럼 처리하지 않음)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; profile: Profile; record: MyRecord }

const percent = (rate: number | null) => (rate === null ? '-' : `${Math.round(rate * 100)}%`)

export function MyPage() {
  const data = useRouteLoaderData('member') as ShellData | undefined
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const { sheet, open, close } = useSheetRoute()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [leaving, setLeaving] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const prevSheet = useRef<string | null>(null)
  const meId = data?.me.id ?? null

  const refresh = useCallback(async () => {
    if (!meId) return
    setLoad({ kind: 'loading' })
    try {
      const [profile, record] = await Promise.all([getMyProfile(), getMyRecord(meId)])
      setLoad({ kind: 'ok', profile, record })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [meId])
  useEffect(() => {
    void refresh()
  }, [refresh])

  // 시트가 닫히면 '프로필 수정' 버튼으로 포커스 복귀(02 SCR-122)
  useEffect(() => {
    if (prevSheet.current === 'profile' && sheet === null) editRef.current?.focus()
    prevSheet.current = sheet
  }, [sheet])

  const signOut = async () => {
    setLeaving(true)
    setLogoutFailed(false)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutFailed(true)
      setLeaving(false)
    }
  }

  const st = load.kind === 'loading' ? 'SCR-121-ST2' : load.kind === 'error' ? 'SCR-121-ST4' : load.record.games === 0 ? 'SCR-121-ST3' : load.record.rank === null ? 'SCR-121-ST7' : 'SCR-121-ST1'
  return (
    <section data-scr="SCR-121" data-st={st} className="flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader title="마이페이지" />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {logoutFailed && <NoticeBox tone="danger">로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요</NoticeBox>}
        {load.kind === 'loading' && <StateView kind="loading" rows={3} label="마이페이지를 불러오는 중" />}
        {load.kind === 'error' && <StateView kind="error" title="정보를 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />}
        {load.kind === 'ok' && (
          <>
            {/* 랭크 카드(CMP-045 audience=self) */}
            <section data-cmp="CMP-045" data-audience="self" aria-labelledby="rank-title" className="flex items-center gap-4 rounded-md border border-line bg-surface px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 id="rank-title" className="m-0 text-caption font-bold text-ink-muted">
                  랭크
                </h2>
                {load.record.rank ? (
                  <>
                    <p className="m-0 text-display font-bold text-action" aria-label={`랭크 ${load.record.rank}`}>
                      {load.record.rank}
                    </p>
                    <p className="m-0 text-body text-ink">승률 {percent(load.record.rate)}</p>
                  </>
                ) : (
                  <p className="m-0 py-1 text-title font-bold text-ink">
                    랭크 없음 <span className="text-body font-normal text-ink-muted">· 랭크까지 {load.record.gamesToRank ?? RANK_MIN_GAMES}경기</span>
                  </p>
                )}
              </div>
              <Button variant="text" size="md" aria-label="랭크 기준 보기" onClick={() => open('rank-help')}>
                <CircleHelp aria-hidden />
              </Button>
            </section>

            {/* 청백전 전적(누적, 개인전·팀전 합산) */}
            <section aria-labelledby="record-title" className="flex flex-col gap-1">
              <h2 id="record-title" className="m-0 text-body font-bold text-ink">
                청백전 전적
              </h2>
              {load.record.games === 0 ? (
                <p className="m-0 text-body text-ink-muted">청백전 기록이 없습니다</p>
              ) : (
                <p className="m-0 text-body tabular-nums text-ink">
                  <span className="font-bold">{load.record.games}경기</span> {load.record.wins}승 {load.record.losses}패 · 승률 {percent(load.record.rate)}
                </p>
              )}
              <Link to="/club-matches" className="flex h-11 items-center self-start text-body font-bold text-action no-underline">
                청백전 기록 보기 ›
              </Link>
            </section>

            {/* 프로필(1–10 점수 없음) */}
            <section aria-labelledby="profile-title" className="flex flex-col gap-2">
              <h2 id="profile-title" className="m-0 text-body font-bold text-ink">
                프로필
              </h2>
              <p className="m-0 text-body text-ink">
                <span className="font-bold">{load.profile.name}</span> · {load.profile.gender} · 급수 {load.profile.grade}
              </p>
              <Button ref={editRef} variant="secondary" size="md" className="self-start" onClick={() => open('profile')}>
                프로필 수정
              </Button>
            </section>
          </>
        )}
        {/* 로그아웃: 항상 맨 아래(ST4에서도 표시) */}
        <ul aria-label="계정" className="m-0 mt-2 list-none border-t border-line p-0">
          <li>
            <button
              type="button"
              data-cmp="CMP-030"
              onClick={() => void signOut()}
              disabled={leaving}
              aria-busy={leaving || undefined}
              className="flex h-12 w-full items-center gap-2 border-b border-line pr-3 pl-4 text-left text-body text-ink active:bg-surface disabled:text-ink-disabled lg:hover:bg-surface"
            >
              <LogOut aria-hidden className="size-5 shrink-0 text-ink-muted" />
              <span className="flex-1">{leaving ? '로그아웃하는 중' : '로그아웃'}</span>
            </button>
          </li>
        </ul>
      </div>

      {sheet === 'rank-help' && (
        <Sheet open title="랭크 기준" onRequestClose={close} testId="rank-help-sheet">
          <div className="flex flex-col gap-3 pb-2 text-body text-ink">
            <p className="m-0">청백전을 {RANK_MIN_GAMES}경기 이상 하면 승률에 따라 랭크가 매겨집니다.</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="font-bold">S</dt>
              <dd className="m-0">승률 70% 이상</dd>
              <dt className="font-bold">A</dt>
              <dd className="m-0">승률 55% 이상</dd>
              <dt className="font-bold">B</dt>
              <dd className="m-0">승률 40% 이상</dd>
              <dt className="font-bold">C</dt>
              <dd className="m-0">승률 40% 미만</dd>
            </dl>
            <p className="m-0 text-ink-muted">개인전·팀전 모든 청백전 경기의 승패가 반영됩니다(전체 누적).</p>
          </div>
        </Sheet>
      )}
      {sheet === 'profile' && load.kind === 'ok' && (
        <ProfileSheet
          profile={load.profile}
          onClose={close}
          onSaved={(profile) => {
            setLoad((l) => (l.kind === 'ok' ? { ...l, profile } : l))
            revalidator.revalidate() // 셸의 내 이름도 최신으로
          }}
        />
      )}
    </section>
  )
}
