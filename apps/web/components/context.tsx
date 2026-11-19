"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { api, setCsrf } from "../lib/api";
type User = {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: string;
  verified: boolean;
  active: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
};
const Context = createContext<{
  user: User | null;
  loading: boolean;
  publicMode: boolean;
  mailMode: string;
  refresh: () => Promise<void>;
}>({
  user: null,
  loading: true,
  publicMode: false,
  mailMode: "",
  refresh: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState("");
  const [state, setState] = useState({
    user: null as User | null,
    loading: true,
    publicMode: false,
    mailMode: "",
  });
  const refresh = async () => {
    try {
      const data = await api("/api/auth/me");
      setCsrf(data.csrf);
      setState({ ...data, loading: false });
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setState((s) => ({ ...s, loading: false }));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <Context.Provider value={{ ...state, refresh }}>
      {error && !state.user ? (
        <div className="panel empty" role="alert">
          <h2>Chưa kiểm tra được phiên đăng nhập</h2>
          <p>{error}</p>
          <button className="btn primary" onClick={() => void refresh()}>
            Thử lại
          </button>
        </div>
      ) : (
        children
      )}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
