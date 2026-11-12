import type { Choice, Formation, Level, Pt, Situation, Stage, Verdict } from '../engine/types'

// ⚠ 검수 전 초안(개발용) — 운영진·코치 검수가 필요합니다(C-22, ASM-023 미해결).
// 승인 문서에는 시나리오 본문이 없고 "기획자가 초안을 만들고 운영진(또는 코치)이 검수한 데이터로 배포"로만 정해져 있어,
// 화면·로직 개발을 위해 UXD-062의 주제(입문자: 서브·리시브 기본 위치와 대기 자세 / 왕초보: Top & Back·Side by Side 기본 대형)로 임시 작성했습니다.
// 검수 후 이 파일의 데이터만 바꾸면 됩니다(로직·화면은 그대로, NFR-009). 편집 화면은 없습니다(C-22).
export const CONTENT_STATUS = 'draft-unreviewed' as const

export const LEVELS: Level[] = [
  { id: 'beginner', name: '입문자', available: true },
  { id: 'novice', name: '왕초보', available: true },
  { id: 'intermediate', name: '초보', available: false },
  { id: 'advanced', name: 'D조 이상', available: false },
]

// ── 좌표 도우미(가로 0–61, 세로 0–134, 네트 y=67, 위쪽 상대·아래쪽 내 편) ──
const P = (x: number, y: number): Pt => [x, y]
// 내 편 자리
const FC = P(30, 78), FR = P(44, 80) // 앞(가운데·오른쪽)
const ML = P(16, 100), MC = P(30, 100), MR = P(45, 100) // 가운데
const BL = P(15, 124), BC = P(30, 122), BR = P(46, 124) // 뒤
// 상대 편 바닥(득점 지점)과 랠리가 이어지는 지점
const OPP_BACK_L = P(10, 10), OPP_BACK_R = P(51, 10), OPP_FRONT_L = P(18, 56), OPP_FRONT_R = P(43, 56), OPP_MID = P(30, 34)
// 상대 대형
const OPP_TB = { opp1: P(30, 52), opp2: P(30, 18) } // 앞뒤(공격)
const OPP_SBS = { opp1: P(17, 30), opp2: P(44, 30) } // 나란히(수비)
const OPP_SERVE = { opp1: P(25, 48), opp2: P(30, 20) } // 서브·리턴 직후

const f = (me: Pt, partner: Pt, opp: { opp1: Pt; opp2: Pt }): Formation => ({ me, partner, ...opp })

type C = [label: string, verdict: Verdict, to: Pt, reason: string, partnerTo?: Pt]
type Def = Omit<Situation, 'id' | 'choices' | 'hitter' | 'win' | 'keep'> & { hitter?: 'me' | 'partner'; win?: Pt; keep?: Pt; choices: C[] }

function stage(level: Stage['level'], no: number, title: string, defs: Def[]): Stage {
  const id = `${level}-${no}`
  return {
    id,
    level,
    no,
    title,
    situations: defs.map((d, i): Situation => ({
      ...d,
      id: `${id}-s${i + 1}`,
      hitter: d.hitter ?? 'me',
      win: d.win ?? OPP_BACK_R,
      keep: d.keep ?? OPP_MID,
      choices: d.choices.map(([label, verdict, to, reason, partnerTo], j): Choice => ({ id: `${id}-s${i + 1}-c${j + 1}`, label, verdict, to, reason, ...(partnerTo ? { partnerTo } : {}) })),
    })),
  }
}

export const STAGES: Stage[] = [
  // ── 튜토리얼 난이도 · 입문자 ──
  stage('beginner', 1, '서브 후 내 자리', [
    {
      prompt: '내가 짧게 서브했고, 상대가 네트 앞으로 짧게 넘겼습니다.',
      start: f(P(36, 86), MC, OPP_SERVE), from: P(25, 48), pause: P(32, 66), contact: P(33, 76), win: OPP_FRONT_L,
      better: '서브한 사람이 그대로 앞으로 나가 네트 앞 공을 바로 처리하는 것이 좋아요.',
      choices: [['앞으로', 'correct', P(33, 79), '짧은 서브 뒤에는 서버가 앞을 맡아요. 바로 앞으로 나가 처리했어요.'], ['위치 유지', 'acceptable', P(36, 86), '늦게 닿아 공을 높이 띄울 수밖에 없었어요.'], ['뒤로', 'wrong', P(36, 104), '앞이 비어 공이 그대로 떨어졌어요. 짧은 서브 뒤에는 앞을 지켜요.']],
    },
    {
      prompt: '내가 짧게 서브했고, 상대가 내 머리 위 뒤쪽으로 밀어 넘겼습니다.',
      start: f(P(36, 86), MC, OPP_SERVE), from: P(25, 48), pause: P(36, 84), contact: P(38, 120), hitter: 'partner', win: OPP_BACK_L,
      better: '뒤쪽 공은 파트너에게 맡기고 나는 앞을 지키면 더 안전해요.',
      choices: [['위치 유지', 'correct', P(34, 82), '뒤쪽은 파트너가 맡고 나는 앞을 지켰어요. 앞뒤 대형이 됐어요.', P(38, 118)], ['뒤로', 'wrong', P(37, 116), '파트너와 겹치고 앞이 비었어요. 뒤쪽 공은 파트너가 맡아요.', P(30, 104)], ['옆으로', 'acceptable', P(46, 88), '앞을 조금 비웠지만 파트너가 받아 넘겼어요.', P(38, 118)]],
    },
    {
      prompt: '파트너가 짧게 서브했고, 나는 뒤에 있습니다. 상대가 뒤쪽 깊게 넘겼습니다.',
      start: f(MC, P(36, 86), OPP_SERVE), from: P(25, 48), pause: P(32, 86), contact: P(28, 122),
      better: '서브 뒤 뒤쪽 공은 뒤에 있는 내가 바로 뒤로 가서 치면 공격으로 이어져요.',
      choices: [['뒤로', 'correct', P(29, 121), '뒤를 맡은 내가 바로 뒤로 가서 공격했어요.'], ['위치 유지', 'acceptable', MC, '늦게 따라가 수비적으로만 넘겼어요.'], ['앞으로', 'wrong', P(32, 84), '파트너와 앞에서 겹치고 뒤가 비었어요.']],
    },
    {
      prompt: '파트너가 서브했고, 상대가 내 오른쪽 옆 가운데로 빠르게 넘겼습니다.',
      start: f(MC, P(36, 86), OPP_SERVE), from: P(25, 48), pause: P(36, 80), contact: P(48, 100), win: OPP_FRONT_L,
      better: '옆으로 한 걸음 옮겨 몸 앞에서 치면 더 세게 넘길 수 있어요.',
      choices: [['오른쪽으로', 'correct', P(46, 100), '옆으로 옮겨 몸 앞에서 받아 쳤어요.'], ['위치 유지', 'acceptable', MC, '팔만 뻗어 겨우 넘겼어요.'], ['앞으로', 'wrong', FC, '옆을 비워 공이 빠져나갔어요.']],
    },
    {
      prompt: '내가 높고 길게 서브했고, 상대가 내 쪽(오른쪽)으로 스매시합니다.',
      start: f(P(36, 86), MC, { opp1: P(25, 40), opp2: P(40, 14) }), from: P(40, 14), pause: P(44, 72), contact: P(45, 102), win: OPP_FRONT_L,
      better: '높은 서브 뒤에는 바로 내 쪽 수비 자리로 물러나 나란히 서요.',
      choices: [['뒤로', 'correct', P(45, 100), '높은 서브 뒤 수비 자리로 물러나 스매시를 받았어요.', ML], ['위치 유지', 'acceptable', P(36, 86), '앞에서 막아 겨우 넘겼어요. 조금 더 뒤에 있으면 편해요.', ML], ['앞으로', 'wrong', FR, '앞으로 나가 스매시가 몸 뒤로 지나갔어요.']],
    },
  ]),
  stage('beginner', 2, '리시브 자리', [
    {
      prompt: '상대가 나에게 짧게 서브했습니다.',
      start: f(P(40, 88), P(20, 106), { opp1: P(22, 52), opp2: P(30, 20) }), from: P(22, 52), pause: P(32, 66), contact: P(36, 77), win: OPP_FRONT_L,
      better: '짧은 서브는 앞으로 바로 붙어 높은 곳에서 받으면 공격할 수 있어요.',
      choices: [['앞으로', 'correct', P(36, 79), '앞으로 붙어 높은 곳에서 받아 눌렀어요.'], ['위치 유지', 'acceptable', P(40, 88), '낮은 곳에서 받아 띄워 줬어요.'], ['뒤로', 'wrong', P(40, 108), '물러나는 사이 공이 앞에 떨어졌어요.']],
    },
    {
      prompt: '상대가 나에게 높고 길게 서브했습니다.',
      start: f(P(40, 88), P(20, 106), { opp1: P(22, 52), opp2: P(30, 20) }), from: P(22, 52), pause: P(40, 84), contact: P(42, 124),
      better: '높은 서브는 바로 뒤로 물러나 머리 위에서 쳐야 해요.',
      choices: [['뒤로', 'correct', P(42, 122), '뒤로 물러나 머리 위에서 공격했어요.'], ['위치 유지', 'wrong', P(40, 88), '공이 머리 위를 넘어 뒤에 떨어졌어요.'], ['앞으로', 'wrong', P(38, 78), '앞으로 나가 공을 완전히 놓쳤어요.']],
    },
    {
      prompt: '파트너가 짧은 서브를 받아 네트로 붙었습니다. 상대가 뒤쪽으로 넘깁니다.',
      start: f(P(40, 100), P(24, 80), { opp1: P(25, 52), opp2: P(36, 22) }), from: P(25, 52), pause: P(34, 86), contact: P(34, 122),
      better: '파트너가 앞으로 붙으면 나는 뒤 가운데로 가서 뒤쪽을 맡아요.',
      choices: [['뒤로', 'correct', P(34, 120), '파트너가 앞, 내가 뒤를 맡아 공격했어요.'], ['위치 유지', 'acceptable', P(40, 100), '조금 늦었지만 받아 넘겼어요.'], ['앞으로', 'wrong', P(36, 80), '둘 다 앞에 서서 뒤가 비었어요.']],
    },
    {
      prompt: '내가 리시브를 네트에 붙였는데, 상대가 높게 뒤로 띄웠습니다.',
      start: f(P(36, 78), P(24, 106), { opp1: P(30, 54), opp2: P(30, 20) }), from: P(30, 54), pause: P(34, 82), contact: P(26, 122), hitter: 'partner', win: OPP_BACK_L,
      better: '앞에 있는 나는 앞을 지키고, 뒤쪽 공은 파트너가 맡으면 앞뒤 대형이 돼요.',
      choices: [['위치 유지', 'correct', P(32, 80), '나는 앞을 지키고 파트너가 뒤에서 공격했어요.', P(27, 120)], ['뒤로', 'wrong', P(28, 118), '파트너와 겹치고 앞이 비었어요.', P(24, 110)], ['옆으로', 'acceptable', P(46, 82), '앞을 조금 벌렸지만 파트너가 넘겼어요.', P(27, 120)]],
    },
    {
      prompt: '내가 리시브를 상대 뒤쪽으로 높게 띄웠습니다. 상대가 내 쪽으로 스매시합니다.',
      start: f(P(38, 82), P(24, 100), { opp1: P(20, 40), opp2: P(42, 12) }), from: P(42, 12), pause: P(42, 74), contact: P(44, 102), win: OPP_FRONT_L,
      better: '높이 띄웠으면 둘이 나란히 수비 자리로 바로 물러나요.',
      choices: [['뒤로', 'correct', P(44, 100), '수비 자리로 물러나 스매시를 받았어요.', ML], ['위치 유지', 'acceptable', P(38, 82), '앞에서 겨우 막아 넘겼어요.', ML], ['앞으로', 'wrong', FR, '앞으로 나가 스매시를 피할 수 없었어요.']],
    },
  ]),
  stage('beginner', 3, '대기 자세와 복귀', [
    {
      prompt: '뒤쪽 구석에서 높게 넘긴 뒤 그대로 서 있습니다. 상대가 내 앞쪽 가운데로 떨어뜨립니다.',
      start: f(P(44, 122), P(18, 96), OPP_SBS), from: P(44, 30), pause: P(36, 66), contact: P(33, 80), win: OPP_FRONT_L,
      better: '치고 나면 바로 가운데로 돌아와 다음 공을 기다려요.',
      choices: [['앞으로', 'correct', P(33, 82), '가운데로 돌아오며 앞으로 나가 받았어요.'], ['위치 유지', 'wrong', P(44, 122), '구석에 남아 앞의 공에 닿지 못했어요.'], ['옆으로', 'acceptable', P(30, 110), '가운데로 돌아왔지만 늦어 높이 띄웠어요.']],
    },
    {
      prompt: '네트 앞에서 친 뒤 그대로 서 있습니다. 상대가 내 왼쪽 네트로 넘깁니다.',
      start: f(P(40, 78), P(30, 112), OPP_TB), from: P(30, 52), pause: P(24, 66), contact: P(18, 78), win: OPP_FRONT_R,
      better: '네트 앞에서는 라켓을 든 채 좌우로 바로 움직일 준비를 해요.',
      choices: [['왼쪽으로', 'correct', P(19, 78), '라켓을 든 채 옆으로 옮겨 바로 받았어요.'], ['위치 유지', 'wrong', P(40, 78), '제자리에 있어 공이 옆으로 빠졌어요.'], ['뒤로', 'wrong', P(40, 100), '물러나며 앞 공을 놓쳤어요.']],
    },
    {
      prompt: '나란히 수비 중입니다. 상대 스매시가 내 몸 쪽으로 옵니다.',
      start: f(P(45, 100), ML, OPP_SBS), from: P(44, 22), pause: P(45, 76), contact: P(45, 98), win: OPP_FRONT_L,
      better: '자세를 낮추고 라켓을 몸 앞에 두면 몸 쪽 스매시도 막을 수 있어요.',
      choices: [['위치 유지', 'correct', P(45, 100), '자세를 낮추고 라켓을 앞에 둬 막아 냈어요.'], ['뒤로', 'acceptable', P(45, 112), '물러나며 겨우 띄웠어요.'], ['옆으로', 'wrong', P(56, 100), '피하려다 공이 몸 옆에 떨어졌어요.']],
    },
    {
      prompt: '파트너가 뒤에서 치고 나는 앞에 있습니다. 상대가 내 오른쪽 네트로 크로스로 넘깁니다.',
      start: f(P(28, 80), P(18, 120), OPP_TB), from: P(30, 52), pause: P(38, 66), contact: P(44, 78), win: OPP_FRONT_L,
      better: '앞에 있는 사람이 좌우 네트를 모두 맡아요.',
      choices: [['오른쪽으로', 'correct', P(43, 78), '앞을 맡은 내가 옆으로 옮겨 처리했어요.'], ['위치 유지', 'wrong', P(28, 80), '옆으로 가지 않아 공이 떨어졌어요.'], ['뒤로', 'wrong', P(28, 104), '물러나며 앞이 비었어요.']],
    },
    {
      prompt: '우리가 높게 넘긴 뒤 상대가 내 앞쪽 대각선으로 떨어뜨립니다.',
      start: f(MR, ML, OPP_SBS), from: P(17, 30), pause: P(36, 64), contact: P(42, 80), win: OPP_FRONT_L,
      better: '대각선 앞 공은 먼 쪽 발을 앞으로 내밀며 바로 나가요.',
      choices: [['앞으로', 'correct', P(42, 82), '바로 앞으로 나가 높은 곳에서 받았어요.'], ['위치 유지', 'wrong', MR, '기다리는 사이 공이 앞에 떨어졌어요.'], ['뒤로', 'wrong', BR, '반대로 움직여 공을 놓쳤어요.']],
    },
  ]),
  // ── 튜토리얼 난이도 · 왕초보 ──
  stage('novice', 1, 'Top & Back(앞뒤 공격 대형)', [
    {
      prompt: '파트너가 뒤에서 스매시했고 나는 앞에 있습니다. 상대가 네트 앞으로 막아 냅니다.',
      start: f(FC, BC, OPP_SBS), from: P(17, 30), pause: P(28, 64), contact: P(28, 77), win: OPP_FRONT_R,
      better: '앞뒤 대형에서는 앞 사람이 네트 앞 공을 바로 눌러요.',
      choices: [['앞으로', 'correct', P(28, 78), '앞 사람인 내가 바로 눌러 득점했어요.'], ['위치 유지', 'acceptable', FC, '조금 늦어 낮게 넘기기만 했어요.'], ['뒤로', 'wrong', MC, '물러나며 앞이 비었어요.']],
    },
    {
      prompt: '파트너 스매시를 상대가 내 오른쪽 네트로 크로스로 넘겼습니다.',
      start: f(FC, BL, OPP_SBS), from: P(17, 30), pause: P(36, 64), contact: P(45, 78), win: OPP_FRONT_L,
      better: '앞 사람은 네트 좌우를 모두 맡아요. 크로스도 옆으로 바로 이동해요.',
      choices: [['오른쪽으로', 'correct', P(44, 78), '옆으로 옮겨 크로스를 처리했어요.'], ['위치 유지', 'wrong', FC, '제자리에서 공이 옆으로 빠졌어요.'], ['뒤로', 'wrong', MC, '물러나며 공을 놓쳤어요.']],
    },
    {
      prompt: '내가 뒤에서 스매시했고, 상대가 다시 뒤로 길게 띄웠습니다.',
      start: f(P(36, 116), FC, OPP_SBS), from: P(44, 30), pause: P(38, 86), contact: P(40, 122),
      better: '공격 중 다시 뒤로 온 공은 뒤 사람이 계속 공격해요.',
      choices: [['뒤로', 'correct', P(40, 120), '뒤에서 다시 공격해 득점했어요.'], ['위치 유지', 'acceptable', P(36, 116), '조금 늦어 높게 넘기기만 했어요.'], ['앞으로', 'wrong', P(36, 96), '앞으로 나가 뒤가 비었어요.']],
    },
    {
      prompt: '앞에 있는 내 머리 위로 상대가 중간 높이로 넘겼습니다.',
      start: f(FC, BC, OPP_SBS), from: P(44, 30), pause: P(32, 74), contact: P(32, 112), hitter: 'partner', win: OPP_BACK_L,
      better: '앞 사람이 무리하게 뒤로 가지 않고, 뒤 사람이 처리하게 두면 대형이 유지돼요.',
      choices: [['위치 유지', 'correct', FC, '나는 앞을 지키고 파트너가 공격했어요.', P(32, 112)], ['뒤로', 'wrong', P(32, 108), '파트너와 겹치고 앞이 비었어요.', BC], ['옆으로', 'acceptable', FR, '앞을 조금 벌렸지만 파트너가 넘겼어요.', P(32, 112)]],
    },
    {
      prompt: '상대가 내 왼쪽 사이드로 빠른 드라이브를 칩니다.',
      start: f(FC, BC, OPP_SBS), from: P(17, 30), pause: P(18, 66), contact: P(16, 84), win: OPP_FRONT_R,
      better: '앞 사람이 옆으로 옮겨 빠른 공을 끊으면 공격이 이어져요.',
      choices: [['왼쪽으로', 'correct', P(17, 84), '옆으로 옮겨 드라이브를 끊었어요.'], ['위치 유지', 'acceptable', FC, '팔만 뻗어 겨우 넘겼어요.'], ['오른쪽으로', 'wrong', FR, '반대쪽으로 움직여 놓쳤어요.']],
    },
  ]),
  stage('novice', 2, 'Side by Side(나란히 수비 대형)', [
    {
      prompt: '나란히 수비 중입니다. 상대가 내 쪽 사이드로 스매시합니다.',
      start: f(MR, ML, OPP_TB), from: P(30, 18), pause: P(44, 72), contact: P(46, 100), win: OPP_FRONT_L,
      better: '나란히 수비에서는 내 반쪽에 온 공을 내가 맡아요.',
      choices: [['위치 유지', 'correct', MR, '내 반쪽 자리에서 바로 받아 냈어요.'], ['앞으로', 'wrong', FR, '앞으로 나가 스매시가 뒤로 빠졌어요.'], ['뒤로', 'acceptable', BR, '물러나며 겨우 띄웠어요.']],
    },
    {
      prompt: '나란히 수비 중입니다. 상대가 내 앞쪽으로 떨어뜨립니다.',
      start: f(MR, ML, OPP_TB), from: P(30, 18), pause: P(40, 64), contact: P(42, 80), win: OPP_FRONT_L,
      better: '내 반쪽 앞 공은 내가 앞으로 나가 받아요.',
      choices: [['앞으로', 'correct', P(42, 82), '앞으로 나가 높은 곳에서 받았어요.'], ['위치 유지', 'wrong', MR, '기다리는 사이 공이 떨어졌어요.'], ['옆으로', 'wrong', P(30, 100), '가운데로 가며 앞을 놓쳤어요.']],
    },
    {
      prompt: '나란히 수비 중입니다. 상대가 파트너 쪽으로 스매시합니다.',
      start: f(MR, ML, OPP_TB), from: P(30, 18), pause: P(20, 72), contact: P(16, 100), hitter: 'partner', win: OPP_FRONT_R,
      better: '파트너 쪽 공은 파트너에게 맡기고 나는 내 반쪽을 지켜요.',
      choices: [['위치 유지', 'correct', MR, '내 반쪽을 지키고 파트너가 받았어요.', P(16, 100)], ['왼쪽으로', 'wrong', P(24, 100), '파트너 쪽으로 몰려 내 쪽이 비었어요.', ML], ['앞으로', 'acceptable', FR, '조금 앞으로 나갔지만 파트너가 받았어요.', P(16, 100)]],
    },
    {
      prompt: '나란히 수비 중입니다. 상대가 내 쪽 뒤로 높게 넘깁니다.',
      start: f(MR, ML, OPP_TB), from: P(30, 52), pause: P(42, 82), contact: P(46, 122),
      better: '내 반쪽 뒤 공은 내가 바로 뒤로 가서 쳐요.',
      choices: [['뒤로', 'correct', P(46, 120), '뒤로 가서 공격으로 바꿨어요.'], ['위치 유지', 'acceptable', MR, '늦게 따라가 수비적으로 넘겼어요.'], ['앞으로', 'wrong', FR, '앞으로 나가 뒤가 비었어요.']],
    },
    {
      prompt: '나란히 수비 중입니다. 상대가 우리 둘 사이 가운데로 칩니다(포핸드는 나).',
      start: f(MR, ML, OPP_TB), from: P(30, 18), pause: P(30, 76), contact: P(31, 100), win: OPP_FRONT_L,
      better: '가운데 공은 미리 정한 사람(보통 포핸드 쪽)이 맡아요.',
      choices: [['왼쪽으로', 'correct', P(33, 100), '가운데를 맡은 내가 옆으로 옮겨 받았어요.'], ['위치 유지', 'wrong', MR, '서로 미루다 가운데에 떨어졌어요.'], ['뒤로', 'wrong', BR, '물러나 가운데 공을 놓쳤어요.']],
    },
  ]),
  stage('novice', 3, '공격과 수비 전환', [
    {
      prompt: '나란히 수비 중 상대가 내 앞쪽 네트로 짧게 넘겼습니다.',
      start: f(MR, ML, OPP_SBS), from: P(44, 30), pause: P(40, 64), contact: P(40, 78), win: OPP_FRONT_L,
      better: '짧은 공을 앞에서 받으면 그대로 앞에 남아 공격 대형으로 바꿔요.',
      choices: [['앞으로', 'correct', P(40, 80), '앞으로 나가 받아 공격 대형으로 바꿨어요.'], ['위치 유지', 'wrong', MR, '기다리다 공이 떨어졌어요.'], ['옆으로', 'acceptable', P(32, 92), '가운데로 가다 늦게 받아 띄웠어요.']],
    },
    {
      prompt: '앞뒤 공격 중 파트너가 어쩔 수 없이 높게 띄웠습니다. 상대가 내 쪽으로 스매시합니다.',
      start: f(FC, BC, { opp1: P(20, 40), opp2: P(42, 12) }), from: P(42, 12), pause: P(42, 74), contact: P(44, 102), win: OPP_FRONT_L,
      better: '우리가 띄우면 앞 사람이 바로 물러나 나란히 수비로 바꿔요.',
      choices: [['뒤로', 'correct', P(44, 100), '물러나 나란히 수비로 바꿔 스매시를 받았어요.', ML], ['위치 유지', 'wrong', FC, '앞에 남아 스매시가 옆으로 빠졌어요.', BC], ['앞으로', 'wrong', P(30, 74), '더 앞으로 가 수비 자리가 비었어요.', BC]],
    },
    {
      prompt: '수비 중 내가 앞으로 나가 쳤고, 상대가 다시 뒤로 띄웠습니다.',
      start: f(P(40, 80), ML, OPP_SBS), from: P(17, 30), pause: P(30, 82), contact: P(24, 122), hitter: 'partner', win: OPP_BACK_R,
      better: '앞으로 나간 사람은 앞에 남고, 뒤 공은 파트너가 맡아 앞뒤 대형이 돼요.',
      choices: [['위치 유지', 'correct', P(34, 80), '나는 앞에 남고 파트너가 뒤에서 공격했어요.', P(24, 120)], ['뒤로', 'wrong', P(30, 116), '파트너와 겹쳐 앞이 비었어요.', ML], ['옆으로', 'acceptable', P(46, 84), '앞을 조금 벌렸지만 파트너가 넘겼어요.', P(24, 120)]],
    },
    {
      prompt: '앞뒤 공격 중 앞에 있던 내가 상대 반격을 높게 띄웠습니다.',
      start: f(FC, BC, { opp1: P(17, 34), opp2: P(44, 14) }), from: P(44, 14), pause: P(40, 72), contact: P(44, 100), win: OPP_FRONT_L,
      better: '띄운 사람도 바로 물러나 둘이 나란히 서야 해요.',
      choices: [['뒤로', 'correct', P(44, 100), '바로 물러나 나란히 수비로 받았어요.', ML], ['위치 유지', 'wrong', FC, '앞에 남아 스매시를 막지 못했어요.', BC], ['옆으로', 'acceptable', FR, '옆으로만 비켜 겨우 막았어요.', ML]],
    },
    {
      prompt: '수비 중 상대가 짧고 높게 넘겼습니다. 공격 기회입니다.',
      start: f(MR, ML, OPP_SBS), from: P(17, 30), pause: P(36, 66), contact: P(38, 84), win: OPP_FRONT_L,
      better: '짧고 높은 공은 앞으로 나가 높은 곳에서 눌러 공격으로 바꿔요.',
      choices: [['앞으로', 'correct', P(38, 86), '앞으로 나가 눌러 득점했어요.'], ['위치 유지', 'acceptable', MR, '기다렸다 쳐서 다시 넘기기만 했어요.'], ['뒤로', 'wrong', BR, '물러나 기회를 놓쳤어요.']],
    },
  ]),
]

export const stageById = (id: string) => STAGES.find((s) => s.id === id) ?? null
export const stagesOf = (level: Level['id']) => STAGES.filter((s) => s.level === level).sort((a, b) => a.no - b.no)
export const levelById = (id: Level['id']) => LEVELS.find((l) => l.id === id)!
/** 같은 난이도의 다음 스테이지(없으면 null) */
export const nextStageOf = (stage: Stage) => stagesOf(stage.level).find((s) => s.no === stage.no + 1) ?? null
