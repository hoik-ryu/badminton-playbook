import { AlertCircle } from 'lucide-react'
import { ActionButton, ChoiceGrid, Field, GRADES, Segmented, TextField } from '../components/smapsh/Form'
import { Sheet } from '../components/smapsh/Sheet'
import { me } from '../mock/data'
import { Scr121 } from './SCR-121'

// SCR-122 프로필 수정(시트, SCR-121 위) — UX Spec r5(02 SCR-122) + Design Direction r5(VD-025 시트, DD 4.1 선택 상태 = 보조 면 + 강조 글자)
// 이름·성별·급수(8개 4×2). 1–10 점수 입력 없음(회원 본인 화면, AC-017). '저장'은 큰 CTA(22px 굵게).
// ST1 기본(현재 값) / ST4 오류(필드 아래 오류 + 시트 위쪽 저장 실패 안내, 입력값 유지)
export function Scr122({ stateId }: { stateId: string }) {
  const err = stateId === 'SCR-122-ST4'
  return (
    <>
      <Scr121 stateId="SCR-121-ST1" />
      <div data-scr="SCR-122" data-st={stateId}>
        <Sheet title="프로필 수정" testId="sheet-122" footer={<ActionButton testId="sheet-save">저장</ActionButton>}>
          <div className="flex flex-col gap-4">
            {err && (
              <div data-cmp="CMP-023" role="alert" className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-body text-danger-fg">
                <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span>저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다.</span>
              </div>
            )}
            <Field label="이름">
              <TextField key={stateId} value={err ? '' : me.name} placeholder="이름" />
              {err && <span className="text-caption font-bold text-danger-fg">이름을 입력해 주세요</span>}
            </Field>
            <Field label="성별">
              <Segmented options={['남', '여']} value={me.gender} />
            </Field>
            <Field label="급수">
              <ChoiceGrid options={GRADES} value={me.grade} cols={4} />
            </Field>
          </div>
        </Sheet>
      </div>
    </>
  )
}
