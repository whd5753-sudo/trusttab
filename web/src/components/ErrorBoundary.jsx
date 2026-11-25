import { Component } from "react";
import { Link } from "react-router";

// 11단계: 화면 그리기 중 예상 못 한 오류가 나도 하얀 화면 대신 안내를 보여 준다.
// 오류 원문(개발용 메시지)은 화면에 보여 주지 않는다.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[TrustTab] 화면 오류", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card" role="alert">
        <title>문제가 생겼습니다 · TrustTab</title>
        <h2>화면을 보여 주는 중에 문제가 생겼습니다</h2>
        <p>새로 고침(F5) 하거나 홈으로 돌아가 다시 시도해 주세요. 블록체인에 기록된 내용은 그대로 있습니다.</p>
        <Link to="/">홈으로 돌아가기</Link>
      </section>
    );
  }
}
