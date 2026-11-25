import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 11단계: 서비스 이름 TrustTab · 주소 정리 · 일반 사이트 기능 (docs/화면설계.md 6절)
//
// 주소
// - 내 컴퓨터(npm run dev):  http://trusttab.localhost:5173/
//   *.localhost 는 Edge · Chrome 이 알아서 내 컴퓨터로 연결한다 (hosts 파일 수정 필요 없음)
// - GitHub Pages(Actions 빌드): https://<계정>.github.io/<저장소 이름>/
//   저장소 이름은 Actions 가 알려 주는 GITHUB_REPOSITORY 에서 읽는다
//   → 저장소 이름을 trusttab 으로 바꾸면 주소도 자동으로 /trusttab/ 이 된다
const DEV_PORT = 5173;
const DEV_HOST = "trusttab.localhost";
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
const onPages = Boolean(owner && repo);
const userSite = onPages && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`; // <계정>.github.io 저장소는 주소 맨 앞

const base = process.env.VITE_BASE ?? (onPages && !userSite ? `/${repo}/` : "/");
const SITE_URL =
  process.env.VITE_SITE_URL ??
  (onPages ? `https://${owner.toLowerCase()}.github.io${base}` : `http://${DEV_HOST}:${DEV_PORT}/`);

// 오라클 서버 주소 (보안 정책에서 이 주소로만 요청을 허락한다)
const ORACLE_URL = process.env.VITE_ORACLE_URL ?? "http://localhost:8787";
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// 배포 화면의 보안 정책(CSP): 이 사이트 · 공개 노드 · 내 컴퓨터 오라클 말고는 아무 데도 접속하지 않는다.
// (개발 서버는 화면 새로 고침용 스크립트가 필요해 빌드에만 넣는다. MetaMask 확장 프로그램은 영향 없음)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${PUBLIC_RPC} ${ORACLE_URL} http://127.0.0.1:8787`,
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

// 검색 · 공유용 파일 (robots.txt · sitemap.xml) — 페이지 목록은 docs/라우팅설계.md 1절
const PAGES = ["", "stores", "stores/1", "stores/2", "stores/3", "owner", "terms", "privacy"];

function trustTabSite() {
  return {
    name: "trusttab-site",
    // index.html 의 %SITE_URL% 를 실제 주소로, 빌드일 때만 보안 정책 넣기
    transformIndexHtml(html, ctx) {
      let out = html.replaceAll("%SITE_URL%", SITE_URL);
      if (!ctx.server) {
        out = out.replace(
          "<!-- CSP -->",
          `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        );
      }
      return out;
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\nDisallow: ${base}admin\n\nSitemap: ${SITE_URL}sitemap.xml\n`,
      });
      const urls = PAGES.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
    // npm run dev 를 켜면 TrustTab 주소를 맨 위에 보여 준다
    configureServer(server) {
      const print = server.printUrls.bind(server);
      server.printUrls = () => {
        server.config.logger.info(`\n  TrustTab  ➜  http://${DEV_HOST}:${server.config.server.port}${base}\n`);
        print();
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), trustTabSite()],
  base,
  define: {
    __SITE_URL__: JSON.stringify(SITE_URL),
  },
  server: {
    port: DEV_PORT,
    strictPort: true, // 5173 이 이미 쓰이면 다른 번호로 몰래 바꾸지 않고 알려 준다 (오라클이 이 주소만 허락함)
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // 자주 안 바뀌는 라이브러리를 따로 묶어 두면 재방문 때 다시 받지 않는다
        advancedChunks: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: "ethers", test: /node_modules[\\/](ethers|@noble|@adraffy|aes-js|tslib)[\\/]/ },
          ],
        },
      },
    },
  },
  // 6단계: 화면 테스트(React Testing Library)는 브라우저 흉내(jsdom)에서 돌린다
  test: {
    environment: "jsdom",
  },
});
