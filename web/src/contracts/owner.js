// 11단계: 사장님 화면(/owner) 전용 블록체인 읽기 · 쓰기 (docs/화면연결설계.md 6절)
// Remix 대신 앱에서 결제를 기록한다. 쓰기는 사장님 MetaMask 서명, 읽기는 공개 노드.
import { BrowserProvider, Contract, JsonRpcProvider, getAddress, isAddress } from "ethers";
import { DEPLOY_BLOCK, FAIR_REVIEW_ABI, FAIR_REVIEW_ADDRESS, PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER } from "./fairReview.js";

const LOG_CHUNK = 40_000;
let readOnly = null;
function readContract() {
  if (!readOnly) {
    const provider = new JsonRpcProvider(PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER, { staticNetwork: true });
    readOnly = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, provider);
  }
  return readOnly;
}

/** 이 지갑이 사장님인 가게 번호들 (컨트랙트의 stores(id).owner 와 비교) */
export async function fetchOwnedStoreIds(account) {
  const contract = readContract();
  const count = Number(await contract.storeCount());
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const stores = await Promise.all(ids.map((id) => contract.stores(id)));
  const me = account.toLowerCase();
  return ids.filter((id, i) => stores[i].owner.toLowerCase() === me);
}

/** 내 가게들의 최근 결제 (최신순 20개) — 리뷰를 썼는지도 함께 */
export async function fetchRecentPayments(storeIds) {
  if (!storeIds.length) return [];
  const contract = readContract();
  const latest = await contract.runner.provider.getBlockNumber();
  const logs = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = Math.min(from + LOG_CHUNK - 1, latest);
    logs.push(...(await contract.queryFilter(contract.filters.PaymentRecorded(null, storeIds), from, to)));
  }
  const recent = logs
    .map((l) => ({
      paymentId: Number(l.args.paymentId),
      storeId: Number(l.args.storeId),
      customer: l.args.customer,
      amount: Number(l.args.amount),
      txHash: l.transactionHash,
    }))
    .sort((a, b) => b.paymentId - a.paymentId)
    .slice(0, 20);
  const statuses = await Promise.all(recent.map((p) => contract.payments(p.paymentId)));
  return recent.map((p, i) => ({ ...p, reviewed: statuses[i].reviewed }));
}

/** 손님 주소 확인 · 체크섬 맞추기. 틀리면 "InvalidAddress" */
export function normalizeCustomer(address) {
  const text = String(address ?? "").trim();
  if (!isAddress(text)) throw "InvalidAddress";
  return getAddress(text.toLowerCase());
}

/** 결제 기록 — 사장님 MetaMask 서명. 트랜잭션을 돌려주고, 기다리기는 화면이 한다 */
export async function sendRecordPayment(ethereum, { storeId, customer, amount }) {
  const signer = await new BrowserProvider(ethereum).getSigner();
  const contract = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, signer);
  return contract.recordPayment(storeId, customer, amount);
}

/** 기록된 트랜잭션 영수증에서 새 결제 번호 꺼내기 */
export function paymentIdFromReceipt(receipt) {
  const contract = readContract();
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "PaymentRecorded") return Number(parsed.args.paymentId);
    } catch {
      /* 다른 이벤트 */
    }
  }
  return null;
}
