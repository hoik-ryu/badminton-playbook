import type { Frame } from './engine/types'

// CMP-046 TutorialCourt — 04: 세로 2D 탑뷰 코트(내 편이 아래, UXD-064), 선수·셔틀콕. 색은 04 코트 토큰(color.court.*)
// - 단순 도형(SVG)이라 인앱 브라우저에서도 가볍게 그림(AC-095). 좌표는 엔진 단위(가로 61 × 세로 134, 네트 y=67)
// - 접근성: 그림 전체에 상황 설명을 대체 글자로(role=img). 재생 중 누르면 결과까지 건너뜀(onSkip)
type Props = { frame: Frame | null; label: string; playing?: boolean; onSkip?: () => void }

const W = 61
const H = 134
const NET = 67

function Player({ at, fill, text, me = false }: { at: readonly [number, number]; fill: string; text: string; me?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      {me && <circle r={5.2} fill="none" stroke="var(--color-court-line)" strokeWidth={1.2} />}
      <circle r={3.6} fill={fill} stroke="var(--color-court-line)" strokeWidth={0.6} />
      <text y={me ? 9.6 : 8.4} textAnchor="middle" fontSize={me ? 4.2 : 3.6} fontWeight={700} fill="var(--color-court-line)">
        {text}
      </text>
    </g>
  )
}

export function TutorialCourt({ frame, label, playing = false, onSkip }: Props) {
  return (
    <div
      data-cmp="CMP-046"
      data-playing={playing ? 'true' : 'false'}
      onClick={playing ? onSkip : undefined}
      className="flex min-h-0 flex-1 items-center justify-center"
    >
      <svg role="img" aria-label={label} viewBox={`-5 -5 ${W + 10} ${H + 10}`} className="h-full max-h-full w-auto max-w-full rounded-md" preserveAspectRatio="xMidYMid meet">
        <rect x={-5} y={-5} width={W + 10} height={H + 10} rx={3} fill="var(--color-court-surface)" />
        <g fill="none" stroke="var(--color-court-line)" strokeWidth={0.5} opacity={0.9}>
          <rect x={0} y={0} width={W} height={H} />
          <line x1={4.6} y1={0} x2={4.6} y2={H} />
          <line x1={W - 4.6} y1={0} x2={W - 4.6} y2={H} />
          <line x1={0} y1={7.6} x2={W} y2={7.6} />
          <line x1={0} y1={H - 7.6} x2={W} y2={H - 7.6} />
          <line x1={0} y1={NET - 19.8} x2={W} y2={NET - 19.8} />
          <line x1={0} y1={NET + 19.8} x2={W} y2={NET + 19.8} />
          <line x1={W / 2} y1={0} x2={W / 2} y2={NET - 19.8} />
          <line x1={W / 2} y1={NET + 19.8} x2={W / 2} y2={H} />
        </g>
        <line x1={-3} y1={NET} x2={W + 3} y2={NET} stroke="var(--color-court-line)" strokeWidth={1.4} />
        {frame && (
          <>
            <Player at={frame.opp1} fill="var(--color-court-opponent)" text="상대" />
            <Player at={frame.opp2} fill="var(--color-court-opponent)" text="상대" />
            <Player at={frame.partner} fill="var(--color-court-me)" text="파트너" />
            <Player at={frame.me} fill="var(--color-court-me)" text="나" me />
            <g transform={`translate(${frame.shuttle[0]} ${frame.shuttle[1]})`} data-shuttle>
              <circle r={1.9} fill="var(--color-court-line)" stroke="var(--color-text-primary)" strokeWidth={0.5} />
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
