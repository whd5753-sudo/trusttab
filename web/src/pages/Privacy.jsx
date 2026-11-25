import { Link } from "react-router";
import { SOURCE_URL } from "../components/Layout.jsx";
import { WALLET_PREF_KEY } from "../state/WalletContext.jsx";

// 11단계: 개인정보처리방침 — 실제로 어떤 정보가 어디로 가는지만 정직하게 적는다
export default function Privacy() {
  return (
    <article className="card legal">
      <title>개인정보처리방침 · TrustTab</title>
      <h2>개인정보처리방침</h2>
      <p className="muted small">시행일 2026년 11월 8일 · 수업 실습용 서비스의 안내문입니다.</p>

      <h3>1. TrustTab 이 따로 모으는 개인정보는 없습니다</h3>
      <p>회원 가입 · 이름 · 전화번호 · 이메일을 받지 않고, 광고 · 방문 분석 도구와 쿠키를 쓰지 않습니다.</p>

      <h3>2. 블록체인에 공개되는 정보</h3>
      <ul>
        <li>지갑 주소, 결제 번호 · 금액, 리뷰 내용 · 별점 · AI 점수, 포인트</li>
        <li>Sepolia 테스트넷에 영구히 공개되며 누구나 Etherscan 등에서 볼 수 있습니다. 운영자도 지울 수 없습니다.</li>
      </ul>

      <h3>3. 처리를 위해 다른 곳으로 가는 정보</h3>
      <table className="legal-table">
        <thead>
          <tr>
            <th scope="col">받는 곳</th>
            <th scope="col">보내는 정보</th>
            <th scope="col">이유</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AI 오라클 서버 (운영자 컴퓨터)</td>
            <td>결제 번호, 지갑 주소, 별점, 리뷰 내용</td>
            <td>AI 점수를 매기고 서명 · 저장하지 않음</td>
          </tr>
          <tr>
            <td>공개 블록체인 노드 (publicnode.com)</td>
            <td>조회 요청, 접속 IP</td>
            <td>지갑 없이 리뷰 · 포인트 읽기</td>
          </tr>
          <tr>
            <td>MetaMask (내 브라우저의 지갑)</td>
            <td>서명 요청 내용</td>
            <td>기록 전 본인 확인 · 승인</td>
          </tr>
          <tr>
            <td>GitHub Pages</td>
            <td>접속 IP 등 일반 접속 기록</td>
            <td>웹사이트 제공 (GitHub 의 방침을 따름)</td>
          </tr>
        </tbody>
      </table>

      <h3>4. 내 브라우저에만 저장되는 것</h3>
      <p>
        '연결 끊기'를 눌렀는지 기억하는 값 하나(<code>{WALLET_PREF_KEY}</code>)만 이 브라우저에 저장합니다. 다음 방문 때 지갑을
        자동으로 다시 연결할지 정하는 데만 쓰고, 서버로 보내지 않습니다. 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.
      </p>

      <h3>5. 문의</h3>
      <p>
        <a href={`${SOURCE_URL}/issues`} target="_blank" rel="noreferrer">
          GitHub 이슈
        </a>
        로 남겨 주세요. 함께 보기: <Link to="/terms">이용약관</Link>
      </p>
    </article>
  );
}
