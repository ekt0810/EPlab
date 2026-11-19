import embedded from "./data/embedded.json" with { type: "json" };
import kicad from "./data/kicad.json" with { type: "json" };
import solidworks from "./data/solidworks.json" with { type: "json" };
import audit from "./data/sources.json" with { type: "json" };
import solidworksVideos from "./data/solidworks-videos.json" with { type: "json" };
import type {
  ClassroomCourse,
  ClassroomLesson,
  SourceRecord,
  Track,
} from "./model.js";

// Keep online video supplements separate from the authored PDF curriculum.
// Rebuilding the books must not discard curated video mappings.
const visual = solidworksVideos as unknown as {
  lessons: Record<string, Pick<ClassroomLesson, "videos" | "visualGuide">>;
  sources: (SourceRecord & { lessonIds: string[] })[];
};
export const courses: Record<Track, ClassroomCourse> = {
  embedded,
  kicad,
  solidworks: {
    ...solidworks,
    lessons: solidworks.lessons.map((lesson) => ({
      ...lesson,
      ...visual.lessons[lesson.id],
    })),
  },
} as unknown as Record<Track, ClassroomCourse>;
export const sourceAudit = {
  ...audit,
  sources: [...audit.sources, ...visual.sources],
} as unknown as {
  checkedAt: string;
  method: string;
  sources: (SourceRecord & { lessonIds: string[] })[];
};
export function findLesson(track: Track, id: string) {
  return courses[track].lessons.find((l) => l.id === id);
}
export function publicLesson(lesson: ClassroomLesson) {
  const { quiz, questions, ...rest } = lesson;
  return {
    ...rest,
    questions: questions?.map((q) => q[0]),
    quiz: { question: quiz.question, options: quiz.options },
  };
}
export function lessonSources(track: Track, lesson: ClassroomLesson) {
  return lesson.videos.flatMap((reference) => {
    const source = sourceAudit.sources.find(
      (v) =>
        v.track === track &&
        v.id === reference.id &&
        !["excluded", "unavailable"].includes(v.kind),
    );
    return source
      ? [
          {
            ...source,
            start: reference.start || 0,
            focus:
              reference.focus ||
              "Nguồn tham khảo cho chủ đề; bài thực hành do EP LAB biên soạn.",
          },
        ]
      : [];
  });
}
export function sceneCount(lesson: ClassroomLesson) {
  return 1 + lesson.concepts.length + (lesson.example ? 1 : 0) + 2;
}
