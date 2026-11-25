import { CircleAlert, CircleCheck } from 'lucide-react'

// CMP-055 ValidationList — 04 r8, Design Direction r12 VD-067. 통과 CircleCheck(success.fg) / 실패 CircleAlert(danger.fg) + 글자로 사유.
// 실패 항목은 해당 단계로 가는 '수정'. 색·아이콘만으로 구분하지 않음(화면 읽기용 '통과:'/'확인 필요:' 앞말)
export type ValidationItem = { key: string; ok: boolean; text: string; fixLabel?: string; onFix?: () => void }

export function ValidationList({ title, items }: { title: string; items: ValidationItem[] }) {
  return (
    <section className="su-sec" aria-label={title} data-cmp="CMP-055">
      <h3 className="su-dist" style={{ margin: '4px 0 0', fontWeight: 700 }}>
        {title}
      </h3>
      <ul className="su-checks">
        {items.map((c) => (
          <li key={c.key} data-ok={c.ok}>
            {c.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            <span>
              <span className="sr-only">{c.ok ? '통과: ' : '확인 필요: '}</span>
              {c.text}
            </span>
            {!c.ok && c.onFix && (
              <button type="button" className="su-link" onClick={c.onFix}>
                {c.fixLabel ?? '수정'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
