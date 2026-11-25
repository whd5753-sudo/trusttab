import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toKoreanError } from "../contracts/errors.js";
import { MAX_AMOUNT, POINT_RATE_PERCENT, txUrl } from "../contracts/fairReview.js";
import {
  fetchOwnedStoreIds,
  fetchRecentPayments,
  normalizeCustomer,
  paymentIdFromReceipt,
  sendRecordPayment,
} from "../contracts/owner.js";
import { getProvider, shortAddress, useWallet } from "../state/WalletContext.jsx";
import { STORES } from "../data/stores.js";

// 11단계: 사장님 화면 — 손님이 계산하면 여기서 결제를 블록체인에 기록한다 (Remix 없이).
// 기록하면 결제 번호와 '리뷰 쓰기 링크'가 나오고, 손님은 그 링크로 바로 리뷰를 쓴다.
// 사장님 지갑 확인은 컨트랙트가 한다 (onlyStoreOwner). 화면은 안내만 한다.
const storeName = (id) => STORES.find((s) => s.id === String(id))?.name ?? `가게 ${id}`;
const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;

/** 손님에게 줄 리뷰 링크 (예: https://…/trusttab/stores/1/review?payment=7) */
export function reviewLink(storeId, paymentId) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/stores/${storeId}/review?payment=${paymentId}`;
}

export default function OwnerPayments() {
  const { account, isSepolia, switchToSepolia, connect } = useWallet();
  const [owned, setOwned] = useState({ status: "idle", ids: [] });
  const [recent, setRecent] = useState({ status: "idle", items: [] });
  const [storeId, setStoreId] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [act, setAct] = useState({ status: "idle", message: "" }); // idle · signing · mining · done · error
  const [receipt, setReceipt] = useState(null); // { paymentId, storeId, amount, txHash }
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);

  // 연결한 지갑이 사장님인 가게 찾기
  useEffect(() => {
    if (!account) {
      setOwned({ status: "idle", ids: [] });
      return undefined;
    }
    let active = true;
    setOwned({ status: "loading", ids: [] });
    fetchOwnedStoreIds(account)
      .then((ids) => {
        if (!active) return;
        setOwned({ status: "ready", ids });
        setStoreId((prev) => (prev && ids.includes(Number(prev)) ? prev : ids[0] ? String(ids[0]) : ""));
      })
      .catch(() => active && setOwned({ status: "error", ids: [] }));
    return () => {
      active = false;
    };
  }, [account, reload]);

  // 내 가게 최근 결제
  useEffect(() => {
    if (owned.status !== "ready" || owned.ids.length === 0) {
      setRecent({ status: "idle", items: [] });
      return undefined;
    }
    let active = true;
    setRecent((r) => ({ status: "loading", items: r.items }));
    fetchRecentPayments(owned.ids)
      .then((items) => active && setRecent({ status: "ready", items }))
      .catch(() => active && setRecent({ status: "error", items: [] }));
    return () => {
      active = false;
    };
  }, [owned, reload]);

  const again = useCallback(() => setReload((n) => n + 1), []);

  const amountNumber = Number(amount);
  const validAmount = Number.isInteger(amountNumber) && amountNumber >= 1 && amountNumber <= MAX_AMOUNT;
  const busy = act.status === "signing" || act.status === "mining";
  const canSubmit = Boolean(storeId) && customer.trim() !== "" && validAmount && !busy;

  async function record() {
    setReceipt(null);
    setCopied(false);
    let checked;
    try {
      checked = normalizeCustomer(customer);
    } catch (e) {
      setAct({ status: "error", message: toKoreanError(e) });
      return;
    }
    if (checked.toLowerCase() === account.toLowerCase()) {
      setAct({ status: "error", message: toKoreanError("SelfPayment") });
      return;
    }
    try {
      setAct({ status: "signing", message: "MetaMask 창에서 확인하고 승인해 주세요" });
      const tx = await sendRecordPayment(getProvider(), { storeId: Number(storeId), customer: checked, amount: amountNumber });
      setAct({ status: "mining", message: "블록체인에 기록하는 중… (보통 15초 안팎)", txHash: tx.hash });
      const mined = await tx.wait();
      const paymentId = paymentIdFromReceipt(mined);
      setReceipt({ paymentId, storeId: Number(storeId), amount: amountNumber, txHash: tx.hash, customer: checked });
      setAct({ status: "done", message: "결제를 기록했습니다", txHash: tx.hash });
      setCustomer("");
      setAmount("");
      again();
    } catch (e) {
      setAct({ status: "error", message: toKoreanError(e) });
    }
  }

  async function copyLink() {
    const link = reviewLink(receipt.storeId, receipt.paymentId);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // 복사가 막힌 환경: 링크 칸을 선택해 두어 Ctrl+C 로 복사하게
      document.getElementById("review-link")?.select();
    }
  }

  return (
    <>
      <title>사장님: 결제 기록 · TrustTab</title>
      <meta name="robots" content="noindex" />
      <section className="card owner-card" aria-labelledby="owner-title">
        <h2 id="owner-title">사장님: 결제 기록</h2>
        <p className="muted small">
          손님이 계산하면 여기서 결제를 블록체인에 기록합니다. 기록하면 결제 번호와 리뷰 링크가 나오고, 손님은 그 링크로 리뷰를
          씁니다. 손님에게는 결제 금액의 {POINT_RATE_PERCENT}% 가 포인트로 쌓입니다.
        </p>

        {!account && (
          <p className="status">
            사장님 지갑을 연결해 주세요.{" "}
            <button type="button" className="link-like" onClick={connect}>
              지갑 연결
            </button>
          </p>
        )}

        {account && !isSepolia && (
          <p className="status">
            Sepolia 네트워크에서만 기록할 수 있습니다.{" "}
            <button type="button" className="link-like" onClick={switchToSepolia}>
              Sepolia 로 전환
            </button>
          </p>
        )}

        {account && owned.status === "loading" && <p className="muted">내 가게를 찾는 중…</p>}
        {account && owned.status === "error" && (
          <p className="status error">
            가게 정보를 불러오지 못했습니다.{" "}
            <button type="button" className="link-like" onClick={again}>
              다시 시도
            </button>
          </p>
        )}
        {account && owned.status === "ready" && owned.ids.length === 0 && (
          <p className="status">
            이 지갑({shortAddress(account)})으로 등록된 가게가 없습니다. 관리자가 가게를 등록할 때 정한 사장님 지갑으로 연결해 주세요.
          </p>
        )}

        {account && isSepolia && owned.status === "ready" && owned.ids.length > 0 && (
          <form
            className="owner-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) record();
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="owner-store">
                가게
              </label>
              <select id="owner-store" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={busy}>
                {owned.ids.map((id) => (
                  <option key={id} value={String(id)}>
                    {id}번 · {storeName(id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="owner-customer">
                손님 지갑 주소
              </label>
              <input
                id="owner-customer"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={customer}
                disabled={busy}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="0x 로 시작하는 42글자"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="owner-amount">
                결제 금액 (원)
              </label>
              <input
                id="owner-amount"
                type="number"
                min="1"
                max={MAX_AMOUNT}
                step="1"
                inputMode="numeric"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 9000"
                aria-describedby="owner-amount-hint"
              />
              <p className="char-count" id="owner-amount-hint">
                {validAmount
                  ? `손님 적립 예정 ${Math.floor((amountNumber * POINT_RATE_PERCENT) / 100).toLocaleString("ko-KR")}P`
                  : `1원 ~ ${won(MAX_AMOUNT)}`}
              </p>
            </div>
            <button type="submit" className="primary" disabled={!canSubmit}>
              {busy ? "처리 중…" : "결제 기록하기"}
            </button>
          </form>
        )}

        {act.message && (
          <p className={act.status === "error" ? "status error" : act.status === "done" ? "status done" : "status"} role="status">
            {act.message}
          </p>
        )}
        {act.txHash && act.status !== "done" && (
          <p className="status">
            <a href={txUrl(act.txHash)} target="_blank" rel="noreferrer">
              Etherscan 에서 트랜잭션 보기
            </a>
          </p>
        )}
      </section>

      {receipt && (
        <section className="card receipt-card" aria-labelledby="receipt-title">
          <h2 id="receipt-title">손님에게 알려 주세요</h2>
          <p className="receipt-number">
            결제 번호 <strong>{receipt.paymentId ?? "?"}</strong>
          </p>
          <p className="muted small">
            {storeName(receipt.storeId)} · {won(receipt.amount)} · 손님 {shortAddress(receipt.customer)} ·{" "}
            <a href={txUrl(receipt.txHash)} target="_blank" rel="noreferrer">
              Etherscan
            </a>
          </p>
          {receipt.paymentId && (
            <div className="field">
              <label className="field-label" htmlFor="review-link">
                리뷰 쓰기 링크 (결제 번호가 미리 채워짐)
              </label>
              <div className="copy-row">
                <input id="review-link" type="text" readOnly value={reviewLink(receipt.storeId, receipt.paymentId)} />
                <button type="button" className="wallet-button" onClick={copyLink}>
                  {copied ? "복사했습니다" : "링크 복사"}
                </button>
              </div>
            </div>
          )}
          <Link className="primary link-button" to={`/stores/${receipt.storeId}/review?payment=${receipt.paymentId}`}>
            리뷰 쓰기 화면 열어 보기
          </Link>
        </section>
      )}

      {owned.ids.length > 0 && (
        <section className="card" aria-labelledby="recent-title">
          <h2 id="recent-title">최근 결제</h2>
          {recent.status === "loading" && recent.items.length === 0 && <p className="muted">블록체인에서 결제를 불러오는 중…</p>}
          {recent.status === "error" && (
            <p className="status error">
              결제 목록을 불러오지 못했습니다.{" "}
              <button type="button" className="link-like" onClick={again}>
                다시 시도
              </button>
            </p>
          )}
          {recent.status === "ready" && recent.items.length === 0 && <p className="muted">아직 기록한 결제가 없습니다.</p>}
          {recent.items.length > 0 && (
            <ul className="review-list payment-list">
              {recent.items.map((p) => (
                <li key={p.paymentId}>
                  <span className={p.reviewed ? "pay-tag done" : "pay-tag"}>{p.reviewed ? "리뷰 작성됨" : "리뷰 대기"}</span>
                  <p>
                    <strong>결제 {p.paymentId}번</strong> · {storeName(p.storeId)} · {won(p.amount)}
                  </p>
                  <p className="muted small">
                    손님 {shortAddress(p.customer)} ·{" "}
                    <a href={txUrl(p.txHash)} target="_blank" rel="noreferrer">
                      Etherscan
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
