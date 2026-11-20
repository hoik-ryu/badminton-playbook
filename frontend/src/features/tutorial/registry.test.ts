import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PASS_DENOMINATOR, PASS_NUMERATOR } from './progress'
import { MOCK_REGISTRY, MOCK_STAGE_META } from './mockRegistry'

// 서버 스테이지 레지스트리(backend/app/modules/tutorial/stage_registry.json, PRD r7 ASM-033·034)와
// 프런트 Mock 사본이 같은지 확인합니다(Mock 모드의 진행 기록·운영진 현황이 서버와 같은 과정·스테이지를 쓰도록).
// (변경 2026-11-19) 예전에는 프런트 시나리오(stages.ts)와 서버 레지스트리를 비교했지만, 콘텐츠를 서버 JSON으로 옮기기로
// 결정(docs/workflow-proposals/tutorial-mvp-implementation-plan.md D-T1)해 비교 대상을 Mock 레지스트리로 바꿨습니다.
// 서버 콘텐츠 ↔ 레지스트리 정합성은 백엔드 테스트(AC-117, 2단계)가 맡습니다.
type Registry = typeof MOCK_REGISTRY
const registryPath = path.resolve(__dirname, '../../../../backend/app/modules/tutorial/stage_registry.json')

describe('tutorial stage registry (FE mock ↔ BE registry)', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Registry & { comment?: string }

  it('courses and stages match the server registry exactly', () => {
    expect(MOCK_REGISTRY.courses).toEqual(registry.courses)
    expect(MOCK_REGISTRY.stages).toEqual(registry.stages)
  })

  it('stage list info (title, minutes, thumbnail) matches the server content files', () => {
    const dir = path.resolve(__dirname, '../../../../backend/app/modules/tutorial/content')
    const server = Object.fromEntries(
      registry.stages.map((st) => {
        const c = JSON.parse(fs.readFileSync(path.join(dir, `${st.id}.json`), 'utf8')) as { title: string; minutes: number; thumbnail: string | null }
        return [st.id, { title: c.title, minutes: c.minutes, thumbnail: c.thumbnail }]
      }),
    )
    expect(MOCK_STAGE_META).toEqual(server)
  })

  it('Mock judging content (mock/content/*.json) is an exact copy of the server content', () => {
    const be = path.resolve(__dirname, '../../../../backend/app/modules/tutorial/content')
    const fe = path.resolve(__dirname, './mock/content')
    const names = (d: string) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort()
    expect(names(fe)).toEqual(names(be))
    for (const f of names(be)) expect(JSON.parse(fs.readFileSync(path.join(fe, f), 'utf8'))).toEqual(JSON.parse(fs.readFileSync(path.join(be, f), 'utf8')))
  })

  it('pass threshold (70%) is the same on both sides', () => {
    expect([registry.passNumerator, registry.passDenominator]).toEqual([PASS_NUMERATOR, PASS_DENOMINATOR])
    expect([MOCK_REGISTRY.passNumerator, MOCK_REGISTRY.passDenominator]).toEqual([PASS_NUMERATOR, PASS_DENOMINATOR])
  })
})
