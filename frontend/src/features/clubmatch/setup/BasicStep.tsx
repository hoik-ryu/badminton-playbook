import { CalendarDays, Grid2x2, PenLine, User, Users } from 'lucide-react'
import { useRef, useState } from 'react'

import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { StepActionBar } from '../../../components/StepActionBar'
import { TextField } from '../../../components/TextField'
import { createClubMatch, NAME_MAX, nameErrorOf, nameProblem, saveBasic, type ClubMethod } from '../api'
import { MAX_COURTS } from '../schedule'
import { MethodTiles, SectionTitle, SetupDateField, ShuttleIcon } from './parts'
import { SetupFrame } from './SetupFrame'
import { participantsOf } from './steps'
import type { StepProps } from './types'

// SCR-241 청백전 생성 · 기본정보 — UX Spec r9 02 SCR-241(UXD-090–092), DD r12 VD-059–063, Preview r8
// 방식(필수, 고르면 진행 표시 5↔4칸 즉시) · 이름(필수, 공백 제외 30자, 글자 수 n/30) · 날짜(필수, 기본 오늘, 기기 날짜 선택기)
// '다음'(만들기 전): 준비 중 청백전을 만들고 setup 주소로. '다음'(만든 뒤): 바뀐 값만 저장(이름·날짜는 팀·대진 유지, AC-123)
// 방식이 바뀌고 팀 배정·대진이 있으면 확인 창(ST9, AC-070·132). 더보기 → 삭제 확인(ST10, AC-134 — 확인 창·처리는 페이지가 소유, 모든 단계 공통)
// (r14, UX Spec r11 SCR-241·UXD-105·DD r14 VD-077) 날짜 아래 '사용 코트 수' 스테퍼(1–8, 기본 4). 대진이 있을 때 다른 코트 수로 '다음'이면
//   확인 창(ST11, 취소하면 저장값으로). 라운드 정보 없는 준비 중 청백전은 4를 채우고 안내 상자(ST12) — '다음'에서 코트 수를 저장(AC-144·163)
type Errors = { method?: string; name?: string; date?: string; courts?: string }
const COURTS_ERROR = `코트 수는 1–${MAX_COURTS} 사이로 입력해 주세요`

export function BasicStep({ c, frame, go, onCreated }: StepProps & { onCreated: (id: string) => void }) {
  const v = c.view
  const d = c.drafts.basic
  const [errors, setErrors] = useState<Errors>({})
  const [ask, setAsk] = useState<'method' | 'courts' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const confirmed = useRef(false)
  const set = (patch: Partial<typeof d>) => c.setDrafts((x) => ({ ...x, basic: { ...x.basic, ...patch } }))
  const len = d.name.trim().length
  const liveNameError = len > NAME_MAX ? nameProblem(d.name) ?? undefined : undefined
  const courts = Number(d.courts)
  const courtsOk = d.courts !== '' && Number.isInteger(courts) && courts >= 1 && courts <= MAX_COURTS
  const savedCourts = v ? String(v.courtCount ?? 4) : '4'
  /** 라운드 정보 없는 준비 중 청백전(코트 수 없음, ST12) */
  const legacy = !!v && v.courtCount === null

  const validate = (): Errors => {
    const e: Errors = {}
    if (!d.method) e.method = '방식을 골라 주세요'
    const n = nameProblem(d.name)
    if (n) e.name = n
    if (!d.date) e.date = '날짜를 골라 주세요'
    if (!courtsOk) e.courts = COURTS_ERROR
    return e
  }

  const saveExisting = async (discard: boolean) => {
    if (!v || !d.method) return
    const input = { name: d.name, date: d.date, method: d.method, courtCount: courts }
    const methodChanged = d.method !== v.method
    const courtsChanged = courts !== v.courtCount
    const r = await c.save(
      () => saveBasic(v.id, v.version, input, discard),
      (x) => x.name === d.name.trim() && x.date === d.date && x.method === d.method && x.courtCount === courts,
      () => void next(),
    )
    if (r.kind === 'ok') {
      c.accept(r.view, { basic: true, teams: methodChanged, games: methodChanged || courtsChanged })
      if (methodChanged) c.setDrafts((x) => ({ ...x, teamUi: { method: null, note: null, lastMove: null, seeded: false } }))
      // 코트 수·방식이 바뀌어 대진이 버려지면 대진 화면 상태(미완성 경기·기준값)도 비움
      if (methodChanged || courtsChanged) c.setDrafts((x) => ({ ...x, gamesUi: { mode: null, base: null, edited: false, partials: [] } }))
      go('participants')
    } else if (r.kind === 'confirm') setAsk(methodChanged ? 'method' : 'courts')
    else if (r.kind === 'failed') fail(r.error)
  }

  const fail = (e: unknown) => {
    const field = nameErrorOf(e)
    if (field) {
      setErrors({ name: field })
      nameRef.current?.focus()
    } else c.setFailure({ message: '저장하지 못했습니다. 입력한 내용은 그대로입니다', retry: () => void next() })
  }

  async function next() {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length || !d.method) {
      if (e.name) nameRef.current?.focus()
      return
    }
    if (!v) {
      c.setSaving(true)
      c.setFailure(null)
      try {
        const id = await createClubMatch({ method: d.method, date: d.date, name: d.name, courtCount: courts })
        onCreated(id)
      } catch (err) {
        fail(err)
      } finally {
        c.setSaving(false)
      }
      return
    }
    const unchanged = d.method === v.method && d.name.trim() === v.name && d.date === v.date && courts === v.courtCount
    if (unchanged) return go('participants')
    const hasTeams = participantsOf(v).some((r) => r.team)
    if (d.method !== v.method && (v.games.length > 0 || hasTeams)) return setAsk('method')
    if (courts !== v.courtCount && v.games.length > 0) return setAsk('courts')
    await saveExisting(false)
  }

  const setCourts = (courtsText: string) => {
    set({ courts: courtsText })
    setErrors((x) => ({ ...x, courts: undefined }))
  }
  const fieldError = Object.values(errors).some(Boolean) || !!liveNameError
  const st = ask === 'method' ? 'SCR-241-ST9' : frame.deleting ? 'SCR-241-ST10' : ask === 'courts' ? 'SCR-241-ST11' : c.conflict ? 'SCR-241-ST6' : c.saving ? 'SCR-241-ST2' : fieldError || c.failure || frame.moreNotice ? 'SCR-241-ST4' : !d.method ? 'SCR-241-ST7' : legacy ? 'SCR-241-ST12' : v ? 'SCR-241-ST8' : 'SCR-241-ST1'

  return (
    <SetupFrame
      scr="SCR-241"
      st={st}
      method={d.method ?? 'none'}
      title={v ? v.name : '새 청백전'}
      desc="청백전의 기본 정보를 입력해 주세요."
      steps={frame.steps}
      current="basic"
      onStep={frame.onStep}
      onExit={frame.onExit}
      onMore={frame.onMore}
      moreNotice={frame.moreNotice}
      notice={
        <>
          {c.failure && (
            <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={c.failure.retry}>다시 시도</button>}>
              {c.failure.message}
            </NoticeBox>
          )}
        </>
      }
      bar={<StepActionBar onNext={() => void next()} loading={c.saving} />}
      overlay={
        <>
          <ConfirmDialog
            open={ask === 'method'}
            onOpenChange={(o) => {
              if (!o) {
                if (!confirmed.current && v) set({ method: v.method }) // 취소하면 원래 방식으로(AC-070)
                confirmed.current = false
                setAsk(null)
              }
            }}
            title="방식을 바꾸면 만든 대진과 팀 배정이 초기화됩니다"
            description="참가자는 유지됩니다"
            confirmLabel="바꾸기"
            onConfirm={async () => {
              confirmed.current = true
              await saveExisting(true)
            }}
          />
          <ConfirmDialog
            open={ask === 'courts'}
            onOpenChange={(o) => {
              if (!o) {
                if (!confirmed.current) set({ courts: savedCourts }) // 취소하면 저장된 코트 수로(대진·version 그대로)
                confirmed.current = false
                setAsk(null)
              }
            }}
            tone="danger"
            title="코트 수를 바꾸면 만든 대진이 초기화됩니다"
            description="대진 설정 단계에서 다시 만들어야 합니다"
            confirmLabel="바꾸기"
            onConfirm={async () => {
              confirmed.current = true
              await saveExisting(true)
            }}
          />
        </>
      }
    >
      <section className="su-sec" aria-labelledby="s241-m">
        <SectionTitle id="s241-m" icon={<ShuttleIcon />} req>
          경기 방식
        </SectionTitle>
        <MethodTiles<ClubMethod>
          label="경기 방식"
          value={d.method}
          error={errors.method}
          onChange={(m) => {
            set({ method: m })
            setErrors((x) => ({ ...x, method: undefined }))
          }}
          options={[
            { value: 'individual', label: '개인전', icon: <User aria-hidden /> },
            { value: 'team', label: '팀전', icon: <Users aria-hidden /> },
          ]}
        />
      </section>
      <section className="su-sec">
        <SectionTitle icon={<PenLine aria-hidden />} req>
          청백전 이름
        </SectionTitle>
        <TextField
          ref={nameRef}
          className="su-namefield"
          label="청백전 이름"
          hideLabel
          value={d.name}
          placeholder="예: 12월 둘째 주 청백전"
          error={errors.name ?? liveNameError}
          onChange={(e) => {
            set({ name: e.target.value })
            setErrors((x) => ({ ...x, name: undefined }))
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
        <span className="su-count" aria-live="polite">
          {len} / {NAME_MAX}
        </span>
      </section>
      <section className="su-sec">
        <SectionTitle icon={<CalendarDays aria-hidden />} req>
          날짜
        </SectionTitle>
        <SetupDateField
          label="날짜"
          value={d.date}
          error={errors.date}
          onChange={(date) => {
            set({ date })
            setErrors((x) => ({ ...x, date: undefined }))
          }}
        />
      </section>
      <section className="su-sec">
        <SectionTitle icon={<Grid2x2 aria-hidden />} req>
          사용 코트 수
        </SectionTitle>
        {legacy && <NoticeBox tone="info">라운드 정보가 없는 청백전입니다. 코트 수를 정하면 기존 대진은 버리고 라운드로 다시 구성합니다</NoticeBox>}
        <TextField
          label="사용 코트 수"
          hideLabel
          value={d.courts}
          error={errors.courts}
          stepper={{ min: 1, max: MAX_COURTS, unit: '면', decLabel: '코트 수 줄이기', incLabel: '코트 수 늘리기', onStep: (n) => setCourts(String(n)) }}
          onChange={(e) => setCourts(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
        <p className="su-help" aria-live="polite">
          {courtsOk ? `한 라운드에 최대 ${courts}경기를 동시에 진행합니다` : ''}
        </p>
      </section>
    </SetupFrame>
  )
}
