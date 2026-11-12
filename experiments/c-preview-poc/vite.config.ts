import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// 실험 PoC 전용. 상위 폴더(frontend/, design-preview/)를 참조하지 않음
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 55190, strictPort: true, fs: { allow: [__dirname] } },
});
