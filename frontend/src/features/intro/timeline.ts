// SMAPSH 시네마틱 인트로 타임라인(개발 빌드 전용 확인용). experiments/cinematic-intro/intro.js의 장면 정의를 옮긴 것입니다.
// 정식 반영 전 상태: 승인 UX Spec에 인트로 화면이 없어(①) 운영 빌드에는 포함하지 않습니다.
// 2026-11-12 사용자 요청: 확대 줄이고 장면을 길게, 로고는 오래 머물다 잔상처럼 사라짐(4.1초 → 8초)
export const INTRO_TOTAL_MS = 8000

type Frame = [ms: number, value: string | number, easing?: string]

const OUT = 'cubic-bezier(.15,.7,.2,1)'
const SNAP = 'cubic-bezier(.2,.85,.2,1)'
const WIPE = 'cubic-bezier(.7,0,.2,1)'

function track(el: Element, prop: string, frames: Frame[]): Animation {
  const kf: Keyframe[] = frames.map(([ms, v, easing]) => {
    const k: Keyframe = { offset: Math.min(1, Math.max(0, ms / INTRO_TOTAL_MS)), [prop]: v }
    if (easing) k.easing = easing
    return k
  })
  const first = kf[0]
  const last = kf[kf.length - 1]
  if (first && (first.offset ?? 0) > 0) kf.unshift({ offset: 0, [prop]: first[prop] })
  if (last && (last.offset ?? 1) < 1) kf.push({ offset: 1, [prop]: last[prop] })
  return el.animate(kf, { duration: INTRO_TOTAL_MS, fill: 'both' })
}

/** root 안의 장면 요소에 애니메이션을 겁니다. 첫 번째 애니메이션의 finished가 전체 종료입니다. */
export function buildIntro(root: HTMLElement): Animation[] {
  const anims: Animation[] = []
  const T = (sel: string, prop: string, frames: Frame[]) => {
    const els = sel === ':root' ? [root] : Array.from(root.querySelectorAll(sel))
    els.forEach((el) => anims.push(track(el, prop, frames)))
  }
  // ① 셔틀콕(0–1.25초)
  T('.s1', 'opacity', [[0, 0, 'ease-out'], [120, 1], [1150, 1], [1250, 0]])
  T('.s1', 'transform', [[0, 'scale(1.12) translate(4%, 1%) rotate(-1deg)', OUT], [1250, 'scale(1) translate(-2%, 0) rotate(0.5deg)']])
  T('.s1', 'filter', [[0, 'blur(6px) brightness(1.3)', 'ease-out'], [300, 'blur(0px) brightness(1)']])
  // ② 스매시(1.15–2.4초, 플래시 1회)
  T('.s2', 'opacity', [[1140, 0], [1150, 1], [2300, 1], [2400, 0]])
  T('.s2', 'clipPath', [[1150, 'polygon(130% 0%, 130% 0%, 130% 100%, 160% 100%)', WIPE], [1360, 'polygon(-30% 0%, 130% 0%, 130% 100%, 0% 100%)']])
  T('.s2', 'transform', [[1150, 'scale(1.04) translate(1%, 2%) rotate(1deg)', 'cubic-bezier(.3,.6,.3,1)'], [2400, 'scale(1.1) translate(-1%, -1%) rotate(-0.5deg)']])
  T('.s2', 'filter', [[1760, 'brightness(1) contrast(1)', 'ease-out'], [1800, 'brightness(1.22) contrast(1.08)', 'ease-in'], [1960, 'brightness(1) contrast(1)']])
  T('.s2 .flash', 'opacity', [[1770, 0, 'ease-out'], [1800, 0.25, 'ease-in'], [1900, 0]])
  // ③ 선수(위)·④ 복식(아래) 대각선 분할(2.3–3.75초)
  T('.s3', 'opacity', [[2300, 0], [2310, 1], [3650, 1], [3750, 0]])
  T('.s3 .top', 'transform', [[2300, 'translateX(-105%)', SNAP], [2520, 'translateX(0%)'], [3750, 'translateX(-3%)']])
  T('.s3 .top img', 'transform', [[2300, 'scale(1.08)'], [3750, 'scale(1)']])
  T('.s3 .bottom', 'transform', [[2400, 'translateX(105%)', SNAP], [2620, 'translateX(0%)'], [3750, 'translateX(3%)']])
  T('.s3 .bottom img', 'transform', [[2400, 'scale(1)'], [3750, 'scale(1.08)']])
  T('.s3 .neon', 'opacity', [[2480, 0], [2560, 1], [3600, 1], [3700, 0]])
  T('.s3 .neon', 'transform', [[2480, 'scaleX(0)', SNAP], [2680, 'scaleX(1)']])
  // ⑤ 두 사람 환호(3.65–4.9초)
  T('.s4', 'opacity', [[3650, 0, 'ease-out'], [3800, 1], [4800, 1], [4900, 0]])
  T('.s4', 'transform', [[3650, 'scale(1.1) rotate(-2deg) translate(2%, 0)', OUT], [4900, 'scale(1) rotate(0deg) translate(-1%, 0)']])
  T('.s4', 'filter', [[3650, 'blur(5px)', 'ease-out'], [3850, 'blur(0px)']])
  // 빛의 궤적
  const trails: [string, number, number][] = [['.t1', 60, 760], ['.t2', 200, 900], ['.t5', 2550, 3150], ['.t3', 3700, 4300]]
  for (const [sel, a, b] of trails) {
    T(sel, 'opacity', [[a - 1, 0], [a, 1], [b - 80, 1, 'ease-in'], [b, 0]])
    T(sel, 'transform', [[a, 'rotate(-24deg) translateX(-110%)', 'cubic-bezier(.5,0,.3,1)'], [b, 'rotate(-24deg) translateX(110%)']])
  }
  // ⑥ 로고(4.8초~): 빛줄기 → 심볼의 속도 궤적 꼬리 → 심볼 → 워드마크 → 반짝임 → 약 2초 머묾 → 잔상처럼 흐려지며 사라짐(6.9–7.9초)
  const L = 4800
  T('.s5', 'opacity', [[L - 20, 0], [L, 1]])
  T('.s5 .burst', 'opacity', [[L, 0.9, 'ease-out'], [L + 220, 0]])
  T('.s5 .wave', 'opacity', [[L, 0], [L + 220, 1], [6900, 1, 'ease-in'], [7800, 0]])
  T('.s5 .wave', 'transform', [[L, 'translateX(-15%) rotate(-4deg)'], [7900, 'translateX(10%) rotate(-4deg)']])
  T('.mark__trail', 'opacity', [[L, 0], [L + 20, 1], [L + 140, 1, 'ease-out'], [L + 300, 0]])
  T('.mark__trail', 'transform', [[L, 'rotate(-14deg) translateX(-90%)', 'cubic-bezier(.4,0,.2,1)'], [L + 120, 'rotate(-14deg) translateX(0%)']])
  T('.mark__symbol', 'opacity', [[L + 90, 0], [L + 130, 1]])
  T('.mark__symbol', 'clipPath', [[L + 100, 'inset(0% 100% 0% 0%)', 'cubic-bezier(.3,.7,.2,1)'], [L + 340, 'inset(0% 0% 0% 0%)']])
  T('.mark__symbol', 'transform', [[L + 100, 'translate(-4%, 5%) scale(.92)', 'cubic-bezier(.2,1.3,.4,1)'], [L + 360, 'translate(0, 0) scale(1)']])
  T('.mark__wordmark', 'opacity', [[L + 200, 0], [L + 330, 1]])
  T('.mark__wordmark', 'transform', [[L + 200, 'translateX(-14%) skewX(-14deg)', SNAP], [L + 450, 'translateX(0) skewX(0deg)']])
  T('.mark__wordmark', 'filter', [[L + 200, 'blur(6px)', 'ease-out'], [L + 410, 'blur(0px)']])
  T('.mark__glint', 'opacity', [[L + 480, 0], [L + 500, 1], [L + 820, 1], [L + 860, 0]])
  T('.mark__glint', 'backgroundPosition', [[L + 500, '100% 0', 'ease-in-out'], [L + 840, '0% 0']])
  T('.s5 .halo', 'opacity', [[L + 100, 0, 'ease-out'], [L + 380, 0.95, 'ease-in-out'], [L + 700, 0.6, 'ease-in-out'], [L + 1100, 0.9], [6900, 0.9, 'ease-in'], [7900, 0]])
  T('.s5 .halo', 'transform', [[L + 100, 'scale(.6)'], [6900, 'scale(1.15)'], [7900, 'scale(1.45)']])
  T('.mark__sub', 'opacity', [[L + 340, 0], [L + 560, 1], [6800, 1, 'ease-in'], [7500, 0]])
  T('.mark__sub', 'transform', [[L + 340, 'translateY(8px)'], [L + 560, 'translateY(0px)']])
  // 머무는 동안 아주 천천히 커지고, 끝에서 커지며 흐려져 잔상처럼 사라짐
  T('.mark__lockup', 'transform', [[L + 330, 'scale(1)'], [6900, 'scale(1.05)', 'cubic-bezier(.3,0,.6,1)'], [7900, 'scale(1.14)']])
  T('.mark__lockup', 'filter', [[6900, 'blur(0px) brightness(1)', 'ease-in'], [7900, 'blur(12px) brightness(1.4)']])
  T('.mark__lockup', 'opacity', [[6900, 1, 'ease-in'], [7900, 0]])
  // 로그인 화면이 비쳐 보이며 전환(밝은 번쩍임 없이)
  T(':root', 'opacity', [[7200, 1, 'ease-in-out'], [INTRO_TOTAL_MS, 0]])
  return anims
}
