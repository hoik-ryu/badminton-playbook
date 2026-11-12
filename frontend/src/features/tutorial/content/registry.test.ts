import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { PASS_DENOMINATOR, PASS_NUMERATOR } from '../engine/logic'
import { LEVELS, STAGES } from './stages'

// D4: 서버는 스테이지 id·난이도·상황 수만 압니다(backend/app/modules/tutorial/stage_registry.json).
// 프런트 시나리오(stages.ts)를 바꾸면 이 테스트가 서버 레지스트리와 어긋남을 알려 줍니다(배포 전 둘 다 갱신).
type Registry = { passNumerator: number; passDenominator: number; stages: { id: string; level: string; situations: number }[] }
const registryPath = path.resolve(__dirname, '../../../../../backend/app/modules/tutorial/stage_registry.json')

describe('tutorial stage registry (FE content ↔ BE registry)', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Registry

  it('every playable stage and its situation count match the server registry exactly', () => {
    const playable = STAGES.filter((s) => LEVELS.find((l) => l.id === s.level)?.available)
    const fe = playable.map((s) => ({ id: s.id, level: s.level, situations: s.situations.length })).sort((a, b) => a.id.localeCompare(b.id))
    const be = [...registry.stages].sort((a, b) => a.id.localeCompare(b.id))
    expect(fe).toEqual(be)
  })

  it('pass threshold (70%) is the same on both sides', () => {
    expect([registry.passNumerator, registry.passDenominator]).toEqual([PASS_NUMERATOR, PASS_DENOMINATOR])
  })
})
