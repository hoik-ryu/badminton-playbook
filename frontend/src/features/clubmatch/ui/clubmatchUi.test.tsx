import fs from 'node:fs'
import path from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CLUBMATCH_BANNER_URL, CLUBMATCH_LAUREL_URL } from './assets'
import { ClubMatchBadge, ClubMatchScope, OpsOnlyChip, type ClubMatchBadgeTone } from './ClubMatchBadge'

// 청백전 1단계(자산·토큰·배지 기반) — Preview r5(DD r8 VD-049·052·053·058)와 값이 같은지 확인
const root = path.resolve(__dirname, '../../../../..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const cssVars = (css: string) => Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] ?? '').trim()]))

describe('청백전 토큰(VD-049)', () => {
  it('제품 tokens.css에 공식 테마의 청백전 토큰 6개가 같은 값으로 있다', () => {
    const theme = JSON.parse(read('docs/design-profile/theme.json')).tokens as Record<string, string>
    const product = cssVars(read('frontend/src/styles/tokens.css'))
    const names = ['color.hero.bg', 'color.hero.text', 'color.hero.accent', 'color.award.gold', 'color.method.individual.fg', 'color.method.individual.bg']
    for (const n of names) expect(product[`--${n.replaceAll('.', '-')}`], n).toBe(theme[n])
  })

  it('승인된 Preview r5의 tokens.css와 6개 값이 같다', () => {
    const preview = cssVars(read('design-preview/src/tokens.css'))
    const product = cssVars(read('frontend/src/styles/tokens.css'))
    for (const k of ['--color-hero-bg', '--color-hero-text', '--color-hero-accent', '--color-award-gold', '--color-method-individual-fg', '--color-method-individual-bg']) expect(product[k], k).toBe(preview[k])
  })

  it('청백전 채움색과 범위 테마는 .cm 안에서만 정의된다(앱 전체 토큰은 그대로)', () => {
    const css = read('frontend/src/styles/clubmatch.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const cm = css.match(/(?:^|\})\s*\.cm\s*\{([^}]*)\}/)?.[1] ?? ''
    const vars = cssVars(cm)
    expect(vars['--cm-fill']).toBe('#087F73')
    // (2단계) 청백전 화면 범위에서만 승인 테마 값(DD r8 VD-038·049)
    expect(vars['--color-action-primary']).toBe('#0B9E8B')
    expect(vars['--color-focus-ring']).toBe('#087F73')
    expect(vars['--color-bg-page']).toBe('var(--cm-theme-bg-page)')
    expect(cssVars(css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '')).toEqual({ '--cm-theme-bg-page': '#FAFFFD' })
    // 범위 밖 규칙은 :root의 새 변수 1개와 청백전 화면을 담은 열의 바탕 1개뿐. 나머지는 모두 .cm으로 시작(@container 안 포함)
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => (m[2] ?? '').trim())
    for (const s of selectors) expect(s.startsWith('.cm') || s === ':root' || s === '.app-column:has(.cm-page)', s).toBe(true)
    // 앱 전체 tokens.css의 세 값은 바뀌지 않음(사용자 결정 2026-11-24)
    const product = cssVars(read('frontend/src/styles/tokens.css'))
    expect([product['--color-action-primary'], product['--color-bg-page'], product['--color-focus-ring']]).toEqual(['#006D68', '#FFFFFF', '#008F89'])
    expect(read('frontend/src/styles/tokens.css')).not.toContain('--cm-')
  })
})

describe('청백전 배지(CMP-005, VD-053)', () => {
  const tones: [ClubMatchBadgeTone, string][] = [['live', '진행 중'], ['upcoming', '진행 예정'], ['pending', '준비 중'], ['ended', '종료'], ['teamBlue', '팀전'], ['individual', '개인전']]

  it('톤마다 글자와 톤 속성을 함께 그린다(색만으로 구분하지 않음)', () => {
    render(
      <ClubMatchScope data-testid="scope">
        {tones.map(([t, label]) => <ClubMatchBadge key={t} tone={t}>{label}</ClubMatchBadge>)}
        <OpsOnlyChip />
      </ClubMatchScope>,
    )
    expect(screen.getByTestId('scope')).toHaveClass('cm')
    for (const [t, label] of tones) {
      const el = screen.getByText(label)
      expect(el).toHaveAttribute('data-cmp', 'CMP-005')
      expect(el).toHaveAttribute('data-tone', t)
      expect(el).toHaveClass('cm-badge')
    }
    expect(screen.getByText('운영진에게만 보임')).toHaveClass('cm-ops-chip')
  })

  it('범위 루트는 전달한 클래스를 함께 붙인다', () => {
    render(<ClubMatchScope data-testid="s2" className="flex" />)
    expect(screen.getByTestId('s2')).toHaveClass('cm', 'flex')
  })
})

describe('청백전 자산 파생본(VD-052·058)', () => {
  const webp = (rel: string) => {
    const b = fs.readFileSync(path.join(root, rel))
    expect(b.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(b.subarray(8, 12).toString('ascii')).toBe('WEBP')
    return b
  }
  it('배너·월계수 WebP가 있고 경로가 자산 모듈과 같다', () => {
    expect(CLUBMATCH_BANNER_URL.endsWith('clubmatch/banner-1200.webp')).toBe(true)
    expect(CLUBMATCH_LAUREL_URL.endsWith('clubmatch/laurel-160.webp')).toBe(true)
    expect(webp('frontend/public/clubmatch/banner-1200.webp').length).toBeLessThan(120 * 1024)
    expect(webp('frontend/public/clubmatch/laurel-160.webp').length).toBeLessThan(30 * 1024)
  })
})
