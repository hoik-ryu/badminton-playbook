# smapsh 컴포넌트(프리뷰 전용)

- shadcn/ui 부품(`../ui/`)에 넘기는 `className`의 글자 크기는 `text-[length:var(--font-size-*)]` 형식으로 씁니다. `text-body` 같은 프로젝트 이름은 `cn`(tailwind-merge)이 **색 클래스로 오인**해 `text-primary-foreground` 같은 색을 지웁니다(2026-11-11 측정에서 발견).
- shadcn 부품을 거치지 않는 일반 요소에는 `text-body`·`text-caption`을 그대로 씁니다.
