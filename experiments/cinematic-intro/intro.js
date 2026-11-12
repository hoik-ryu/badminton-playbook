// SMAPSH 시네마틱 인트로 PoC 타임라인(Web Animations API, 의존성 없음).
// 모든 애니메이션은 같은 길이(TOTAL)이고 키프레임 offset으로 시점을 정합니다 → 건너뛰기(finish)·다시 재생·시점 고정(seek)이 한 번에 됩니다.
import { markIntroSeen, shouldPlayIntro } from './policy.js'

const TOTAL = 4100 // ms. 몽타주 0–3.0초, 로고 강조 3.0–3.8초(0.8초), 밝은 로그인 전환 3.8–4.1초
export const PHASES = [
  ['shuttle', 0], ['smash', 700], ['split', 1400], ['racket', 2300], ['logo', 3000], ['toLogin', 3800], ['end', TOTAL],
]
const LOAD_TIMEOUT = 2500

const $ = (s) => document.querySelector(s)
const intro = $('#intro'), login = $('#login'), status = $('#status')
const params = new URLSearchParams(location.search)
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

const log = []
let t0 = performance.now(), anims = [], raf = 0, running = false, active = false // running: 단계 기록 중, active: 인트로가 화면에 있음
const note = (event, extra = {}) => log.push({ event, t: Math.round(performance.now() - t0), ...extra })
window.__intro = { log, PHASES, TOTAL, seek, skip, play: () => start('replay') }

// [ms, 값, 다음 구간 easing] 목록 → 한 속성의 키프레임
function track(el, prop, frames) {
  const kf = frames.map(([ms, v, easing]) => {
    const k = { offset: Math.min(1, Math.max(0, ms / TOTAL)), [prop]: v }
    if (easing) k.easing = easing
    return k
  })
  if (kf[0].offset > 0) kf.unshift({ offset: 0, [prop]: kf[0][prop] })
  if (kf.at(-1).offset < 1) kf.push({ offset: 1, [prop]: kf.at(-1)[prop] })
  anims.push(el.animate(kf, { duration: TOTAL, fill: 'both' }))
}
const T = (sel, prop, frames) => document.querySelectorAll(sel).forEach((el) => track(el, prop, frames))
const OUT = 'cubic-bezier(.15,.7,.2,1)', SNAP = 'cubic-bezier(.2,.85,.2,1)', WIPE = 'cubic-bezier(.7,0,.2,1)'

function build() {
  // 1컷 셔틀콕 클로즈업: 강한 줌아웃 + 오른쪽→왼쪽 패닝, 모션 블러가 걷힘
  T('.s1', 'opacity', [[0, 0, 'ease-out'], [90, 1], [700, 1], [790, 0]])
  T('.s1', 'transform', [[0, 'scale(1.38) translate(9%, 2%) rotate(-2deg)', OUT], [790, 'scale(1.06) translate(-5%, -1%) rotate(1deg)']])
  T('.s1', 'filter', [[0, 'blur(8px) brightness(1.4)', 'ease-out'], [220, 'blur(0px) brightness(1)']])
  // 2컷 스매시: 오른쪽에서 대각선 와이프, 올려다보는 줌인, 타격 순간 짧은 플래시 1회
  T('.s2', 'opacity', [[690, 0], [700, 1], [1440, 1], [1460, 0]])
  T('.s2', 'clipPath', [[700, 'polygon(130% 0%, 130% 0%, 130% 100%, 160% 100%)', WIPE], [880, 'polygon(-30% 0%, 130% 0%, 130% 100%, 0% 100%)']])
  T('.s2', 'transform', [[700, 'scale(1.1) translate(3%, 4%) rotate(2deg)', 'cubic-bezier(.3,.6,.3,1)'], [1460, 'scale(1.24) translate(-2%, -3%) rotate(-1deg)']])
  T('.s2', 'filter', [[1160, 'brightness(1) contrast(1)', 'ease-out'], [1200, 'brightness(1.25) contrast(1.1)', 'ease-in'], [1360, 'brightness(1) contrast(1)']])
  T('.s2 .flash', 'opacity', [[1170, 0, 'ease-out'], [1200, 0.28, 'ease-in'], [1300, 0]])
  // 3컷 복식: 위(선수 클로즈업)는 왼쪽에서, 아래(복식 경기)는 오른쪽에서 대각선으로 밀려 들어오고 경계에 네온
  T('.s3', 'opacity', [[1400, 0], [1410, 1], [2340, 1], [2440, 0]])
  T('.s3 .top', 'transform', [[1400, 'translateX(-105%)', SNAP], [1600, 'translateX(0%)'], [2440, 'translateX(-5%)']])
  T('.s3 .top img', 'transform', [[1400, 'scale(1.25)'], [2440, 'scale(1.1)']])
  T('.s3 .bottom', 'transform', [[1480, 'translateX(105%)', SNAP], [1680, 'translateX(0%)'], [2440, 'translateX(4%)']])
  T('.s3 .bottom img', 'transform', [[1480, 'scale(1.1)'], [2440, 'scale(1.25)']])
  T('.s3 .neon', 'opacity', [[1560, 0], [1640, 1], [2300, 1], [2400, 0]])
  T('.s3 .neon', 'transform', [[1560, 'scaleX(0)', SNAP], [1740, 'scaleX(1)']])
  // 4컷 라켓 클로즈업: 크로스페이드 + 회전하며 줌아웃
  T('.s4', 'opacity', [[2300, 0, 'ease-out'], [2440, 1], [2980, 1], [3040, 0]])
  T('.s4', 'transform', [[2300, 'scale(1.42) rotate(-6deg) translate(4%, 0)', OUT], [3040, 'scale(1.06) rotate(0deg) translate(-2%, 0)']])
  T('.s4', 'filter', [[2300, 'blur(6px)', 'ease-out'], [2480, 'blur(0px)']])
  // 빛의 궤적(장면마다 대각선으로 스침)
  for (const [sel, a, b, top] of [['.t1', 60, 560], ['.t2', 180, 680], ['.t5', 1650, 2150], ['.t3', 2380, 2880]]) {
    T(sel, 'opacity', [[a - 1, 0], [a, 1], [b - 80, 1, 'ease-in'], [b, 0]])
    T(sel, 'transform', [[a, 'rotate(-24deg) translateX(-110%)', 'cubic-bezier(.5,0,.3,1)'], [b, 'rotate(-24deg) translateX(110%)']])
    void top
  }
  // 5컷 로고(3.0–3.8초, 0.8초 강조): 청록 폭발광 → 로고 튀어나옴 → 글자 간격이 조여지며 등장 → 빛 맥동
  T('.s5', 'opacity', [[2980, 0], [3000, 1]])
  T('.s5 .burst', 'opacity', [[3000, 0.9, 'ease-out'], [3200, 0]])
  T('.s5 .wave', 'opacity', [[3000, 0], [3200, 1]])
  T('.s5 .wave', 'transform', [[3000, 'translateX(-15%) rotate(-4deg)'], [3800, 'translateX(6%) rotate(-4deg)']])
  // 빛줄기가 왼쪽 아래에서 날아와 심볼의 속도 궤적 꼬리에 닿고(3.0–3.12), 그 지점부터 심볼이 궤적 방향(왼→오)으로 그려짐
  T('.mark__trail', 'opacity', [[3000, 0], [3020, 1], [3140, 1, 'ease-out'], [3300, 0]])
  T('.mark__trail', 'transform', [[3000, 'rotate(-14deg) translateX(-90%)', 'cubic-bezier(.4,0,.2,1)'], [3120, 'rotate(-14deg) translateX(0%)']])
  T('.mark__symbol', 'opacity', [[3090, 0], [3130, 1]])
  T('.mark__symbol', 'clipPath', [[3100, 'inset(0% 100% 0% 0%)', 'cubic-bezier(.3,.7,.2,1)'], [3320, 'inset(0% 0% 0% 0%)']])
  T('.mark__symbol', 'transform', [[3100, 'translate(-4%, 5%) scale(.92)', 'cubic-bezier(.2,1.3,.4,1)'], [3340, 'translate(0, 0) scale(1)']])
  // 워드마크: 기울어진 채 왼쪽에서 미끄러져 들어오며 선명해지고, 마지막에 반짝임이 글자 위를 지나감
  T('.mark__wordmark', 'opacity', [[3180, 0], [3300, 1]])
  T('.mark__wordmark', 'transform', [[3180, 'translateX(-14%) skewX(-14deg)', 'cubic-bezier(.2,.85,.2,1)'], [3420, 'translateX(0) skewX(0deg)']])
  T('.mark__wordmark', 'filter', [[3180, 'blur(6px)', 'ease-out'], [3380, 'blur(0px)']])
  T('.mark__glint', 'opacity', [[3440, 0], [3460, 1], [3720, 1], [3760, 0]])
  T('.mark__glint', 'backgroundPosition', [[3460, '100% 0', 'ease-in-out'], [3740, '0% 0']])
  T('.mark__lockup', 'transform', [[3300, 'scale(1)'], [3800, 'scale(1.04)']])
  T('.s5 .halo', 'opacity', [[3100, 0, 'ease-out'], [3350, 0.95, 'ease-in-out'], [3580, 0.55, 'ease-in-out'], [3800, 0.9]])
  T('.s5 .halo', 'transform', [[3100, 'scale(.6)'], [3800, 'scale(1.15)']])
  T('.mark__sub', 'opacity', [[3320, 0], [3520, 1]])
  T('.mark__sub', 'transform', [[3320, 'translateY(8px)'], [3520, 'translateY(0px)']])
  // 밝은 로그인으로: 흰 빛이 차오른 뒤 인트로가 걷히고 로그인 로고·제목이 자리 잡음
  T('.whiteout', 'opacity', [[3780, 0, 'cubic-bezier(.3,.6,.4,1)'], [3940, 1]])
  T('#intro', 'opacity', [[3940, 1, 'ease-out'], [TOTAL, 0]])
  T('.login__brand', 'transform', [[3900, 'scale(.94)', 'ease-out'], [TOTAL, 'scale(1)']])
}

function phaseLoop() {
  let i = 0
  const tick = () => {
    if (!running) return
    const ct = anims[0]?.currentTime ?? 0
    while (i < PHASES.length - 1 && ct >= PHASES[i][1]) note('phase', { phase: PHASES[i][0], at: Math.round(ct) }), i++
    raf = requestAnimationFrame(tick)
  }
  tick()
}

function finish(result) {
  const hadFocus = intro.contains(document.activeElement) || document.activeElement === document.body
  running = false
  active = false
  cancelAnimationFrame(raf)
  intro.hidden = true
  login.inert = false
  login.removeAttribute('aria-hidden')
  const labels = { done: `재생 완료 · ${((performance.now() - t0) / 1000).toFixed(2)}초`, skipped: '건너뜀', reduced: '움직임 줄이기 설정 → 인트로 생략', fallback: '이미지 로딩 실패 → 인트로 생략', policy: '최초 방문 정책 → 생략' }
  status.textContent = labels[result] ?? result
  document.documentElement.dataset.introResult = result
  if (hadFocus) $('#login-title').focus({ preventScroll: true }) // 숨겨진 건너뛰기 버튼에 포커스가 남지 않게
  note('end', { result })
  if (params.get('policy') === 'first-visit' && result !== 'fallback') markIntroSeen(localStorage)
}

function reset() {
  anims.forEach((a) => a.cancel())
  anims = []
}

function loadImages() {
  const imgs = [...intro.querySelectorAll('img')]
  if (params.has('fail')) imgs[1].src = 'assets/__missing__.jpg' // 로딩 실패 시험용
  const all = Promise.all(imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode())))
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), LOAD_TIMEOUT))
  return Promise.race([all, timeout])
}

async function start(trigger) {
  reset()
  t0 = performance.now()
  log.length = 0
  note('start', { trigger })
  if (reduced.matches) return finish('reduced')
  if (trigger === 'load' && params.get('policy') === 'first-visit') {
    const p = shouldPlayIntro({ pathname: '/', reducedMotion: reduced.matches, storage: localStorage })
    note('policy', p)
    if (!p.play) return finish('policy')
  }
  intro.hidden = false
  login.inert = true
  login.setAttribute('aria-hidden', 'true')
  status.textContent = '재생 중'
  try {
    await loadImages()
  } catch (e) {
    note('load-failed', { error: String(e.message || e) })
    return finish('fallback')
  }
  note('loaded')
  t0 = performance.now()
  build()
  running = true
  active = true
  $('#skip').focus({ preventScroll: true })
  phaseLoop()
  anims[0].finished.then(() => running && finish('done')).catch(() => {})
}

function skip() {
  if (!active) return
  note('skip', { at: Math.round(anims[0].currentTime) })
  running = false
  anims.forEach((a) => a.finish())
  finish('skipped')
}

// 검증용: 모든 애니메이션을 ms 시점에 멈춤
function seek(ms) {
  running = false
  anims.forEach((a) => { a.pause(); a.currentTime = ms })
}

$('#skip').addEventListener('click', skip)
addEventListener('keydown', (e) => e.key === 'Escape' && skip())
$('#replay').addEventListener('click', () => start('replay'))
start('load')
