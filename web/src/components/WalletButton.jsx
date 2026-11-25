import { getProvider, shortAddress, useWallet } from "../state/WalletContext.jsx";

// 11단계: 지갑이 없을 때 갈 곳 — 휴대폰은 MetaMask 앱 안에서 이 페이지 열기, PC 는 설치 페이지
function walletHelp() {
  if (typeof window === "undefined" || getProvider()) return null;
  const mobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  if (mobile) {
    const here = window.location.host + window.location.pathname + window.location.search;
    return { href: `https://metamask.app.link/dapp/${here}`, label: "MetaMask 앱에서 열기" };
  }
  return { href: "https://metamask.io/download/", label: "MetaMask 설치하기" };
}

// 머리글 오른쪽: 연결 전 '지갑 연결', 연결 후 0x1234…abcd + 포인트 + 연결 끊기
// 8단계: Sepolia 가 아니면 'Sepolia 로 전환' 버튼, Sepolia 면 내 포인트 표시
// 11단계: 지갑이 없으면 설치(PC) · 앱에서 열기(휴대폰) 링크
export default function WalletButton() {
  const { account, isSepolia, connect, disconnect, switchToSepolia, points, error } = useWallet();

  return (
    <div className="wallet">
      {account ? (
        <>
          <span className="address" title={account}>
            {shortAddress(account)}
          </span>
          {isSepolia && points !== null && <span className="points">포인트 {points}P</span>}
          <button type="button" className="wallet-button" onClick={disconnect}>
            연결 끊기
          </button>
        </>
      ) : (
        <button type="button" className="wallet-button" onClick={connect}>
          지갑 연결
        </button>
      )}
      {account && !isSepolia && (
        <p className="wallet-warning" role="alert">
          Sepolia 로 바꿔 주세요{" "}
          <button type="button" className="link-like" onClick={switchToSepolia}>
            Sepolia 로 전환
          </button>
        </p>
      )}
      {error && (
        <p className="wallet-warning" role="alert">
          {error}
        </p>
      )}
      {error && walletHelp() && (
        <a className="wallet-help" href={walletHelp().href} target="_blank" rel="noreferrer">
          {walletHelp().label}
        </a>
      )}
    </div>
  );
}
