"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  subjects,
  subjectSection,
  subjectSections,
  type Subject,
} from "../lib/subjects";
export function SubjectNav({ subject }: { subject: Subject }) {
  const path = usePathname(),
    router = useRouter(),
    params = useSearchParams(),
    active = subjectSection(path);
  return (
    <header className="subject-header">
      <div className="subject-heading">
        <div>
          <nav className="subject-breadcrumb" aria-label="Đường dẫn môn học">
            <Link href="/">EP LAB</Link>
            <span aria-hidden="true">/</span>
            <Link href={subject.base + "/lop-hoc"}>{subject.short}</Link>
            <span aria-hidden="true">/</span>
            <span>{subjectSections.find((x) => x.key === active)?.label}</span>
          </nav>
        </div>
        <label className="subject-switch">
          Đổi môn
          <select
            aria-label="Đổi môn"
            value={subject.id}
            onChange={(e) => {
              const next = subjects.find((s) => s.id === e.target.value)!;
              router.push(
                `${next.base}/${active}${active === "lop-hoc" && params.get("tab") === "resources" ? "?tab=resources" : ""}`,
              );
            }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="subject-tabs" aria-label="Điều hướng môn học">
        {subjectSections.map((s, i) => (
          <Link
            key={s.key}
            href={`${subject.base}/${s.key}`}
            className={active === s.key ? "selected" : ""}
            aria-current={active === s.key ? "page" : undefined}
          >
            <span aria-hidden="true">0{i + 1}</span>
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
