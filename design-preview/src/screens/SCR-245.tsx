import { CalendarDays, Check, CircleAlert, CircleCheck, FileText, ListOrdered, PenLine, Pencil, Shuffle, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Dialog, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { person, proposeTeams, SELECTED_16, sum } from '../mock/setup'

// SCR-245 청백전 생성 · 확정 — UX Spec r9 02 SCR-245, UXD-097 / DD r12 VD-067, REF-005(확인 화면)
// 요약 묶음(기본정보·참가자·팀 구성·대진)마다 '수정', 검증 목록, 공개 안내, '확정' → 확인 창(ST8).
// 시안 문구 "생성 후에도 일부 설정은 수정할 수 있어요"는 승인 정책(확정 후 방식·재생성 불가)과 달라 쓰지 않습니다.
// 보기: ST1(모두 통과) · ST7(검증 실패) · ST8(확정 확인) — 개인전은 끝에 -IND
const IDS = SELECTED_16
const TEAMS = proposeTeams(IDS)

export function Scr245({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const method = ind ? 'individual' : 'team'
  const [dialog, setDialog] = useState(st === 'SCR-245-ST8')
  const fail = st === 'SCR-245-ST7'
  const male = IDS.filter((id) => person(id).gender === '남').length
  const guests = IDS.filter((id) => person(id).guest).length
  const blue = IDS.filter((id) => TEAMS[id] === 'blue')
  const white = IDS.filter((id) => TEAMS[id] === 'white')
  const g = (ids: string[]) => `남 ${ids.filter((id) => person(id).gender === '남').length} · 여 ${ids.filter((id) => person(id).gender === '여').length}`
  const checks: { ok: boolean; text: string; fix?: string }[] = [
    { ok: true, text: `참가자 4명 이상(${IDS.length}명)` },
    fail ? { ok: false, text: '점수 미설정 1명(조민재)', fix: stepHref('SCR-242', method, 'SCR-242-ST7') } : { ok: true, text: '점수 미설정 0명' },
    ...(ind ? [] : [{ ok: true, text: '미배정 0명 · 팀당 2명 이상' }]),
    fail ? { ok: false, text: '대진 없음 — 대진을 다시 만들어 주세요', fix: stepHref('SCR-244', method) } : { ok: true, text: `대진 있음(8경기)` },
  ]
  const allOk = checks.every((c) => c.ok)
  const group = (title: string, href: string, rows: ReactNode) => (
    <section className="su-sum-group" data-cmp="CMP-056" aria-label={title}>
      <div className="su-sum-head">
        <h3>{title}</h3>
        <a className="su-edit" href={href} aria-label={`${title} 수정`}>
          <Pencil aria-hidden />
          수정
        </a>
      </div>
      {rows}
    </section>
  )
  const kv = (icon: ReactNode, k: string, v: ReactNode) => (
    <div className="su-kv">
      {icon}
      <span>{k}</span>
      <b>{v}</b>
    </div>
  )
  return (
    <SetupScreen
      scr="SCR-245"
      st={stateId}
      method={method}
      step="confirm"
      title="확정"
      desc="설정을 확인하고 청백전을 확정해 주세요."
      compact
      card={
        <>
          {group('기본정보', stepHref('SCR-241', method, 'SCR-241-ST8'), <>
            {kv(<FileText aria-hidden />, '경기 방식', ind ? '개인전' : '팀전')}
            {kv(<PenLine aria-hidden />, '이름', '12월 둘째 주 청백전')}
            {kv(<CalendarDays aria-hidden />, '날짜', '2026. 12. 13 (일)')}
          </>)}
          {group('참가자', stepHref('SCR-242', method, 'SCR-242-ST8'), kv(<Users aria-hidden />, '참가 인원', <>{IDS.length}명<small>남 {male} · 여 {IDS.length - male} · 게스트 {guests}</small></>))}
          {!ind &&
            group('팀 구성', stepHref('SCR-243', method), kv(<Shuffle aria-hidden />, '팀 구성', <>
              청팀 {blue.length}명 · 백팀 {white.length}명
              <small>청 {g(blue)} · 점수 합 {sum(blue)}</small>
              <small>백 {g(white)} · 점수 합 {sum(white)}</small>
            </>))}
          {group('대진', stepHref('SCR-244', method, 'SCR-244-ST7'), kv(<ListOrdered aria-hidden />, '대진', fail ? <>없음<small>경기 수를 바꿔 대진이 초기화됨</small></> : <>8경기<small>1인 2경기 · 밸런스·성별 조합 켬 · 규칙 완화 1경기</small></>))}
          <section className="su-sec" aria-label="확정 전 확인" data-cmp="CMP-055">
            <h3 className="su-dist" style={{ margin: '4px 0 0', fontWeight: 700 }}>확정 전 확인</h3>
            <ul className="su-checks">
              {checks.map((c) => (
                <li key={c.text} data-ok={c.ok}>
                  {c.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
                  <span>
                    <span className="sr-only">{c.ok ? '통과: ' : '확인 필요: '}</span>
                    {c.text}
                  </span>
                  {c.fix && <a href={c.fix}>수정</a>}
                </li>
              ))}
            </ul>
          </section>
          <p className="su-note" data-tone="mint">
            <CircleCheck aria-hidden />
            <span>확정하면 회원에게 공개됩니다</span>
          </p>
        </>
      }
      bar={
        <StepBar
          prev={stepHref('SCR-244', method, 'SCR-244-ST7')}
          next={`#SCR-245/SCR-245-ST8${ind ? '-IND' : ''}/mobile`}
          nextLabel="확정"
          nextIcon={<Check aria-hidden />}
          disabledReason={allOk ? undefined : '확인이 필요한 항목을 먼저 고쳐 주세요'}
        />
      }
      overlay={dialog ? <Dialog title="대진을 확정하고 회원에게 공개할까요?" desc="확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다" ok="확정" onCancel={() => setDialog(false)} onOk={() => { window.location.hash = '#SCR-112/SCR-112-ST13/mobile' }} /> : undefined}
    />
  )
}
