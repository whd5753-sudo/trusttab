// Sepolia 에 배포한 FairReview 컨트랙트 정보 (docs/화면연결설계.md, docs/오라클설계.md)
// 주소는 공개 정보다. 개인키 · 니모닉은 화면 코드에 절대 넣지 않는다.

// 10단계 v2 (AI 오라클 서명 검증). 8단계 v1 = 0xc9B6D213119A75cA023d1181B089D1508259cf91 (더 이상 안 씀)
export const FAIR_REVIEW_ADDRESS = "0x8773d97845c5a58EfDDD8Dde9499Cde4E4eeED0D";
export const SEPOLIA_CHAIN_NUMBER = 11155111;
export const DEPLOY_BLOCK = 12083581; // v2 가 배포된 블록 — 이 블록부터 이벤트를 찾는다
export const EXPLORER = "https://sepolia.etherscan.io";
// 지갑 없이 읽기만 할 때 쓰는 공개 노드 (쓰기 = 서명은 항상 MetaMask)
export const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
// 10단계: AI 오라클 서버 (oracle 폴더에서 npm start). 다른 주소면 빌드 때 VITE_ORACLE_URL 로 바꾼다
export const ORACLE_URL = import.meta.env.VITE_ORACLE_URL ?? "http://localhost:8787";

// 화면이 쓰는 함수 · 이벤트 · 오류만 적은 ABI (contracts/contracts/FairReview.sol 과 같아야 한다)
export const FAIR_REVIEW_ABI = [
  "function admin() view returns (address)",
  "function oracle() view returns (address)",
  "function points(address user) view returns (uint256)",
  "function stores(uint256 storeId) view returns (address owner, string name)",
  "function storeCount() view returns (uint256)",
  "function paused() view returns (bool)",
  "function payments(uint256 paymentId) view returns (uint256 storeId, address customer, uint256 amount, uint64 paidAt, bool reviewed)",
  "function reviewStatus(uint256 paymentId) view returns (uint8)",
  "function submitReview(uint256 paymentId, uint8 rating, string content, uint16 score, bytes signature)",
  "function resolveHeld(uint256 paymentId, bool approve)",
  // 11단계: 사장님 화면(/owner)에서 결제 기록 — Remix 없이 앱에서
  "function recordPayment(uint256 storeId, address customer, uint256 amount) returns (uint256 paymentId)",
  // 11단계: 관리자 운영 화면(/admin/ops) — 가게 등록 · 긴급 정지 (Remix 대신)
  "function registerStore(address owner, string name) returns (uint256 storeId)",
  "function pause()",
  "function unpause()",
  "event StoreRegistered(uint256 indexed storeId, address indexed owner, string name)",
  "event PaymentRecorded(uint256 indexed paymentId, uint256 indexed storeId, address indexed customer, uint256 amount, uint256 pointsEarned)",
  "event ReviewSubmitted(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content, uint16 aiScore)",
  "event ReviewHeld(uint256 indexed paymentId, uint256 indexed storeId, address indexed reviewer, uint8 rating, string content, uint16 aiScore)",
  "event HeldReviewResolved(uint256 indexed paymentId, uint256 indexed storeId, bool approved)",
  "error NotAdmin()",
  "error ContractPaused()",
  "error StoreNotFound(uint256 storeId)",
  "error NotStoreOwner(uint256 storeId)",
  "error ZeroAddress()",
  "error EmptyName()",
  "error InvalidAmount()",
  "error SelfPayment()",
  "error PaymentNotFound(uint256 paymentId)",
  "error NotPaymentCustomer(uint256 paymentId)",
  "error AlreadyReviewed(uint256 paymentId)",
  "error ReviewExpired(uint256 paymentId)",
  "error InvalidRating(uint8 rating)",
  "error EmptyContent()",
  "error ContentTooLong()",
  "error InvalidScore(uint16 score)",
  "error InvalidOracleSignature()",
  "error SuspectedFakeReview(uint16 score)",
  "error NotHeld(uint256 paymentId)",
];

// 컨트랙트의 한 번 결제 최대 금액 (FairReview.sol 의 MAX_AMOUNT) · 결제 적립률 1%
export const MAX_AMOUNT = 10_000_000;
export const POINT_RATE_PERCENT = 1;

export const txUrl = (hash) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address) => `${EXPLORER}/address/${address}`;
