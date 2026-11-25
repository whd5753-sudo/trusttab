import { useSyncExternalStore } from "react";

// 11단계: 인터넷 연결 여부 (브라우저의 online · offline 이벤트)
function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine,
    () => true,
  );
}
