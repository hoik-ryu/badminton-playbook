import { useState } from 'react'

import { NoticeBox } from '../../components/NoticeBox'
import { SegmentedControl } from '../../components/RadioButtons'
import { Switch } from '../../components/Switch'
import { METHOD_LABEL, setOptions, type Options, type Rules } from './api'

// SCR-204 대진 옵션(모바일 하단 시트 / PC 옆 패널 '옵션' 탭). US-009, FLOW-004-S3, AC-022·023, UXD-002
// - 생성 방식: 레벨별·무작위 중 하나(해제 불가) / 규칙 4개 각각 켜기·끄기(동시 가능). 바꾸면 즉시 저장, 다음 생성부터 반영
// - ST1 현재 옵션 / ST4 저장 실패: 바꾼 값 되돌리고 안내 상자
// - 규칙 한 줄 설명: 명세에 문구가 없어 기획 C-02–C-05 정의를 줄인 문구(docs/workflow-proposals/b3-policy-open-items.md)
const RULES: { key: keyof Rules; label: string; description: string }[] = [
  { key: 'balance', label: '밸런스', description: '두 팀의 점수 합 차이를 가장 작게' },
  { key: 'gender', label: '성별 조합', description: '혼복을 먼저, 남는 인원은 남복·여복' },
  { key: 'fairness', label: '게임 수 공평성', description: '오늘 게임 수가 적은 사람부터 출전' },
  { key: 'noRepeat', label: '중복 회피', description: '같은 날 같은 파트너를 다시 만나지 않게' },
]

export function OptionsPanel({ sessionId, options, onChanged }: { sessionId: string; options: Options; onChanged: () => void }) {
  const [local, setLocal] = useState<Options>(options)
  const [failed, setFailed] = useState(false)

  const save = async (next: Options) => {
    const prev = local
    setLocal(next)
    setFailed(false)
    try {
      await setOptions(sessionId, next)
      onChanged()
    } catch {
      setLocal(prev) // 바꾼 값 되돌림
      setFailed(true)
    }
  }

  return (
    <div data-scr="SCR-204" data-st={failed ? 'SCR-204-ST4' : 'SCR-204-ST1'} className="flex flex-col gap-4 pt-1">
      {failed && <NoticeBox tone="danger">옵션을 저장하지 못해 되돌렸습니다. 다시 시도해 주세요</NoticeBox>}
      <SegmentedControl label="생성 방식" options={(['level', 'random'] as const).map((v) => ({ value: v, label: METHOD_LABEL[v] }))} value={local.method} onChange={(m) => void save({ ...local, method: m })} />
      <div className="flex flex-col">
        {RULES.map((r) => (
          <Switch key={r.key} label={r.label} description={r.description} checked={local.rules[r.key]} onCheckedChange={(on) => void save({ ...local, rules: { ...local.rules, [r.key]: on } })} />
        ))}
      </div>
      <p className="m-0 text-caption text-ink-muted">다음 라운드에도 같은 옵션을 씁니다</p>
    </div>
  )
}

