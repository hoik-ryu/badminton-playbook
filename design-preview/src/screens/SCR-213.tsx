import { ActionButton, ChoiceGrid, Field, GRADES, SCORES, Segmented, TextField } from '../components/smapsh/Form'
import { NoticeBox } from '../components/smapsh/NoticeBox'
import { Sheet } from '../components/smapsh/Sheet'
import { Scr203 } from './SCR-203'
import { Scr211 } from './SCR-211'

// SCR-213 사람 추가 — UX Spec r2(02 SCR-213) + Design Direction r2(VD-025)
// ST1 게스트 추가: SCR-203 참석 시트 위의 두 번째 시트(04 3.2 중첩, CMP-021 stacked 재사용, 딤 한 겹)
// ST7 회원 직접 추가: SCR-211 더보기에서 여는 시트(제목·지인 칸·UXD-014 안내)
function AddForm({ member }: { member: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {member && <NoticeBox>카카오로 가입하지 않는 회원만 직접 추가하세요</NoticeBox>}
      <Field label="이름">
        <TextField placeholder="이름" />
      </Field>
      <Field label="성별">
        <Segmented options={['남', '여']} />
      </Field>
      <Field label="급수">
        <ChoiceGrid options={GRADES} cols={4} />
      </Field>
      <Field label="점수(선택)">
        <ChoiceGrid options={SCORES} cols={5} />
      </Field>
      {member && (
        <Field label="누구의 지인(선택)">
          <TextField placeholder="지인 이름" />
        </Field>
      )}
    </div>
  )
}

export function Scr213({ stateId }: { stateId: string }) {
  if (stateId === 'SCR-213-ST7') {
    return (
      <Scr211
        stateId="SCR-211-ST1"
        scr="SCR-213"
        overlay={
          <div data-st={stateId}>
            <Sheet title="회원 직접 추가" height="full" testId="sheet-213" footer={<ActionButton>추가</ActionButton>}>
              <AddForm member />
            </Sheet>
          </div>
        }
      />
    )
  }
  return (
    <Scr203
      stateId="SCR-203-ST1"
      child={
        <div data-st={stateId} data-scr-child="SCR-213">
          <Sheet title="게스트 추가" height="full" stacked dim={false} testId="sheet-213" footer={<ActionButton>추가</ActionButton>}>
            <AddForm member={false} />
          </Sheet>
        </div>
      }
    />
  )
}
