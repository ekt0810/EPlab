"use client";
import Link from "next/link";
import { BookOpen, FileDown } from "lucide-react";
import { useApi } from "../../lib/api";
import { baseFor, type Track, type Course } from "./types";
export function ClassroomHandbookCard({
  track,
  course,
}: {
  track: Track;
  course?: Course;
}) {
  const fetched = useApi<Course>(course ? null : `/api/classroom/${track}`);
  const data = course || fetched.data;
  if (!data) return null;
  return (
    <section className="panel cr-handbook-card">
      <div>
        <span className="cr-tag">GIÁO TRÌNH LỚP HỌC · V6.0</span>
        <h2>{data.title} · EP LAB</h2>
        <p>
          {data.lessons.length} bài học có lý thuyết, thực hành, tự kiểm và
          nguồn tham khảo. PDF có chữ chìm EP LAB trên từng trang.
        </p>
      </div>
      <div className="button-row">
        {!course && (
          <Link className="btn primary" href={`${baseFor(track)}/lop-hoc`}>
            <BookOpen size={17} />
            Vào lớp học
          </Link>
        )}
        {data.handbook.accessible ? (
          <a className="btn secondary" href={data.handbook.url}>
            <FileDown size={17} />
            Tải giáo trình v6
          </a>
        ) : (
          <Link className="btn secondary" href="/tham-gia-lab">
            Tham gia để tải PDF
          </Link>
        )}
      </div>
    </section>
  );
}
