import App from "../../components/App";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Đang tải EP LAB…</div>}>
      <App />
    </Suspense>
  );
}
