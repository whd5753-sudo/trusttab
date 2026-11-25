import { Route, Routes } from "react-router";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import StoreList from "./pages/StoreList.jsx";
import StoreDetail from "./pages/StoreDetail.jsx";
import WriteReview from "./pages/WriteReview.jsx";
import NotFound from "./pages/NotFound.jsx";
import AdminReview from "./pages/AdminReview.jsx";
import OwnerPayments from "./pages/OwnerPayments.jsx";
import AdminOps from "./pages/AdminOps.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";

// 주소 → 화면 표 (docs/라우팅설계.md 1절). 공통 부분은 Layout, 가운데는 Outlet.
// 라우터(BrowserRouter / MemoryRouter)는 바깥(main.jsx / 테스트)에서 감싼다.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="stores" element={<StoreList />} />
        <Route path="stores/:id" element={<StoreDetail />} />
        <Route path="stores/:id/review" element={<WriteReview />} />
        <Route path="admin" element={<AdminReview />} />
        {/* 11단계: 관리자 운영(가게 등록 · 긴급 정지) · 사장님 결제 기록 — Remix 대신 · 약관 */}
        <Route path="admin/ops" element={<AdminOps />} />
        <Route path="owner" element={<OwnerPayments />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
