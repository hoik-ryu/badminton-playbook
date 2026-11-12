import { decideIntroForWindow, type IntroDecision } from './introPolicy'

// 앱 진입 시점의 인트로 결정. 라우터가 '/'를 다른 경로로 리다이렉트하기 전에 계산해야 하므로
// main.tsx가 라우터보다 먼저 import합니다(ES 모듈은 import 순서대로 평가).
export const initialIntroDecision: IntroDecision = decideIntroForWindow()
