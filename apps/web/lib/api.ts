"use client";
import { useState, useEffect, useCallback } from "react";
let csrf: string | null = null;
export function setCsrf(value: string | null) {
  csrf = value;
}
export async function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const form = typeof FormData !== "undefined" && body instanceof FormData;
  if (method !== "GET" && !csrf) {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await r.json();
    csrf = data.csrf;
  }
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    ...(body !== undefined
      ? { body: form ? (body as FormData) : JSON.stringify(body) }
      : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Máy chủ chưa trả về dữ liệu. Vui lòng thử lại." }));
  if (!response.ok) throw new Error(data.error || "Không thể xử lý yêu cầu.");
  if (typeof data.csrf === "string" && /^[a-f0-9]{64}$/.test(data.csrf))
    setCsrf(data.csrf);
  return data as T;
}
export function useApi<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}
export function money(n: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(n));
}
export function date(s: string) {
  return new Date(s).toLocaleString("vi-VN");
}
export const categories: Record<
  string,
  { name: string; short: string; color: string; label: string }
> = {
  embedded: {
    name: "Lập trình nhúng C",
    short: "Embedded C",
    color: "blue",
    label: "PHẦN MỀM NHÚNG",
  },
  kicad: {
    name: "Thiết kế mạch KiCad",
    short: "KiCad PCB",
    color: "green",
    label: "THIẾT KẾ ĐIỆN TỬ",
  },
  solidworks: {
    name: "Thiết kế cơ khí SOLIDWORKS",
    short: "SOLIDWORKS",
    color: "orange",
    label: "THIẾT KẾ CƠ KHÍ",
  },
};
