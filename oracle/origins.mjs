// 11단계: 오라클 서버에 요청할 수 있는 화면 주소 (브라우저가 보내는 Origin 과 글자 그대로 같아야 한다)
// - TrustTab 개발 주소 http://trusttab.localhost:5173 (npm run dev) · :4173 (npm run preview)
// - 예전 주소 http://localhost:5173 도 당분간 허락
// - 배포 주소 GitHub Pages (저장소 이름이 바뀌어도 Origin 은 https://whd5753-sudo.github.io 로 같다)
export const ALLOWED_ORIGINS = [
  "http://trusttab.localhost:5173",
  "http://trusttab.localhost:4173",
  "http://localhost:5173",
  "http://localhost:4173",
  "https://whd5753-sudo.github.io",
];

/** 정확히 같은 주소만 허락 (앞부분만 같은 가짜 주소 · 다른 포트는 거절) */
export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
