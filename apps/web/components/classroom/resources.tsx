"use client";
import { useAuth } from "../context";
import { useApi } from "../../lib/api";
import { subjects } from "../../lib/subjects";
import { ErrorBox, Loading } from "../ui";
import { ClassroomHandbookCard } from "./handbook-card";
import { SourceLibrary } from "./sources";
import type { Course, Track } from "./types";

export function ClassroomResources({
  track,
  course,
}: {
  track: Track;
  course: Course;
}) {
  const { user } = useAuth();
  return (
    <div className="cr-resources">
      <ClassroomHandbookCard track={track} course={course} />
      <SourceLibrary track={track} />
      {user?.role === "admin" && <HostDocuments track={track} />}
    </div>
  );
}

function HostDocuments({ track }: { track: Track }) {
  const subject = subjects.find((s) => s.id === track)!;
  const { data, error, loading, reload } = useApi<any[]>(
    `/api/courses/${subject.course}/resources`,
  );
  const documents =
    data?.filter(
      (file) => file.audience === "host" && file.accessible && file.resourceId,
    ) || [];
  return (
    <details className="cr-host-documents panel">
      <summary>Tài liệu dành cho người chủ trì</summary>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : documents.length ? (
        <ul className="cr-documents">
          {documents.map((file) => (
            <li key={file.resourceId}>
              <a href={`/api/files/${file.resourceId}`}>
                {file.title} · {file.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>Chưa có tài liệu nội bộ cho môn này.</p>
      )}
    </details>
  );
}
