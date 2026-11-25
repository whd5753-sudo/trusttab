import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import WalletButton from "./WalletButton.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import useOnline from "../state/useOnline.js";

export const SOURCE_URL = "https://github.com/whd5753-sudo/trusttab";

// 머리글 · 메뉴 · 바닥글은 여기 한 곳에만 두고, 화면마다 바뀌는 가운데는 <Outlet />
// 11단계(일반 사이트처럼): 본문 바로가기 · 화면이 바뀌면 맨 위로 · 인터넷 끊김 안내 · 오류 화면 · 약관 링크
export default function Layout() {
  const { pathname } = useLocation();
  const online = useOnline();
  const mainRef = useRef(null);
  const first = useRef(true);

  // 다른 화면으로 가면 맨 위에서 시작하고, 화면 낭독기 · 키보드 사용자가 새 본문부터 읽도록 본문에 초점
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="header">
        <div className="header-top">
          <Link to="/" className="brand">
            TrustTab
          </Link>
          <WalletButton />
        </div>
        <p>결제한 손님만 쓰는 공정한 리뷰</p>
        <nav className="nav" aria-label="주 메뉴">
          {/* end: 홈 메뉴가 모든 주소에서 강조되지 않도록 */}
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/stores">가게 목록</NavLink>
          <NavLink to="/owner">사장님</NavLink>
        </nav>
      </header>

      {!online && (
        <p className="offline-banner" role="status">
          인터넷 연결이 끊겼습니다. 다시 연결되면 블록체인 리뷰를 불러올 수 있습니다.
        </p>
      )}

      <main id="main" ref={mainRef} tabIndex={-1}>
        {/* 화면 하나에서 오류가 나도 머리글 · 메뉴는 살아 있게. 주소가 바뀌면 오류 화면도 초기화 */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <p>TrustTab · Sepolia 테스트넷 실습용 · 가게 · 리뷰는 예시 데이터 · 실제 돈은 오가지 않습니다</p>
        <nav className="footer-links" aria-label="바닥글 메뉴">
          <Link to="/admin">관리자: 보류 리뷰 검토</Link>
          <Link to="/owner">사장님: 결제 기록</Link>
          <Link to="/terms">이용약관</Link>
          <Link to="/privacy">개인정보처리방침</Link>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            소스 코드(GitHub)
          </a>
        </nav>
        <p className="small">© 2026 TrustTab (구 FairReview) · 건양대 스마트보안학과 Web3.0 프로젝트</p>
      </footer>
    </div>
  );
}
