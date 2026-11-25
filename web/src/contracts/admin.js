// 11단계: 관리자 운영 화면(/admin/ops) 전용 — 가게 목록 · 긴급 정지 상태 읽기, 가게 등록 · 정지/재개 쓰기
// Remix 없이 앱에서 한다. 쓰기는 관리자 MetaMask 서명 (컨트랙트의 onlyAdmin 이 최종 확인).
import { BrowserProvider, Contract, JsonRpcProvider, getAddress, isAddress } from "ethers";
import { FAIR_REVIEW_ABI, FAIR_REVIEW_ADDRESS, PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER } from "./fairReview.js";

let readOnly = null;
function readContract() {
  if (!readOnly) {
    const provider = new JsonRpcProvider(PUBLIC_RPC, SEPOLIA_CHAIN_NUMBER, { staticNetwork: true });
    readOnly = new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, provider);
  }
  return readOnly;
}

async function writeContract(ethereum) {
  const signer = await new BrowserProvider(ethereum).getSigner();
  return new Contract(FAIR_REVIEW_ADDRESS, FAIR_REVIEW_ABI, signer);
}

/** 관리자 주소 · 긴급 정지 여부 · 등록된 가게 전부 */
export async function fetchOpsInfo() {
  const contract = readContract();
  const [admin, paused, count] = await Promise.all([contract.admin(), contract.paused(), contract.storeCount()]);
  const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
  const stores = await Promise.all(ids.map((id) => contract.stores(id)));
  return {
    admin,
    paused,
    stores: ids.map((id, i) => ({ id, owner: stores[i].owner, name: stores[i].name })),
  };
}

/** 사장님 주소 확인 · 체크섬. 틀리면 "InvalidOwnerAddress" */
export function normalizeOwner(address) {
  const text = String(address ?? "").trim();
  if (!isAddress(text)) throw "InvalidOwnerAddress";
  return getAddress(text.toLowerCase());
}

/** 가게 이름 정리 (앞뒤 공백 제거, 비면 EmptyName, 40자 넘으면 NameTooLong) */
export function normalizeStoreName(name) {
  const text = String(name ?? "").trim();
  if (!text) throw "EmptyName";
  if (text.length > 40) throw "NameTooLong";
  return text;
}

export async function sendRegisterStore(ethereum, { owner, name }) {
  return (await writeContract(ethereum)).registerStore(owner, name);
}

/** paused = true 면 긴급 정지, false 면 다시 켜기 */
export async function sendSetPaused(ethereum, paused) {
  const contract = await writeContract(ethereum);
  return paused ? contract.pause() : contract.unpause();
}

/** 영수증의 StoreRegistered 에서 새 가게 번호 */
export function storeIdFromReceipt(receipt) {
  const contract = readContract();
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "StoreRegistered") return Number(parsed.args.storeId);
    } catch {
      /* 다른 이벤트 */
    }
  }
  return null;
}
