import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchPoints } from "../contracts/client.js";
import { EXPLORER, PUBLIC_RPC } from "../contracts/fairReview.js";

// 6단계: 지갑 연결 상태만 앱 전체에 나눠 준다 (자주 바뀌지 않는 값만).
// 8단계: Sepolia 전환 · 내 포인트를 더했다. 서명은 리뷰 제출 버튼에서만 요청한다.
// 11단계(일반 사이트처럼): 다시 방문하면 자동 연결 · 연결 끊기 기억 · Sepolia 자동 전환/추가 · 여러 지갑 중 MetaMask 고르기
// 개인키 · 니모닉은 다루지 않는다 (지갑 밖으로 나오지 않음).
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

// '연결 끊기'를 누른 사람에게는 다음 방문 때 자동으로 다시 붙이지 않는다 (이 브라우저에만 저장)
export const WALLET_PREF_KEY = "trusttab:wallet";

const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia",
  nativeCurrency: { name: "SepoliaETH", symbol: "SepoliaETH", decimals: 18 },
  rpcUrls: [PUBLIC_RPC],
  blockExplorerUrls: [EXPLORER],
};

const WalletContext = createContext(null);

// ---------- 지갑 찾기 (EIP-6963) ----------
// 확장 프로그램이 여러 개면 window.ethereum 을 서로 차지하려 한다.
// EIP-6963 으로 '나 여기 있어요' 라고 알린 지갑 중 MetaMask 를 먼저 쓰고, 없으면 window.ethereum 을 쓴다.
const announced = [];
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event?.detail;
    if (detail?.provider && !announced.some((d) => d.info?.uuid === detail.info?.uuid)) announced.push(detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function getProvider() {
  if (typeof window === "undefined") return undefined;
  const metamask = announced.find((d) => d.info?.rdns === "io.metamask");
  return metamask?.provider ?? window.ethereum ?? announced[0]?.provider;
}

function readPref() {
  try {
    return window.localStorage.getItem(WALLET_PREF_KEY);
  } catch {
    return null; // 사생활 보호 모드 등 저장소를 못 쓰면 '기억 없음'
  }
}

function writePref(value) {
  try {
    window.localStorage.setItem(WALLET_PREF_KEY, value);
  } catch {
    /* 저장 못 해도 연결 자체는 된다 */
  }
}

// 체인 전환 실패 원인이 '지갑에 Sepolia 가 없음(4902)' 인지
function isUnknownChain(e) {
  return e?.code === 4902 || e?.data?.originalError?.code === 4902;
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);
  const [points, setPoints] = useState(null);

  // 체인 · 계정 변경 이벤트를 듣고, 정리 함수에서 반드시 해제한다
  useEffect(() => {
    const ethereum = getProvider();
    if (!ethereum?.on) return undefined;

    let active = true;
    // 체인 id 는 권한 없이 읽을 수 있는 값 — 경고 표시용
    ethereum
      .request({ method: "eth_chainId" })
      .then((id) => active && setChainId(id))
      .catch(() => {});

    // 11단계: 전에 이 사이트에 연결을 허락한 지갑이면 창을 띄우지 않고 바로 다시 연결한다.
    // eth_accounts 는 허락된 계정만 돌려주고, 허락이 없으면 빈 배열이다 (MetaMask 창 없음).
    if (readPref() !== "disconnected") {
      Promise.resolve()
        .then(() => ethereum.request({ method: "eth_accounts" }))
        .then((accounts) => {
          if (active && accounts?.[0]) setAccount(accounts[0]);
        })
        .catch(() => {});
    }

    function handleAccountsChanged(accounts) {
      // 화면에서 연결을 끊은 뒤에는 다시 붙이지 않는다
      setAccount((prev) => (prev ? (accounts?.[0] ?? null) : null));
    }
    function handleChainChanged(id) {
      setChainId(id);
    }

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      active = false;
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  // 8단계: MetaMask 에 Sepolia 로 바꿔 달라고 요청한다 (사용자가 MetaMask 창에서 승인)
  // 11단계: 지갑에 Sepolia 가 없으면 추가까지 요청한다
  const switchToSepolia = useCallback(async ({ quiet = false } = {}) => {
    const ethereum = getProvider();
    if (!ethereum?.request) {
      setError("MetaMask 가 필요합니다");
      return;
    }
    try {
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      } catch (e) {
        if (!isUnknownChain(e)) throw e;
        await ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_PARAMS] });
      }
      setError(null);
    } catch (e) {
      // 연결 직후 자동 전환에서 취소한 경우는 조용히 넘어간다 (머리글의 'Sepolia 로 바꿔 주세요' 가 대신 안내)
      if (quiet) return;
      setError(e?.code === 4001 ? "네트워크 전환을 취소했습니다" : "Sepolia 로 전환하지 못했습니다");
    }
  }, []);

  const connect = useCallback(async () => {
    const ethereum = getProvider();
    if (!ethereum?.request) {
      setError("MetaMask 가 필요합니다");
      return;
    }
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts?.[0] ?? null);
      setError(null);
      writePref("connected");
    } catch (e) {
      // 지갑이 준 메시지를 그대로 보여 주지 않고 정해진 문구만 쓴다
      setError(e?.code === 4001 ? "지갑 연결을 취소했습니다" : "지갑 연결에 실패했습니다");
      return;
    }
    // 11단계: 연결하자마자 Sepolia 가 아니면 바로 전환 창을 띄운다 (한 번만, 취소해도 오류 문구는 안 띄움)
    try {
      const id = await ethereum.request({ method: "eth_chainId" });
      setChainId(id);
      if (id !== SEPOLIA_CHAIN_ID) await switchToSepolia({ quiet: true });
    } catch {
      /* 체인을 못 읽으면 머리글 경고로 안내 */
    }
  }, [switchToSepolia]);

  // 8단계: 내 포인트 — 계정이 바뀌거나 리뷰를 제출한 뒤 다시 읽는다
  const refreshPoints = useCallback(async () => {
    if (!account) {
      setPoints(null);
      return;
    }
    try {
      setPoints(await fetchPoints(account));
    } catch {
      setPoints(null); // 포인트를 못 읽어도 다른 화면은 그대로 쓸 수 있다
    }
  }, [account]);

  useEffect(() => {
    refreshPoints();
  }, [refreshPoints]);

  // 화면 상태를 지우고, 다음 방문 때 자동 연결하지 않도록 기억한다.
  // 11단계: 지갑이 지원하면 이 사이트에 준 허락 자체도 거둔다 (MetaMask 의 wallet_revokePermissions)
  const disconnect = useCallback(() => {
    setAccount(null);
    setError(null);
    writePref("disconnected");
    const ethereum = getProvider();
    if (ethereum?.request) {
      Promise.resolve()
        .then(() => ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }))
        .catch(() => {});
    }
  }, []);

  const value = useMemo(
    () => ({
      account,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connect,
      disconnect,
      switchToSepolia,
      points,
      refreshPoints,
      error,
    }),
    [account, chainId, connect, disconnect, switchToSepolia, points, refreshPoints, error],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet 은 WalletProvider 안에서만 쓸 수 있습니다");
  return ctx;
}

/** 0x1234…abcd 처럼 앞 6 · 뒤 4 글자 */
export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
