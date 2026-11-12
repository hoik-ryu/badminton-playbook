import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./index.css";
import { Scr211Roster } from "./screens/Scr211Roster";

// 검토용: ?safe=34 로 기기 안전 영역(iPhone 가정값)을 흉내 냄. 실제 기기는 env(safe-area-inset-bottom)
const safe = new URLSearchParams(location.search).get("safe");
if (safe) document.documentElement.style.setProperty("--safe-bottom", `${Number(safe)}px`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Scr211Roster />
  </StrictMode>,
);
