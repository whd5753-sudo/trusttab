import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toKoreanError } from "../contracts/errors.js";
import { addressUrl, txUrl } from "../contracts/fairReview.js";
import { fetchOpsInfo, normalizeOwner, normalizeStoreName, sendRegisterStore, sendSetPaused, storeIdFromReceipt } from "../contracts/admin.js";
import { getProvider, shortAddress, useWallet } from "../state/WalletContext.jsx";
import { STORES } from "../data/stores.js";

// 11단계: 관리자 운영 화면 — Remix 없이 앱에서 가게 등록 · 긴급 정지/재개.
// 버튼은 관리자 지갑일 때만 보이지만, 실제 권한 확인은 컨트랙트(onlyAdmin)가 한다.
const hasMenu = (id) => STORES.some((s) => s.id === String(id));

function statusClass(status) {
  return status === "error" ? "status error" : status === "done" ? "status done" : "status";
}

export default function AdminOps() {
  const { account, isSepolia, switchToSepolia, connect } = useWallet();
  const [info, setInfo] = useState({ status: "loading", data: null });
  const [retry, setRetry] = useState(0);
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [reg, setReg] = useState({ status: "idle", message: "" });
  const [pause, setPause] = useState({ status: "idle", message: "", confirm: false });

  useEffect(() => {
    let active = true;
    setInfo((i) => ({ status: "loading", data: i.data }));
    fetchOpsInfo()
      .then((data) => active && setInfo({ status: "ready", data }))
      .catch(() => active && setInfo({ status: "error", data: null }));
    return () => {
      active = false;
    };
  }, [retry]);

  const again = useCallback(() => setRetry((n) => n + 1), []);
  const data = info.data;
  const isAdmin = Boolean(account && data && account.toLowerCase() === data.admin.toLowerCase());
  const canWrite = isAdmin && isSepolia;
  const regBusy = reg.status === "signing" || reg.status === "mining";
  const pauseBusy = pause.status === "signing" || pause.status === "mining";

  async function register() {
    let checkedOwner;
    let checkedName;
    try {
      checkedOwner = normalizeOwner(owner);
      checkedName = normalizeStoreName(name);
    } catch (e) {
      setReg({ status: "error", message: toKoreanError(e) });
      return;
    }
    try {
      setReg({ status: "signing", message: "MetaMask 창에서 확인하고 승인해 주세요" });
      const tx = await sendRegisterStore(getProvider(), { owner: checkedOwner, name: checkedName });
      setReg({ status: "mining", message: "블록체인에 기록하는 중… (보통 15초 안팎)", txHash: tx.hash });
      const id = storeIdFromReceipt(await tx.wait());
      setReg({
        status: "done",
        message: `${id ?? "새"}번 가게 '${checkedName}' 를 등록했습니다. 사장님 지갑으로 사장님 화면에서 결제를 기록할 수 있습니다.`,
        txHash: tx.hash,
      });
      setOwner("");
      setName("");
      again();
    } catch (e) {
      setReg({ status: "error", message: toKoreanError(e) });
    }
  }

  async function togglePause() {
    const next = !data.paused;
    try {
      setPause({ status: "signing", message: "MetaMask 창에서 확인하고 승인해 주세요", confirm: false });
      const tx = await sendSetPaused(getProvider(), next);
      setPause({ status: "mining", message: "블록체인에 기록하는 중…", confirm: false, txHash: tx.hash });
      await tx.wait();
      setPause({
        status: "done",
        message: next ? "긴급 정지했습니다. 결제 기록 · 리뷰 제출 · 승인이 모두 멈춥니다." : "다시 켰습니다. 모든 기능이 정상 동작합니다.",
        confirm: false,
        txHash: tx.hash,
      });
      again();
    } catch (e) {
      setPause({ status: "error", message: toKoreanError(e), confirm: false });
    }
  }

  return (
    <>
      <title>운영 설정 · TrustTab</title>
      <meta name="robots" content="noindex" />

      <section className="card ops-card" aria-labelledby="ops-title">
        <div className="ops-head">
          <h2 id="ops-title">운영 설정 (관리자)</h2>
          <Link to="/admin">← 보류 리뷰 검토</Link>
        </div>
        <p className="muted small">
          가게 등록과 긴급 정지를 Remix 없이 여기서 합니다. 버튼은 관리자 지갑에서만 보이고, 권한은 컨트랙트가 다시 확인합니다.
        </p>

        {info.status === "loading" && !data && <p className="muted">블록체인에서 운영 상태를 불러오는 중…</p>}
        {info.status === "error" && (
          <p className="status error">
            운영 상태를 불러오지 못했습니다.{" "}
            <button type="button" className="link-like" onClick={again}>
              다시 시도
            </button>
          </p>
        )}

        {data && (
          <div className="ops-state">
            <span className={data.paused ? "ops-pill stopped" : "ops-pill running"}>{data.paused ? "긴급 정지 중" : "정상 운영 중"}</span>
            <span className="muted small">
              관리자{" "}
              <a href={addressUrl(data.admin)} target="_blank" rel="noreferrer">
                {shortAddress(data.admin)}
              </a>{" "}
              · 가게 {data.stores.length}곳
            </span>
          </div>
        )}

        {data && !account && (
          <p className="status">
            관리자 지갑을 연결하면 등록 · 정지 버튼이 보입니다.{" "}
            <button type="button" className="link-like" onClick={connect}>
              지갑 연결
            </button>
          </p>
        )}
        {data && account && !isAdmin && (
          <p className="status">관리자 지갑이 아닙니다 (관리자 {shortAddress(data.admin)}). 보기만 할 수 있습니다.</p>
        )}
        {data && isAdmin && !isSepolia && (
          <p className="status">
            Sepolia 네트워크에서만 바꿀 수 있습니다.{" "}
            <button type="button" className="link-like" onClick={switchToSepolia}>
              Sepolia 로 전환
            </button>
          </p>
        )}

        {data && canWrite && (
          <div className="ops-pause">
            <h3>긴급 정지</h3>
            <p className="muted small">
              문제가 생기면 결제 기록 · 리뷰 제출 · 보류 승인을 한 번에 멈춥니다. 읽기(리뷰 보기)는 계속 됩니다.
            </p>
            {!pause.confirm ? (
              <button
                type="button"
                className={data.paused ? "primary" : "wallet-button danger"}
                disabled={pauseBusy}
                onClick={() => setPause({ status: "idle", message: "", confirm: true })}
              >
                {pauseBusy ? "처리 중…" : data.paused ? "다시 켜기" : "긴급 정지"}
              </button>
            ) : (
              <div className="confirm-row" role="group" aria-label="정말 바꿀지 확인">
                <span>{data.paused ? "서비스를 다시 켤까요?" : "정말 모든 기록을 멈출까요?"}</span>
                <button type="button" className={data.paused ? "primary" : "wallet-button danger"} onClick={togglePause}>
                  {data.paused ? "네, 다시 켭니다" : "네, 멈춥니다"}
                </button>
                <button type="button" className="wallet-button" onClick={() => setPause({ status: "idle", message: "", confirm: false })}>
                  취소
                </button>
              </div>
            )}
            {pause.message && (
              <p className={statusClass(pause.status)} role="status">
                {pause.message}
                {pause.txHash && (
                  <>
                    {" "}
                    <a href={txUrl(pause.txHash)} target="_blank" rel="noreferrer">
                      Etherscan
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      {data && (
        <section className="card" aria-labelledby="stores-title">
          <h2 id="stores-title">등록된 가게</h2>
          <ul className="review-list ops-stores">
            {data.stores.map((s) => (
              <li key={s.id}>
                <span className={hasMenu(s.id) ? "pay-tag done" : "pay-tag"}>{hasMenu(s.id) ? "손님 화면에 표시" : "메뉴 정보 없음"}</span>
                <p>
                  <strong>{s.id}번 · {s.name}</strong>
                </p>
                <p className="muted small">
                  사장님{" "}
                  <a href={addressUrl(s.owner)} target="_blank" rel="noreferrer">
                    {shortAddress(s.owner)}
                  </a>
                </p>
              </li>
            ))}
          </ul>
          <p className="muted small">
            새 가게가 손님 화면(가게 목록)에 보이려면 <code>web/src/data/stores.js</code> 에 같은 번호로 메뉴 · 분류를 한 줄 더하고 배포합니다.
          </p>

          {canWrite && (
            <form
              className="owner-form ops-register"
              onSubmit={(e) => {
                e.preventDefault();
                if (!regBusy) register();
              }}
            >
              <h3>가게 등록</h3>
              <div className="field">
                <label className="field-label" htmlFor="ops-name">
                  가게 이름
                </label>
                <input
                  id="ops-name"
                  type="text"
                  maxLength={40}
                  value={name}
                  disabled={regBusy}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 골목 떡볶이"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ops-owner">
                  사장님 지갑 주소
                </label>
                <input
                  id="ops-owner"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={owner}
                  disabled={regBusy}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="0x 로 시작하는 42글자"
                />
              </div>
              <p className="notice">가게 이름은 블록체인에 영원히 남고 고칠 수 없습니다. 맞춤법을 한 번 더 확인하세요.</p>
              <button type="submit" className="primary" disabled={regBusy || !name.trim() || !owner.trim()}>
                {regBusy ? "처리 중…" : "가게 등록하기"}
              </button>
              {reg.message && (
                <p className={statusClass(reg.status)} role="status">
                  {reg.message}
                  {reg.txHash && reg.status === "done" && (
                    <>
                      {" "}
                      <a href={txUrl(reg.txHash)} target="_blank" rel="noreferrer">
                        Etherscan
                      </a>
                    </>
                  )}
                </p>
              )}
            </form>
          )}
        </section>
      )}
    </>
  );
}
