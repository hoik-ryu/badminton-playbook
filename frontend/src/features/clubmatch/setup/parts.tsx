import { CalendarDays, Check, ChevronDown, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import symbolUrl from '../../../assets/brand/smapsh-symbol.svg'
import { Badge } from '../../../components/Badge'
import type { ParticipantRow } from '../api'
import { dateLabel, personLabel } from './format'

// 청백전 생성 페이지 전용 표현 부품 — 원장 POL-001(CMP-002·004·008·024·026)·POL-002(CMP-041) 결정(2026-11-25 "생성 페이지 전용 부품 (권장)").
// Design Direction r12 VD-061–066, Preview r8 그대로. 공통 부품(components/)의 계약은 바꾸지 않습니다. 스타일은 styles/clubmatch-setup.css(.su 범위)

const BRAND_SYMBOL = symbolUrl
/** 히어로 셔틀콕(AST-046, 사용자 제공·권리 확인됨) — 제품 public/assets의 기존 사본(Preview와 바이트 동일) */
export const SHUTTLE_URL = `${import.meta.env.BASE_URL}assets/AST-046.png`

/** 경기 방식 섹션 아이콘: Lucide에 셔틀콕이 없어 브랜드 심볼 단색(VD-061·070) */
export function ShuttleIcon() {
  return <img src={BRAND_SYMBOL} alt="" aria-hidden />
}

/** 머리글 가운데 로고(VD-059): 기존 브랜드 심볼 + 'SMAPSH' 워드마크 */
export function BrandLogo() {
  return (
    <div className="su-logo" aria-label="SMAPSH">
      <img src={BRAND_SYMBOL} alt="" aria-hidden />
      <span aria-hidden>SMAPSH</span>
    </div>
  )
}

export function SectionTitle({ icon, children, req, aside, id }: { icon: ReactNode; children: ReactNode; req?: boolean; aside?: ReactNode; id?: string }) {
  return (
    <h2 className="su-sec-h" id={id}>
      {icon}
      {children}
      {req && (
        <span className="su-req" aria-label="필수">
          *
        </span>
      )}
      {aside && <span className="su-aside">{aside}</span>}
    </h2>
  )
}

/** 이니셜 아바타(VD-064·070, 사진 없음) */
export function Avatar({ name }: { name: string }) {
  return (
    <span className="su-avatar" aria-hidden>
      {name.slice(0, 1)}
    </span>
  )
}

/** 사람 메타 한 줄 '남 · A조 · 8점' + 점수 미설정·게스트 배지(CMP-005 재사용) */
export function PersonMeta({ p }: { p: Pick<ParticipantRow, 'gender' | 'grade' | 'score' | 'kind'> }) {
  const parts = [p.gender, p.grade, p.score === null ? null : `${p.score}점`].filter(Boolean)
  return (
    <span className="su-meta">
      {parts.join(' · ')}
      {p.score === null && (
        <Badge tone="warning" className="su-badge" data-tone="warning">
          점수 미설정
        </Badge>
      )}
      {p.kind === 'guest' && (
        <Badge tone="neutral" className="su-badge" data-tone="neutral">
          게스트
        </Badge>
      )}
    </span>
  )
}

/** 선택 타일(CMP-002 표현, VD-062): 같은 폭 2칸, 아이콘 + 글자. 키보드 방향키로 이동(라디오 그룹) */
export function MethodTiles<T extends string>({ label, value, options, onChange, error }: { label: string; value: T | null; options: { value: T; label: string; icon: ReactNode }[]; onChange: (v: T) => void; error?: string }) {
  const move = (i: number, d: number) => {
    const next = options[(i + d + options.length) % options.length]
    if (next) onChange(next.value)
  }
  return (
    <>
      <div className="su-tiles" role="radiogroup" aria-label={label} aria-invalid={error ? true : undefined}>
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            tabIndex={(value === null ? i === 0 : value === o.value) ? 0 : -1}
            className="su-tile"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(i, -1)
              }
            }}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="su-field-err" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

/** 필터 칩(CMP-004 표현, VD-064): 인원 수 없이 글자만, 켜짐은 aria-pressed */
export function SetupChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className="su-chip" aria-pressed={pressed} onClick={onToggle}>
      {children}
    </button>
  )
}

/** 오른쪽 체크 표시(CMP-008 표현). 행 전체가 체크 상자(role=checkbox)라 표시만 함 */
export function CheckMark({ on }: { on: boolean }) {
  return (
    <span className="su-cb" data-on={on} aria-hidden>
      {on && <Check strokeWidth={3} />}
    </span>
  )
}

/** 사람 행(CMP-024 표현): 이니셜 · 이름(선택 시 굵게) · 메타 한 줄 · 오른쪽 체크, 행 높이 52 */
export function PersonPickRow({ p, checked, onToggle, problem }: { p: ParticipantRow; checked: boolean; onToggle: () => void; problem?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className="su-row" onClick={onToggle} aria-label={`${personLabel(p)}${problem ? `, ${problem}` : ''}`}>
      <Avatar name={p.name} />
      <span className="su-who">
        <span className="su-name">{p.name}</span>
        <PersonMeta p={p} />
        {problem && (
          <span className="su-field-err" style={{ margin: 0 }}>
            <TriangleAlert aria-hidden className="mr-1 inline size-3.5" />
            {problem}
          </span>
        )}
      </span>
      <CheckMark on={checked} />
    </button>
  )
}


/** 날짜 칸(VD-062 표현): 보이는 버튼 모양 + 위에 투명한 기기 날짜 선택기(input type=date) */
export function SetupDateField({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error?: string; label: string }) {
  return (
    <>
      <label className="su-input su-date" data-error={error ? true : undefined}>
        <CalendarDays aria-hidden />
        <span style={{ flex: 1, textAlign: 'left' }} aria-hidden>
          {value ? dateLabel(value) : '날짜를 골라 주세요'}
        </span>
        <ChevronDown aria-hidden />
        <input type="date" aria-label={`${label} ${value ? dateLabel(value) : ''}`.trim()} value={value} onChange={(e) => onChange(e.target.value)} required aria-invalid={error ? true : undefined} />
      </label>
      {error && (
        <p className="su-field-err" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
