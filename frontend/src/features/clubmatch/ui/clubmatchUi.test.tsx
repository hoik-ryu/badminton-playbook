import fs from 'node:fs'
import path from 'node:path'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CLUBMATCH_BANNER_URL, CLUBMATCH_LAUREL_URL } from './assets'
import { ClubMatchBadge, ClubMatchScope, OpsOnlyChip, type ClubMatchBadgeTone } from './ClubMatchBadge'
import { ClubMatchHero } from './ClubMatchList'

// 청백전 자산·토큰·배지 기반 — Preview r6(DD r9 VD-049·052·053·058)의 승인 규칙과 같은지 확인
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

  // (Preview r6) 제품 코드는 design-preview를 참조하지 않습니다(preview-check 규칙). 같은 6개 값은 위 테스트가 공식 테마(theme.json)와 대조합니다.

  // (DD r9 Soft Mint) 청백전 범위 테마 덮어쓰기와 토큰 밖 채움색 #087F73(--cm-fill)은 폐지 — 앱 전체 tokens.css 한 벌.
  // 앱 전체 토큰 값과 승인 테마의 일치는 src/styles/tokens.test.ts(승인 해시 대조)가 검사합니다.
  it('청백전 스타일은 .cm 범위 안 규칙만 두고, 토큰 변수를 다시 정의하지 않는다', () => {
    const css = read('frontend/src/styles/clubmatch.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => (m[2] ?? '').trim())
    expect(selectors.length).toBeGreaterThan(10)
    for (const s of selectors) expect(s.startsWith('.cm'), s).toBe(true)
    expect(Object.keys(cssVars(css)).filter((v) => v.startsWith('--color-') || v === '--cm-fill')).toEqual([])
    expect(read('frontend/src/styles/tokens.css')).not.toContain('--cm-')
  })

  it('작은 흰 글자 채움(진행 중 배지·배너 배지)은 action.strong + onStrong, \'새 청백전\'은 큰 CTA 규칙(VD-049·053 r9)', () => {
    const css = read('frontend/src/styles/clubmatch.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const decl = (sel: string) => css.match(new RegExp(`${sel.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    expect(decl(".cm .cm-badge[data-tone='live']")).toMatch(/background: var\(--color-action-strong\); color: var\(--color-action-onStrong\)/)
    expect(decl('.cm .cm-hero-badge')).toMatch(/background: var\(--color-action-strong\); color: var\(--color-action-onStrong\)/)
    expect(decl('.cm .cm-create')).toMatch(/background: var\(--color-action-primary\); color: var\(--color-action-onPrimary\)/)
    expect(decl(".cm .cm-badge[data-tone='upcoming']")).toMatch(/background: var\(--color-accent-subtle\); color: var\(--color-text-accent\)/)
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

describe('청백전 자산 파생본(VD-052 r9·058)', () => {
  const webp = (rel: string) => {
    const b = fs.readFileSync(path.join(root, rel))
    expect(b.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(b.subarray(8, 12).toString('ascii')).toBe('WEBP')
    return b
  }
  it('배너·월계수 WebP가 있고 경로가 자산 모듈과 같다', () => {
    // AST-082(원본 전체 구도) 파생본 1316×539(1692×693과 같은 비율). 이전 AST-079·AST-080 파생본은 제거
    expect(CLUBMATCH_LAUREL_URL.endsWith('clubmatch/laurel-160.webp')).toBe(true)
    expect(CLUBMATCH_BANNER_URL.endsWith('clubmatch/banner-ast082-1316.webp')).toBe(true)
    const banner = webp('frontend/public/clubmatch/banner-ast082-1316.webp')
    expect(banner.length).toBeLessThan(120 * 1024)
    // VP8X 헤더의 캔버스 크기(24비트 리틀엔디언, 값+1): 1316×539 — 원본 1692×693과 비율 같음(1316·693 = 539·1692)
    const size = [banner.readUIntLE(24, 3) + 1, banner.readUIntLE(27, 3) + 1]
    expect(size).toEqual([1316, 539])
    expect(size[0]! * 693).toBe(size[1]! * 1692)
    for (const old of ['banner-1200.webp', 'banner-ast080-1200.webp']) expect(fs.existsSync(path.join(root, `frontend/public/clubmatch/${old}`)), old).toBe(false)
    expect(webp('frontend/public/clubmatch/laurel-160.webp').length).toBeLessThan(30 * 1024)
  })
})

describe('청백전 배너(CMP-051, VD-052 r11)', () => {
  it('이미지는 장식 img(alt 빈 값·aria-hidden)이고 제목·설명만 읽힌다', () => {
    render(<ClubMatchScope><ClubMatchHero /></ClubMatchScope>)
    const hero = screen.getByTestId('cm-hero')
    const img = hero.querySelector('img.cm-hero-img')!
    expect(img).toHaveAttribute('src', CLUBMATCH_BANNER_URL)
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(img).toHaveAttribute('data-asset', 'AST-082')
    expect(screen.queryByRole('img')).toBeNull() // 접근성 트리에 이미지 없음
    expect(hero).toHaveTextContent('우리 동호회의청팀 vs 백팀 대결')
    expect(hero.parentElement).toHaveClass('cm-hero-wrap') // 모서리 반경 계산용 크기 기준 감싸개
  })

  it('이미지를 불러오지 못하면 img를 숨기고 바탕·글자만 남긴다', () => {
    render(<ClubMatchScope><ClubMatchHero /></ClubMatchScope>)
    const hero = screen.getByTestId('cm-hero')
    fireEvent.error(hero.querySelector('img.cm-hero-img')!)
    expect(hero.querySelector('img')).toBeNull()
    expect(hero.querySelector('.cm-hero-art')).not.toBeNull()
    expect(hero).toHaveTextContent('기록과 랭킹을 함께 쌓아요.')
  })

  it('이미지 상자 비율은 원본(1692/693), 이음 그라데이션은 상자 안에서만 img 위(글자를 덮지 않음)', () => {
    const css = read('frontend/src/styles/clubmatch.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const art = css.match(/\.cm \.cm-hero-art \{([^}]*)\}/)?.[1] ?? ''
    expect(art).toMatch(/aspect-ratio: 1692 \/ 693/)
    expect(art).toMatch(/isolation: isolate/)
    expect(art).not.toMatch(/background/)
    expect(css).toMatch(/\.cm \.cm-hero-img \{[^}]*object-fit: contain/)
    expect(css).toMatch(/\.cm \.cm-hero-wrap \{ container-type: inline-size; \}/)
  })
})
