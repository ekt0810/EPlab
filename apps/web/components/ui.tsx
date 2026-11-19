"use client";
import { cloneElement, useId, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertCircle,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
export function Notice({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {type === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>Đang tải nội dung…</span>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="empty">
      <Notice type="error">{message}</Notice>
      {retry && (
        <button className="btn secondary" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="btn primary" href={href}>
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children as ReactElement<any>, {
        id,
        "aria-describedby": hint ? id + "-hint" : undefined,
      })}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
