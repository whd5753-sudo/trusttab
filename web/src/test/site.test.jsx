// 11단계 화면 테스트 — TrustTab 이름 · 지갑 자동 연결 · 사장님 결제 기록 · 리뷰 링크 · 약관 · 탭 제목 · 인터넷 끊김
// (docs/화면설계.md 6절 · docs/화면연결설계.md 6절 · docs/라우팅설계.md 7절). 블록체인 · 오라클은 가짜(mock).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "../App.jsx";
import { WALLET_PREF_KEY, WalletProvider, getProvider } from "../state/WalletContext.jsx";
import { fetchOwnedStoreIds, fetchRecentPayments, paymentIdFromReceipt, sendRecordPayment } from "../contracts/owner.js";
import { fetchOpsInfo, sendRegisterStore, sendSetPaused, storeIdFromReceipt } from "../contracts/admin.js";

vi.mock("../contracts/client.js", () => ({
  fetchPoints: vi.fn().mockResolvedValue(200),
  fetchPayment: vi.fn().mockResolvedValue(null),
  fetchStoreReviews: vi.fn().mockResolvedValue([]),
  fetchAdmin: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000001"),
  fetchHeldReviews: vi.fn().mockResolvedValue([]),
  requestVerdict: vi.fn(),
  sendReview: vi.fn(),
  sendResolveHeld: vi.fn(),
}));

// 사장님 화면: 주소 검사(normalizeCustomer)는 진짜 함수를 쓰고, 블록체인 읽기 · 쓰기만 가짜로
vi.mock("../contracts/owner.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    fetchOwnedStoreIds: vi.fn(),
    fetchRecentPayments: vi.fn(),
    sendRecordPayment: vi.fn(),
    paymentIdFromReceipt: vi.fn(),
  };
});

// 관리자 운영 화면: 주소 · 이름 검사는 진짜 함수, 블록체인만 가짜로
vi.mock("../contracts/admin.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    fetchOpsInfo: vi.fn(),
    sendRegisterStore: vi.fn(),
    sendSetPaused: vi.fn(),
    storeIdFromReceipt: vi.fn(),
  };
});

const CUSTOMER = "0x24fa47419CE55143138B2D615bD426AEe2c7f4d0"; // Account 1 (손님)
const OWNER = "0x8Dc9ee7b9843801769bC96F76048C9D367AA7c61"; // Account 2 (사장님)

// MetaMask 흉내. authorized = 이 사이트에 전에 연결을 허락한 계정 (eth_accounts 가 돌려줌)
function fakeMetaMask({ chainId = "0xaa36a7", account = CUSTOMER, authorized = [], switchError = null } = {}) {
  return {
    on: vi.fn(),
    removeListener: vi.fn(),
    request: vi.fn(async ({ method }) => {
      if (method === "eth_chainId") return chainId;
      if (method === "eth_accounts") return authorized;
      if (method === "eth_requestAccounts") return [account];
      if (method === "wallet_switchEthereumChain") {
        if (switchError) throw switchError;
        return null;
      }
      if (method === "wallet_addEthereumChain") return null;
      if (method === "wallet_revokePermissions") return null;
      throw new Error("unexpected " + method);
    }),
  };
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </MemoryRouter>,
  );
}

async function connectWallet() {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: "지갑 연결" })[0]);
  });
}

const methods = (eth) => eth.request.mock.calls.map(([arg]) => arg.method);

beforeEach(() => {
  window.localStorage.clear();
  fetchOwnedStoreIds.mockResolvedValue([1]);
  fetchRecentPayments.mockResolvedValue([]);
  sendRecordPayment.mockResolvedValue({ hash: "0xpay", wait: vi.fn().mockResolvedValue({ logs: [] }) });
  paymentIdFromReceipt.mockReturnValue(7);
  fetchOpsInfo.mockResolvedValue({
    admin: CUSTOMER, // 테스트에서는 Account 1 이 관리자
    paused: false,
    stores: [
      { id: 1, owner: OWNER, name: "온정 김치찌개" },
      { id: 4, owner: OWNER, name: "골목 떡볶이" },
    ],
  });
  sendRegisterStore.mockResolvedValue({ hash: "0xreg", wait: vi.fn().mockResolvedValue({ logs: [] }) });
  sendSetPaused.mockResolvedValue({ hash: "0xpause", wait: vi.fn().mockResolvedValue({}) });
  storeIdFromReceipt.mockReturnValue(5);
});

afterEach(() => {
  cleanup();
  delete window.ethereum;
  vi.clearAllMocks();
});

describe("이름 · 탭 제목", () => {
  it("S1. 머리글 로고와 홈 제목이 TrustTab 이다", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "TrustTab" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "TrustTab 은" })).toBeTruthy();
  });

  it("S2. 화면마다 브라우저 탭 제목이 바뀐다 (가게 상세 = 가게 이름 · TrustTab)", async () => {
    renderAt("/stores/1");
    await waitFor(() => expect(document.title).toBe("온정 김치찌개 · TrustTab"));
  });
});

describe("지갑 자동 연결", () => {
  it("S3. 전에 연결을 허락한 지갑이면 다시 방문했을 때 창 없이 자동 연결된다", async () => {
    window.ethereum = fakeMetaMask({ authorized: [CUSTOMER] });
    renderAt("/");
    expect(await screen.findByText("0x24fa…f4d0")).toBeTruthy();
    expect(methods(window.ethereum)).not.toContain("eth_requestAccounts"); // MetaMask 창을 띄우지 않음
  });

  it("S4. 허락한 적 없는 지갑이면 자동 연결하지 않는다", async () => {
    window.ethereum = fakeMetaMask({ authorized: [] });
    renderAt("/");
    await waitFor(() => expect(methods(window.ethereum)).toContain("eth_accounts"));
    expect(screen.getByRole("button", { name: "지갑 연결" })).toBeTruthy();
  });

  it("S5. '연결 끊기' 를 누르면 기억해 두고, 다음 방문에는 자동 연결하지 않는다 (허락도 거둠)", async () => {
    window.ethereum = fakeMetaMask({ authorized: [CUSTOMER] });
    renderAt("/");
    await screen.findByText("0x24fa…f4d0");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "연결 끊기" }));
    });
    expect(window.localStorage.getItem(WALLET_PREF_KEY)).toBe("disconnected");
    expect(methods(window.ethereum)).toContain("wallet_revokePermissions");

    cleanup();
    window.ethereum = fakeMetaMask({ authorized: [CUSTOMER] });
    renderAt("/");
    await act(async () => {});
    expect(methods(window.ethereum)).not.toContain("eth_accounts");
    expect(screen.getByRole("button", { name: "지갑 연결" })).toBeTruthy();
  });

  it("S6. 다른 네트워크에서 연결하면 바로 Sepolia 전환을 요청한다", async () => {
    window.ethereum = fakeMetaMask({ chainId: "0x1" });
    renderAt("/");
    await connectWallet();
    expect(window.ethereum.request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
    expect(window.localStorage.getItem(WALLET_PREF_KEY)).toBe("connected");
  });

  it("S7. 지갑에 Sepolia 가 없으면(4902) Sepolia 추가를 요청한다", async () => {
    window.ethereum = fakeMetaMask({ chainId: "0x1", switchError: { code: 4902 } });
    renderAt("/");
    await connectWallet();
    const add = window.ethereum.request.mock.calls.find(([a]) => a.method === "wallet_addEthereumChain");
    expect(add?.[0].params[0]).toMatchObject({ chainId: "0xaa36a7", chainName: "Sepolia" });
  });

  it("S8. 지갑이 없으면 오류 문구와 함께 MetaMask 설치 링크를 보여 준다", () => {
    delete window.ethereum;
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "지갑 연결" }));
    expect(screen.getByRole("alert").textContent).toBe("MetaMask 가 필요합니다");
    expect(screen.getByRole("link", { name: "MetaMask 설치하기" }).getAttribute("href")).toBe("https://metamask.io/download/");
  });
});

describe("사장님: 결제 기록 (/owner)", () => {
  async function openOwner(eth) {
    window.ethereum = eth;
    renderAt("/owner");
    await connectWallet();
    return screen.findByLabelText("손님 지갑 주소");
  }

  it("S9. 결제를 기록하면 결제 번호와 리뷰 링크(결제 번호 포함)를 보여 준다", async () => {
    const input = await openOwner(fakeMetaMask({ account: OWNER }));
    fireEvent.change(input, { target: { value: CUSTOMER.toLowerCase() } });
    fireEvent.change(screen.getByLabelText("결제 금액 (원)"), { target: { value: "9000" } });
    expect(screen.getByText("손님 적립 예정 90P")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "결제 기록하기" }));
    });

    expect(sendRecordPayment).toHaveBeenCalledWith(window.ethereum, { storeId: 1, customer: CUSTOMER, amount: 9000 });
    expect(await screen.findByText("7")).toBeTruthy();
    expect(screen.getByLabelText(/리뷰 쓰기 링크/).value).toMatch(/\/stores\/1\/review\?payment=7$/);
    expect(screen.getByRole("link", { name: "리뷰 쓰기 화면 열어 보기" }).getAttribute("href")).toBe(
      "/stores/1/review?payment=7",
    );
  });

  it("S10. 주소 형식이 틀리거나 사장님 본인 지갑이면 MetaMask 를 띄우지 않고 막는다", async () => {
    const input = await openOwner(fakeMetaMask({ account: OWNER }));
    fireEvent.change(screen.getByLabelText("결제 금액 (원)"), { target: { value: "9000" } });

    fireEvent.change(input, { target: { value: "0x1234" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "결제 기록하기" }));
    });
    expect(screen.getByText(/주소 형식이 올바르지 않습니다/)).toBeTruthy();

    fireEvent.change(input, { target: { value: OWNER } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "결제 기록하기" }));
    });
    expect(screen.getByText(/셀프 리뷰 방지/)).toBeTruthy();
    expect(sendRecordPayment).not.toHaveBeenCalled();
  });

  it("S11. 금액이 0 이거나 1,000만 원을 넘으면 기록 버튼이 꺼진다", async () => {
    const input = await openOwner(fakeMetaMask({ account: OWNER }));
    fireEvent.change(input, { target: { value: CUSTOMER } });
    for (const bad of ["0", "10000001", "1.5"]) {
      fireEvent.change(screen.getByLabelText("결제 금액 (원)"), { target: { value: bad } });
      expect(screen.getByRole("button", { name: "결제 기록하기" }).disabled).toBe(true);
    }
  });

  it("S12. 이 지갑으로 등록된 가게가 없으면 안내만 하고 입력 칸이 없다", async () => {
    fetchOwnedStoreIds.mockResolvedValue([]);
    window.ethereum = fakeMetaMask({ account: CUSTOMER });
    renderAt("/owner");
    await connectWallet();
    expect(await screen.findByText(/등록된 가게가 없습니다/)).toBeTruthy();
    expect(screen.queryByLabelText("손님 지갑 주소")).toBeNull();
  });
});

describe("관리자 운영 (/admin/ops) — Remix 없이 가게 등록 · 긴급 정지", () => {
  it("S18. 관리자가 아니면 상태만 보이고 등록 · 정지 버튼이 없다", async () => {
    window.ethereum = fakeMetaMask({ account: OWNER });
    renderAt("/admin/ops");
    await connectWallet();
    expect(await screen.findByText(/관리자 지갑이 아닙니다/)).toBeTruthy();
    expect(screen.getByText("정상 운영 중")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "가게 등록하기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "긴급 정지" })).toBeNull();
  });

  it("S19. 관리자가 가게를 등록하면 주소 · 이름을 정리해서 보내고 새 가게 번호를 알려 준다", async () => {
    window.ethereum = fakeMetaMask({ account: CUSTOMER });
    renderAt("/admin/ops");
    await connectWallet();
    expect(await screen.findByText("메뉴 정보 없음")).toBeTruthy(); // 4번은 화면용 메뉴 데이터가 없음
    fireEvent.change(screen.getByLabelText("가게 이름"), { target: { value: "  골목 떡볶이  " } });
    fireEvent.change(screen.getByLabelText("사장님 지갑 주소"), { target: { value: OWNER.toLowerCase() } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "가게 등록하기" }));
    });
    expect(sendRegisterStore).toHaveBeenCalledWith(window.ethereum, { owner: OWNER, name: "골목 떡볶이" });
    expect(await screen.findByText(/5번 가게 '골목 떡볶이' 를 등록했습니다/)).toBeTruthy();
  });

  it("S20. 사장님 주소가 틀리면 MetaMask 를 띄우지 않는다", async () => {
    window.ethereum = fakeMetaMask({ account: CUSTOMER });
    renderAt("/admin/ops");
    await connectWallet();
    fireEvent.change(await screen.findByLabelText("가게 이름"), { target: { value: "가게" } });
    fireEvent.change(screen.getByLabelText("사장님 지갑 주소"), { target: { value: "0xabc" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "가게 등록하기" }));
    });
    expect(screen.getByText(/사장님 지갑 주소 형식이 올바르지 않습니다/)).toBeTruthy();
    expect(sendRegisterStore).not.toHaveBeenCalled();
  });

  it("S21. 긴급 정지는 한 번 더 확인한 뒤에만 보낸다", async () => {
    window.ethereum = fakeMetaMask({ account: CUSTOMER });
    renderAt("/admin/ops");
    await connectWallet();
    fireEvent.click(await screen.findByRole("button", { name: "긴급 정지" }));
    expect(sendSetPaused).not.toHaveBeenCalled();
    expect(screen.getByText("정말 모든 기록을 멈출까요?")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "네, 멈춥니다" }));
    });
    expect(sendSetPaused).toHaveBeenCalledWith(window.ethereum, true);
    expect(await screen.findByText(/긴급 정지했습니다/)).toBeTruthy();
  });
});

describe("리뷰 링크 · 약관 · 인터넷 끊김", () => {
  it("S13. 리뷰 링크(?payment=7)로 들어오면 안내가 보이고, 검사 후 결제 번호가 미리 채워진다", async () => {
    window.ethereum = fakeMetaMask();
    renderAt("/stores/1/review?payment=7");
    expect(screen.getByText(/결제 7번 리뷰 링크로 들어왔습니다/)).toBeTruthy();
    await connectWallet();
    fireEvent.click(screen.getByRole("button", { name: "예시: 게시" }));
    fireEvent.click(screen.getByRole("button", { name: "검사하기" }));
    expect(screen.getByLabelText("결제 번호").value).toBe("7");
  });

  it("S14. 숫자가 아닌 payment 값은 무시한다", () => {
    renderAt("/stores/1/review?payment=1;alert(1)");
    expect(screen.queryByText(/리뷰 링크로 들어왔습니다/)).toBeNull();
  });

  it("S15. 바닥글에서 이용약관 · 개인정보처리방침으로 갈 수 있다", () => {
    renderAt("/");
    const footer = () => within(screen.getByRole("navigation", { name: "바닥글 메뉴" }));
    fireEvent.click(footer().getByRole("link", { name: "이용약관" }));
    expect(screen.getByRole("heading", { name: "이용약관" })).toBeTruthy();
    fireEvent.click(footer().getByRole("link", { name: "개인정보처리방침" }));
    expect(screen.getByRole("heading", { name: "개인정보처리방침" })).toBeTruthy();
  });

  it("S16. 인터넷이 끊기면 안내가 보이고, 다시 연결되면 사라진다", async () => {
    const spy = vi.spyOn(window.navigator, "onLine", "get");
    renderAt("/");
    spy.mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(screen.getByText(/인터넷 연결이 끊겼습니다/)).toBeTruthy();
    spy.mockReturnValue(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(screen.queryByText(/인터넷 연결이 끊겼습니다/)).toBeNull();
    spy.mockRestore();
  });
});

// 이 테스트는 파일 맨 끝에 둔다: 알린 지갑이 모듈 안에 남아 이후 getProvider 결과를 바꾸기 때문
describe("여러 지갑 (EIP-6963)", () => {
  it("S17. 확장 프로그램이 여러 개여도 MetaMask 가 알린 지갑을 먼저 쓴다", () => {
    window.ethereum = { name: "다른 지갑" };
    const metamask = { name: "MetaMask" };
    window.dispatchEvent(
      Object.assign(new Event("eip6963:announceProvider"), {
        detail: { info: { uuid: "1", rdns: "io.metamask", name: "MetaMask" }, provider: metamask },
      }),
    );
    expect(getProvider()).toBe(metamask);
  });
});
