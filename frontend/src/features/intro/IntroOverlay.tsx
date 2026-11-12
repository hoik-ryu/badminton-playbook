import { useEffect, useRef, useState } from "react";

import symbolUrl from "../../assets/brand/smapsh-symbol.svg";
import cut1 from "./assets/v4/cut1-shuttle.jpg";
import cut2 from "./assets/v4/cut2-smash.jpg";
import cut3 from "./assets/v4/cut3-player.jpg";
import cut4 from "./assets/v4/cut4-doubles.jpg";
import cut5 from "./assets/v4/cut5-celebrate.jpg";
import { buildIntro } from "./timeline";
import "./intro.css";

// 시네마틱 인트로(Brand Experience 영역, 실험 범위). 재생 여부는 introPolicy.ts가 정합니다(최초 방문 1회).
// - 라우팅·인증·API는 건드리지 않고, 현재 화면 위에 덮었다가 사라짐(PC는 가운데 600px 열 안, 모바일은 전체).
// - 사진: 사용자 제공 6컷 보드(2026-11-12, 운영진 사진 포함)에서 잘라낸 1차 시안(컷당 약 834×309 가로 원본 → 세로 화면에서 확대됨).
//   고해상도 컷별 원본을 받으면 assets/v4/ 같은 이름으로 교체. 보드 원본: experiments/cinematic-intro/assets/source/storyboard-v4-6cut.png
//   순서: ① 셔틀콕 → ② 스매시 → ③ 선수(위)·④ 복식(아래) 대각선 분할 → ⑤ 두 사람 환호 → ⑥ 로고
//   ①②⑤는 원본 세로 해상도가 낮아(306px) 화면 가운데 '띠'로 보여 주고 같은 사진을 흐린 배경으로 깔아 확대를 줄임(③④는 반 화면이라 채움)
// - 로고: 브랜드 v4 심볼(src/assets/brand/smapsh-symbol.svg, 로그인과 같은 파일) + 'SMAPSH' 글자(이미지 속 로고는 쓰지 않고 실제 자산으로 그림)
const LOAD_TIMEOUT_MS = 2500;

export type IntroResult = "done" | "skipped" | "failed";

export default function IntroOverlay({
  onFinish,
}: {
  onFinish?: (result: IntroResult) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof root.animate !== "function") {
      setOpen(false);
      onFinish?.("failed");
      return;
    }
    let anims: Animation[] = [];
    let done = false;
    const close = (result: IntroResult) => {
      if (done) return;
      done = true;
      anims.forEach((a) => a.finish());
      setOpen(false);
      onFinish?.(result);
    };
    const skip = () => close("skipped");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    root
      .querySelector<HTMLButtonElement>(".skip")
      ?.addEventListener("click", skip);

    const imgs = Array.from(root.querySelectorAll("img"));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS),
    );
    Promise.race([Promise.all(imgs.map((img) => img.decode())), timeout])
      .then(() => {
        if (done) return;
        anims = buildIntro(root);
        root
          .querySelector<HTMLButtonElement>(".skip")
          ?.focus({ preventScroll: true });
        anims[0]?.finished.then(
          () => close("done"),
          () => {},
        );
      })
      .catch(() => close("failed")); // 로딩 실패·시간 초과 → 바로 원래 화면(본 것으로 기록하지 않음)

    return () => {
      done = true;
      window.removeEventListener("keydown", onKey);
      anims.forEach((a) => a.cancel());
    };
  }, [onFinish]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="smapsh-intro"
      role="region"
      aria-label="SMAPSH 인트로"
      data-intro
    >
      <div className="shot s1 band">
        <img className="band__bg" src={cut1} alt="" />
        <img className="band__fg" src={cut1} alt="" />
      </div>
      <div className="shot s2 band">
        <img className="band__bg" src={cut2} alt="" />
        <img className="band__fg" src={cut2} alt="" />
        <div className="flash" />
      </div>
      <div className="shot s3">
        <div className="half top">
          <img src={cut3} alt="" />
        </div>
        <div className="half bottom">
          <img src={cut4} alt="" />
        </div>
        <div className="neon-wrap">
          <div className="neon soft" />
        </div>
        <div className="neon sharp" />
      </div>
      <div className="shot s4 band band--wide">
        <img className="band__bg" src={cut5} alt="" />
        <img className="band__fg" src={cut5} alt="" />
      </div>
      <div className="shot s5">
        <div className="burst" />
        <div className="wave w1" />
        <div className="wave w2" />
        <div className="halo" />
        <div className="mark">
          <div className="mark__lockup">
            <i className="mark__trail" />
            <img className="mark__symbol" src={symbolUrl} alt="" />
            <div className="mark__word">
              <span className="mark__wordmark">SMAPSH</span>
              <span className="mark__glint" aria-hidden="true">
                SMAPSH
              </span>
            </div>
          </div>
          <p className="mark__sub">BADMINTON CLUB PLATFORM</p>
        </div>
      </div>
      <div className="trails" aria-hidden="true">
        <i className="trail t1" />
        <i className="trail t2" />
        <i className="trail t3" />
        <i className="trail t5" />
      </div>
      <div className="vignette" />
      <button type="button" className="skip">
        건너뛰기
      </button>
    </div>
  );
}
