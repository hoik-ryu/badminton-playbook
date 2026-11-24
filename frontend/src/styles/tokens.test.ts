import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// 승인 테마 계약 ↔ 제품 토큰(전역 단일 기준) 검사.
// 제품 코드·테스트는 design-preview를 읽지 않습니다(preview-check 규칙). 대신 승인 기록이 가리키는 원본과 직접 대조합니다.
//  - 테마 값: docs/design-profile/theme.json(Design Direction r9·Preview r6 승인 때의 sha256과 같아야 함)
//  - 토큰 이름·04 기본값: docs/design/04-ui-system.md(UX Spec r7 승인 해시와 같아야 함)
// tokens.css는 theme-check --print-css 생성물이며, 이 테스트가 손 편집·누락·범위 덮어쓰기를 잡습니다.
const root = path.resolve(__dirname, '../../..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const sha256 = (rel: string) => createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex')
const cssVar = (name: string) => `--${name.replaceAll('.', '-')}`
const declared = (css: string) => Object.fromEntries([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? '').trim()]))

type Approval = { revision: number; hashes: Record<string, string>; theme_hash?: string; ux_spec_hashes?: Record<string, string> }
type Stage = { status: string; approved?: Approval | null; last_approved?: Approval | null }
// 가장 최근 승인 기록: 승인 상태면 approved, 정식 재개(reopen) 중이면 엔진이 보관한 직전 승인(last_approved).
// 재개 중에도 기준은 '승인된 기록'뿐이며, 승인 기록이 하나도 없거나 해시가 다르면 실패합니다.
const latestApproval = (s: Stage) => s.approved ?? s.last_approved ?? null
const design = JSON.parse(read('.ai-workflow/design.json')) as { stages: Record<string, Stage> }
const theme = JSON.parse(read('docs/design-profile/theme.json')) as { version: string; tokens: Record<string, string> }
const product = declared(read('frontend/src/styles/tokens.css'))

// 04 표의 토큰 행: | color.action.primary | #40CDAE | … (값은 둘째 칸)
const spec04 = Object.fromEntries(
  [...read('docs/design/04-ui-system.md').matchAll(/^\| `?((?:color|font|space|radius|size|elevation|motion|breakpoint)\.[A-Za-z0-9.]+)`? \| ([^|]+)\|/gm)].map((m) => [m[1]!, (m[2] ?? '').trim()]),
)

describe('승인 테마 계약(Design Direction r9 · Preview r6)', () => {
  it('theme.json은 Design Direction·Preview의 가장 최근 승인 기록의 테마 해시와 같다(승인 없이 바뀌지 않음)', () => {
    const dd = latestApproval(design.stages.design_direction!)
    const pv = latestApproval(design.stages.preview!)
    expect(dd, 'Design Direction 승인 기록').not.toBeNull()
    expect(pv, 'Preview 승인 기록').not.toBeNull()
    const now = sha256('docs/design-profile/theme.json')
    expect(dd?.theme_hash).toBe(now)
    expect(pv?.theme_hash).toBe(now)
  })

  it('04 문서는 UX Spec 가장 최근 승인 해시와 같다', () => {
    const ux = latestApproval(design.stages.ux_spec!)
    expect(ux, 'UX Spec 승인 기록').not.toBeNull()
    expect(ux?.hashes['docs/design/04-ui-system.md']).toBe(sha256('docs/design/04-ui-system.md'))
  })

  it('제품 tokens.css의 값은 테마 값과 모두 같다', () => {
    const mismatches = Object.entries(theme.tokens).filter(([name, value]) => product[cssVar(name)] !== String(value))
    expect(mismatches).toEqual([])
  })

  it('테마에 없는 04 토큰은 04 값 그대로이고, 계약 밖 변수는 없다', () => {
    for (const [name, value] of Object.entries(spec04)) {
      if (name in theme.tokens) continue
      expect(product[cssVar(name)], name).toBe(value)
    }
    const contract = new Set([...Object.keys(theme.tokens), ...Object.keys(spec04)].map(cssVar))
    expect(Object.keys(product).filter((v) => !contract.has(v))).toEqual([])
  })

  it('Soft Mint 핵심 값(사용자 결정 2026-11-23)이 들어 있다', () => {
    expect(theme.version).toBe('0.4.0-soft-mint')
    expect({
      primary: product['--color-action-primary'],
      onPrimary: product['--color-action-onPrimary'],
      strong: product['--color-action-strong'],
      onStrong: product['--color-action-onStrong'],
      subtle: product['--color-accent-subtle'],
      accent: product['--color-text-accent'],
      focus: product['--color-focus-ring'],
      page: product['--color-bg-page'],
    }).toEqual({ primary: '#40CDAE', onPrimary: '#1A1D23', strong: '#376F65', onStrong: '#FFFFFF', subtle: '#C0F0E2', accent: '#376F65', focus: '#376F65', page: '#FAFFFD' })
  })
})

describe('전역 단일 기준(페이지별 색 덮어쓰기·레거시 색 금지)', () => {
  const srcFiles = (dir: string): string[] =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) return srcFiles(rel)
      return /\.(css|tsx?)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [rel] : []
    })
  const files = srcFiles('frontend/src').filter((f) => f !== 'frontend/src/styles/tokens.css')

  it('tokens.css 밖에서 승인 토큰 변수(--color-* 등)를 다시 정의하지 않는다', () => {
    const tokenVars = new Set(Object.keys(product))
    // 같은 이름을 그대로 가리키는 연결(tailwind.css @theme의 `--radius-sheet: var(--radius-sheet)`)은 값을 바꾸지 않으므로 허용
    const redefined = files.flatMap((f) =>
      Object.entries(declared(read(f)))
        .filter(([v, value]) => tokenVars.has(v) && value !== `var(${v})`)
        .map(([v]) => `${f}: ${v}`),
    )
    expect(redefined).toEqual([])
  })

  it('이전 테마·청백전 예외 색 값이 코드에 남아 있지 않다(브랜드 심볼 SVG·인트로는 Brand Experience 범위라 대상 밖)', () => {
    const legacy = ['#087F73', '#0B9E8B', '#006D68', '#10776C', '#008F89', '#026C6D', '#5FFFFF', '#DDF8EF', '#8EE3CC']
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const hits = files
      .filter((f) => !f.startsWith('frontend/src/features/intro/'))
      .flatMap((f) => legacy.filter((hex) => strip(read(f)).toUpperCase().includes(hex)).map((hex) => `${f}: ${hex}`))
    expect(hits).toEqual([])
  })
})
