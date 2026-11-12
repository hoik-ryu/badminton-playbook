import { useCallback, useEffect, useState } from 'react'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { TextField } from '../components/TextField'
import { useToast } from '../components/toastContext'
import { listRoleMembers, setAdmin, type RoleMember } from '../features/roles/api'
import { waGwa } from '../lib/josa'

// SCR-232 역할 관리(/ops/roles, 슈퍼 관리자만 — 운영진은 가드에서 SCR-004, 메뉴도 숨김. 서버도 거부 AC-009). US-004, FLOW-002-S1·S1a·S2, AC-008, UXD-018
// - 역할별 묶음(슈퍼 관리자·운영진 / 회원), 이름 + 역할 배지(글자). 슈퍼 관리자 행은 행동 없음
// - '운영진 지정'·'운영진 해제'(보조 버튼) → 확인 창 → 반영·묶음 이동·토스트
// - ST1 / ST2 행 스켈레톤 / ST3 검색 결과 없음 "'○○'와 일치하는 회원이 없습니다" / ST4 블록 오류·변경 실패 안내 상자
// - PC: 목록 한 열(최대 너비 720px)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; list: RoleMember[] }
type Pending = { member: RoleMember; toAdmin: boolean }

export function RolesPage() {
  const toast = useToast()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'ok', list: await listRoleMembers() })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const q = query.trim()
  const list = load.kind === 'ok' ? load.list.filter((m) => !q || m.name.includes(q)) : []
  const staff = list.filter((m) => m.role !== 'member')
  const members = list.filter((m) => m.role === 'member')

  const apply = async () => {
    if (!pending) return
    const { member, toAdmin } = pending
    setNotice(null)
    try {
      await setAdmin(member.id, toAdmin)
      toast(toAdmin ? `${member.name} 님을 운영진으로 지정했습니다` : `${member.name} 님을 운영진에서 해제했습니다`)
    } catch {
      setNotice('역할을 바꾸지 못했습니다. 목록을 새로 불러왔습니다')
    }
    await refresh()
  }

  const row = (m: RoleMember) => (
    <li key={m.id} data-member={m.id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-body font-bold text-ink">{m.name}</span>
      {m.role !== 'member' && <Badge tone="info">{m.role === 'superAdmin' ? '슈퍼 관리자' : '운영진'}</Badge>}
      {m.role === 'admin' && (
        <Button variant="secondary" size="md" onClick={() => setPending({ member: m, toAdmin: false })}>
          운영진 해제
        </Button>
      )}
      {m.role === 'member' && (
        <Button variant="secondary" size="md" onClick={() => setPending({ member: m, toAdmin: true })}>
          운영진 지정
        </Button>
      )}
    </li>
  )
  const group = (label: string, items: RoleMember[]) =>
    items.length > 0 && (
      <>
        <div role="heading" aria-level={2} className="flex h-8 items-center bg-surface px-4 text-caption font-bold text-ink-muted">
          {label}
        </div>
        <ul aria-label={label} className="m-0 list-none p-0">
          {items.map(row)}
        </ul>
      </>
    )

  const st = load.kind === 'loading' ? 'SCR-232-ST2' : load.kind === 'error' || notice ? 'SCR-232-ST4' : list.length === 0 ? 'SCR-232-ST3' : 'SCR-232-ST1'
  return (
    <section data-scr="SCR-232" data-st={st} className="flex w-full max-w-[720px] flex-col">
      <PageHeader title="역할 관리" leading="back" backTo="/ops" />
      <div className="flex flex-col gap-3 px-4 pt-2 pb-3">
        {notice && <NoticeBox tone="danger">{notice}</NoticeBox>}
        <TextField label="이름 검색" hideLabel type="search" placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {load.kind === 'loading' && <StateView kind="loading" rows={5} label="회원 목록을 불러오는 중" />}
      {load.kind === 'error' && (
        <StateView
          kind="error"
          title="회원 목록을 불러오지 못했습니다"
          description="네트워크 상태를 확인하고 다시 시도해 주세요"
          action={
            <Button variant="secondary" fullWidth onClick={() => { setLoad({ kind: 'loading' }); void refresh() }}>
              다시 시도
            </Button>
          }
        />
      )}
      {load.kind === 'ok' && list.length === 0 && <StateView kind="empty" title={q ? `'${q}'${waGwa(q).slice(q.length)} 일치하는 회원이 없습니다` : '승인된 회원이 없습니다'} />}
      {load.kind === 'ok' && list.length > 0 && (
        <>
          {group('슈퍼 관리자 · 운영진', staff)}
          {group('회원', members)}
        </>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? (pending.toAdmin ? `${pending.member.name} 님을 운영진으로 지정할까요?` : `${pending.member.name} 님을 운영진에서 해제할까요?`) : ''}
        confirmLabel={pending?.toAdmin ? '지정' : '해제'}
        onConfirm={apply}
      />
    </section>
  )
}
