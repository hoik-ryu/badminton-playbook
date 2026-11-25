import { AlertTriangle, Check, ChevronRight, Search, SearchX, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Dialog, PersonMeta, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { ROSTER, SELECTED_16, SELECTED_WITH_UNSCORED, type SetupPerson } from '../mock/setup'

// SCR-242 청백전 생성 · 참가자 설정 — UX Spec r9 02 SCR-242, UXD-093·094·098 / DD r12 VD-064, REF-005
// 고정 영역(검색·필터)은 목록을 내려도 보이고, 선택 요약 줄은 시안처럼 목록 아래·행동 바 위에 고정합니다.
// 검색·필터를 바꿔도 선택은 유지되고, '표시된 n명 모두 선택/해제'는 현재 결과에만 적용됩니다(C-34).
// 보기: ST1(14명 선택) · ST1-FEW(3명, 다음 불가) · ST1-FILTER(여·B조·C조 필터) · ST2(로딩) · ST3(검색 결과 없음) · ST4(저장 실패) · ST7(점수 미설정) · ST8(진행 가능, 16명) · ST10(대진 폐기 확인) — 개인전은 끝에 -IND
const GRADES = ['자강조', 'A조', 'B조', 'C조', 'D조', '초심', '왕초심', '입문자']

export function Scr242({ stateId }: { stateId: string }) {
  const ind = stateId.includes('-IND')
  const variant = /-(FEW|NONE|FILTER)/.exec(stateId)?.[1]
  const st = stateId.replace(/-IND$/, '').replace(/-(FEW|NONE|FILTER)$/, '')
  const method = ind ? 'individual' : 'team'
  const filtered = variant === 'FILTER'
  // ST1: 시안처럼 14명 선택(남 8 여 6) · ST8: 16명(진행 가능) · ST7: 점수 미설정 2명 포함
  const start = variant === 'NONE' ? [] : variant === 'FEW' ? SELECTED_16.slice(0, 3) : st === 'SCR-242-ST7' ? SELECTED_WITH_UNSCORED : st === 'SCR-242-ST1' ? SELECTED_16.filter((id) => id !== 'p19' && id !== 'g01') : SELECTED_16
  const [sel, setSel] = useState<Set<string>>(() => new Set(start))
  const [q, setQ] = useState(st === 'SCR-242-ST3' ? '홍길동' : '')
  const [gender, setGender] = useState<'전체' | '남' | '여'>(filtered ? '여' : '전체')
  const [grades, setGrades] = useState<Set<string>>(() => new Set(filtered ? ['B조', 'C조'] : []))
  const [unscoredOnly, setUnscoredOnly] = useState(false)
  const [dialog, setDialog] = useState(st === 'SCR-242-ST10')
  const shown = useMemo(
    () => ROSTER.filter((p) => (!q || p.name.includes(q)) && (gender === '전체' || p.gender === gender) && (grades.size === 0 || grades.has(p.grade)) && (!unscoredOnly || p.score === null)),
    [q, gender, grades, unscoredOnly],
  )
  const members = shown.filter((p) => !p.guest)
  const guests = shown.filter((p) => p.guest)
  const allShownOn = shown.length > 0 && shown.every((p) => sel.has(p.id))
  const chosen = ROSTER.filter((p) => sel.has(p.id))
  const male = chosen.filter((p) => p.gender === '남').length
  const unscored = chosen.filter((p) => p.score === null).length
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const bulk = () => setSel((s) => { const n = new Set(s); shown.forEach((p) => (allShownOn ? n.delete(p.id) : n.add(p.id))); return n })
  const reason = chosen.length < 4 ? `참가자를 4명 이상 선택해 주세요 · 지금 ${chosen.length}명` : unscored > 0 ? `점수 미설정 ${unscored}명의 점수를 매겨 주세요` : undefined
  const loading = st === 'SCR-242-ST2'
  const row = (p: SetupPerson) => (
    <li key={p.id}>
      <button type="button" role="checkbox" aria-checked={sel.has(p.id)} className="su-row" data-cmp="CMP-024" data-mode="select" onClick={() => toggle(p.id)} aria-label={`${p.name}, ${p.gender}, ${p.grade}, ${p.score === null ? '점수 미설정' : `${p.score}점`}${p.guest ? ', 게스트' : ''}`}>
        <Avatar name={p.name} />
        <span className="su-who">
          <span className="su-name">{p.name}</span>
          <PersonMeta p={p} />
        </span>
        <span className="su-cb" data-cmp="CMP-008" data-on={sel.has(p.id)} aria-hidden>
          {sel.has(p.id) && <Check strokeWidth={3} />}
        </span>
      </button>
    </li>
  )
  return (
    <SetupScreen
      scr="SCR-242"
      st={stateId}
      method={method}
      step="participants"
      title="참가자 설정"
      desc="경기에 참여할 멤버를 선택해 주세요."
      compact
      card={
        <>
          {st === 'SCR-242-ST4' && (
            <div className="su-note" data-tone="danger" role="alert" data-cmp="CMP-023">
              <AlertTriangle aria-hidden />
              <span>저장하지 못했습니다. 입력한 내용은 그대로입니다</span>
              <a className="su-link" href="#">다시 시도</a>
            </div>
          )}
          <section className="su-sec" aria-label="참가자 선택" style={{ gap: 0 }}>
            <div className="su-sticky" data-testid="su-fixed-top">
              <label className="su-input" data-cmp="CMP-006" style={{ height: 44 }}>
                <Search aria-hidden />
                <input type="search" aria-label="이름으로 검색" placeholder="이름으로 검색" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && (
                  <button type="button" aria-label="검색어 지우기" onClick={() => setQ('')} className="su-icon-btn" style={{ width: 32, height: 32 }}>
                    <X aria-hidden className="size-4" />
                  </button>
                )}
              </label>
              <div className="su-chips" role="group" aria-label="필터" data-cmp="CMP-004">
                {(['전체', '남', '여'] as const).map((g) => (
                  <button key={g} type="button" className="su-chip" aria-pressed={gender === g} onClick={() => setGender(g)}>
                    {g === '전체' ? '성별 전체' : g}
                  </button>
                ))}
                <span aria-hidden className="su-chip-sep" />
                {GRADES.map((g) => (
                  <button key={g} type="button" className="su-chip" aria-pressed={grades.has(g)} onClick={() => setGrades((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n })}>
                    {g}
                  </button>
                ))}
                <span aria-hidden className="su-chip-sep" />
                <button type="button" className="su-chip" aria-pressed={unscoredOnly} onClick={() => setUnscoredOnly((x) => !x)}>
                  <AlertTriangle aria-hidden />
                  점수 미설정
                </button>
              </div>
            </div>
            <div className="su-listhead">
              <b>
                {q || gender !== '전체' || grades.size || unscoredOnly ? '검색 결과' : '전체 회원'} <span>({shown.length})</span>
              </b>
              {shown.length > 0 && (
                <button type="button" role="checkbox" aria-checked={allShownOn} className="su-check-all" onClick={bulk}>
                  <span className="su-cb" data-on={allShownOn} aria-hidden>
                    {allShownOn && <Check strokeWidth={3} />}
                  </span>
                  {allShownOn ? `표시된 ${shown.length}명 모두 해제` : `표시된 ${shown.length}명 모두 선택`}
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex flex-col gap-2 py-2" aria-busy="true" aria-label="명단을 불러오는 중">
                {Array.from({ length: 7 }, (_, i) => <div key={i} className="su-skel" style={{ height: 44 }} />)}
              </div>
            ) : shown.length === 0 ? (
              <div className="su-empty" data-cmp="CMP-027" role="status">
                <SearchX aria-hidden />
                <p style={{ margin: 0 }}>&apos;{q || '조건'}&apos;과 일치하는 사람이 없습니다</p>
                <button type="button" onClick={() => { setQ(''); setGender('전체'); setGrades(new Set()); setUnscoredOnly(false) }}>
                  검색·필터 지우기
                </button>
              </div>
            ) : (
              <>
                {members.length > 0 && <ul className="su-list" aria-label="회원" data-testid="su-rows">{members.map(row)}</ul>}
                {guests.length > 0 && (
                  <>
                    <p className="su-group">게스트</p>
                    <ul className="su-list" aria-label="게스트">{guests.map(row)}</ul>
                  </>
                )}
              </>
            )}
          </section>
        </>
      }
      bar={
        <StepBar
          prev={stepHref('SCR-241', method, 'SCR-241-ST8')}
          next={stepHref(ind ? 'SCR-244' : 'SCR-243', method, ind ? 'SCR-244-ST1' : 'SCR-243-ST7')}
          disabledReason={reason}
          quietReason={chosen.length >= 4 && unscored > 0}
          loading={loading}
          above={
            <>
              {unscored > 0 && (
                <a className="su-warnline" href="#SCR-242/SCR-242-ST7/mobile" data-cmp="CMP-028" aria-label={`점수 미설정 ${unscored}명, 점수 매기기`}>
                  <AlertTriangle aria-hidden />
                  점수 미설정 {unscored}명
                  <b>점수 매기기</b>
                </a>
              )}
              <a className="su-summary" href={`#SCR-246/SCR-246-ST1${ind ? '-IND' : ''}/mobile`} data-cmp="CMP-028" data-kind="selection" aria-live="polite" style={{ marginBottom: 8 }}>
                <Users aria-hidden />
                선택 {chosen.length}명 <em>· 남 {male} 여 {chosen.length - male}</em>
                <span className="su-more">
                  확인 <ChevronRight aria-hidden className="size-4" />
                </span>
              </a>
            </>
          }
        />
      }
      overlay={dialog ? <Dialog title="대진이 초기화됩니다" desc="참가자를 바꾸면 만든 대진을 버리고 다시 생성해야 합니다" ok="바꾸기" onCancel={() => setDialog(false)} onOk={() => setDialog(false)} /> : undefined}
    />
  )
}
