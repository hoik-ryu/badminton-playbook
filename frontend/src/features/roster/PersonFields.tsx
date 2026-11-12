import { ChoiceGrid, SegmentedControl } from '../../components/RadioButtons'
import { TextField } from '../../components/TextField'
import { GRADES } from '../auth/types'
import { SCORES, type PersonDraft, type PersonErrors } from './personForm'

// 사람 입력 칸(SCR-212 편집·SCR-213 추가 공통): 이름·성별·급수(필수), 점수(1–10, 미설정 허용), 지인(회원 직접 추가만, 선택)
export function PersonFields({ draft, errors, onChange, withReferrer = false }: { draft: PersonDraft; errors: PersonErrors; onChange: (patch: Partial<PersonDraft>, field: keyof PersonErrors | 'referrer') => void; withReferrer?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div data-field="name">
        <TextField label="이름" name="name" value={draft.name} onChange={(e) => onChange({ name: e.target.value }, 'name')} error={errors.name} />
      </div>
      <div data-field="gender">
        <SegmentedControl label="성별" options={['남', '여'] as const} value={draft.gender} onChange={(v) => onChange({ gender: v }, 'gender')} error={errors.gender} />
      </div>
      <div data-field="grade">
        <ChoiceGrid label="급수" kind="grade" options={GRADES} value={draft.grade} onChange={(v) => onChange({ grade: v }, 'grade')} error={errors.grade} />
      </div>
      <div data-field="score">
        <ChoiceGrid
          label="점수"
          kind="score"
          options={SCORES}
          value={draft.score === null ? null : (String(draft.score) as (typeof SCORES)[number])}
          onChange={(v) => onChange({ score: Number(v) }, 'score')}
          onClear={() => onChange({ score: null }, 'score')}
          error={errors.score}
        />
        <p className="m-0 mt-1.5 text-caption text-ink-muted">{draft.score === null ? '미설정 · 선택한 점수를 다시 누르면 미설정으로 돌아갑니다' : `${draft.score}점 · 다시 누르면 미설정`}</p>
      </div>
      {withReferrer && <TextField label="누구의 지인" optional name="referrer" value={draft.referrer} onChange={(e) => onChange({ referrer: e.target.value }, 'referrer')} />}
    </div>
  )
}
