import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toastContext'
import { logout } from '../features/auth/api'
import { getPersona, PERSONA_LABELS, PERSONAS, setPersona, type PersonaKey } from '../features/auth/devPersona'
import { INTRO_SEEN_KEY } from '../features/intro/introPolicy'
import { listUnscored, type RosterPerson } from '../features/roster/api'
import { ScoreEntrySheet } from '../features/roster/ScoreEntrySheet'
import { devCreateStaleSession } from '../features/session/api'
import { NoticeBox } from '../components/NoticeBox'
import { dataSource } from '../lib/data/source'
import { newKakaoId, readDb, resetMockDb, updateDb } from '../lib/mock/db'

// 개발용 도구(/dev, 개발 빌드에서만 라우트 등록). 서비스 화면 아님.
// - Mock 역할 전환(어느 주소에서든 '?as=admin'처럼 붙여도 됨) — Mock 모드에서만. api 모드는 실제 카카오 로그인·서버 세션만 사용
// - Mock 카카오: 새 카카오 계정(미가입 상태로 가입 흐름 시작), 다음 로그인 실패
// - Mock 데이터 초기화, 인트로 다시 보기·최초 방문 기록 지우기
// - SCR-214 점수 입력 시트 확인(실제 부모 화면 SCR-203·224는 B3·B4)
export function DevToolsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [, force] = useState(0)
  const [scorePeople, setScorePeople] = useState<RosterPerson[] | null>(null)
  const db = readDb()
  const current = getPersona()
  const me = db.users.find((u) => u.id === db.session)
  const choose = (key: PersonaKey) => {
    setPersona(key)
    navigate('/')
  }
  const act = (fn: () => void, message: string) => {
    fn()
    toast(message, 'neutral')
    force((n) => n + 1)
  }
  return (
    <section className="flex flex-1 flex-col">
      <PageHeader title="개발 도구" leading="back" backTo="/" />
      <div className="flex flex-col gap-6 px-4 pb-8">
        {dataSource === 'api' ? (
          <div className="flex flex-col gap-3">
            <NoticeBox tone="info">실제 API 모드입니다. 역할 전환·Mock 카카오 로그인은 쓸 수 없고, 실제 카카오 로그인과 서버 권한만 적용됩니다. 아래 Mock 도구는 아직 백엔드가 없는 명단·오늘 운동·청백전에만 영향을 줍니다.</NoticeBox>
            {/* 회원 로그아웃 화면(SCR-121 마이페이지)은 B5. 그 전까지 운영진 로그아웃은 여기서 */}
            <Button variant="secondary" size="md" onClick={() => void logout().then(() => navigate('/login', { replace: true }), () => toast('로그아웃하지 못했습니다', 'neutral'))}>
              로그아웃(서버 세션)
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="mt-2 mb-2 text-body font-bold">역할 전환(Mock)</h2>
            <p className="m-0 mb-3 text-caption text-ink-muted">
              현재: {current ? PERSONA_LABELS[current] : me ? `${me.name}(${me.status})` : '비로그인'}. 고르면 '/'로 이동해 첫 화면 규칙을 다시 적용합니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => (
                <Button key={k} size="md" variant={k === current ? 'primary' : 'secondary'} aria-pressed={k === current} onClick={() => choose(k)}>
                  {PERSONA_LABELS[k]}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div>
          <h2 className="mt-0 mb-2 text-body font-bold">{dataSource === 'api' ? 'Mock 데이터' : 'Mock 카카오 로그인'}</h2>
          {dataSource === 'mock' && (
            <p className="m-0 mb-3 text-caption text-ink-muted">
              이 기기의 가짜 카카오 회원번호: {db.kakaoId}
              {db.failNextKakao && ' · 다음 로그인 실패 예약됨'}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {dataSource === 'mock' && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    act(() => updateDb((d) => {
                      d.kakaoId = newKakaoId()
                      d.session = null
                      d.signupTicket = null
                    }), '새 카카오 계정으로 바꾸고 로그아웃했습니다')
                  }
                >
                  새 카카오 계정(미가입)으로 바꾸기
                </Button>
                <Button variant="secondary" size="md" onClick={() => act(() => updateDb((d) => void (d.failNextKakao = true)), '다음 카카오 로그인이 실패합니다')}>
                  다음 카카오 로그인 실패시키기
                </Button>
              </>
            )}
            <Button variant="secondary" size="md" onClick={() => act(devCreateStaleSession, '이틀 전 미종료 세션을 만들었습니다(오늘 운동 화면 배너 확인용)')}>
              이전 날짜 미종료 세션 만들기(SCR-202-ST10)
            </Button>
            <Button variant="secondary" size="md" onClick={() => act(resetMockDb, 'Mock 데이터를 처음 상태로 되돌렸습니다')}>
              Mock 데이터 초기화
            </Button>
          </div>
        </div>
        <div>
          <h2 className="mt-0 mb-2 text-body font-bold">인트로</h2>
          <div className="flex flex-col gap-2">
            <Button asChild variant="secondary" size="md">
              <a href="/?intro=replay">인트로 다시 보기</a>
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                try {
                  window.localStorage.removeItem(INTRO_SEEN_KEY)
                } catch {
                  /* 무시 */
                }
                window.location.href = '/'
              }}
            >
              최초 방문 기록 지우고 처음부터
            </Button>
          </div>
        </div>
        <div>
          <h2 className="mt-0 mb-2 text-body font-bold">점수 입력 시트(SCR-214)</h2>
          <p className="m-0 mb-3 text-caption text-ink-muted">실제로는 참석 패널(SCR-203)·참가자 패널(SCR-224) 위에서 열립니다(B3·B4). 여기서는 명단의 점수 미설정인 사람 전체로 엽니다.</p>
          <Button variant="secondary" size="md" fullWidth onClick={() => void listUnscored().then((p) => (p.length ? setScorePeople(p) : toast('점수 미설정인 사람이 없습니다', 'neutral')))}>
            점수 입력 시트 열기
          </Button>
        </div>
        {scorePeople && <ScoreEntrySheet people={scorePeople} onClose={() => setScorePeople(null)} onAllDone={() => { setScorePeople(null); toast('모두 점수를 매겼습니다', 'neutral') }} />}
        <Link to="/dev/health" className="text-body text-action">
          백엔드 상태 확인(/dev/health)
        </Link>
      </div>
    </section>
  )
}
