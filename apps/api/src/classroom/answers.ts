import { lessonSources } from "./catalog.js";
import type { ClassroomLesson, Track } from "./model.js";

export type AnswerEvidence = {
  matched: boolean;
  references: { lessonId: string; lessonTitle: string; section: string }[];
  videos: {
    id: string;
    title: string;
    start: number;
    chapter?: string;
    focus: string;
    language?: "vi" | "en";
    channel?: string;
    softwareVersion?: string;
  }[];
  documents: string[];
};
type Passage = { lesson: ClassroomLesson; section: string; text: string };
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
const stopWords = new Set(
  "la gi tai sao nhu the nao toi minh ban can giup giai thich cho ve cua trong voi thi khi da duoc mot nhung hay va hoac de co khong nay bai hoc giao trinh xin hoi su khac nhau giua the nao bao nhieu lam dung muon hieu ro hon".split(
    " ",
  ),
);
const words = (text: string) => [
  ...new Set(
    (plain(text).match(/[a-z0-9_]+/g) || []).filter(
      (w) => !stopWords.has(w) && (w.length > 1 || w === "c"),
    ),
  ),
];
const matches = (text: string, terms: string[]) => {
  const bag = new Set(plain(text).match(/[a-z0-9_]+/g) || []);
  return terms.filter((w) => bag.has(w)).length;
};
const passages = (lesson: ClassroomLesson): Passage[] => [
  {
    lesson,
    section: "Mục tiêu bài học",
    text: [lesson.summary, ...lesson.objectives].join("\n"),
  },
  ...lesson.concepts.map(([section, text]) => ({ lesson, section, text })),
  ...(lesson.questions || []).map(([section, text]) => ({
    lesson,
    section,
    text,
  })),
  ...(lesson.example
    ? [
        {
          lesson,
          section: lesson.example.title,
          text: lesson.example.body + (lesson.code ? "\n\n" + lesson.code : ""),
        },
      ]
    : []),
  {
    lesson,
    section: "Thực hành từng bước",
    text: lesson.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
  },
  {
    lesson,
    section: "Lỗi thường gặp",
    text: lesson.mistakes.map((s) => `• ${s}`).join("\n"),
  },
];

/** Retrieve only authored passages from lessons the caller is allowed to read. */
export function handbookAnswer(
  track: Track,
  current: ClassroomLesson,
  question: string,
  allowed: ClassroomLesson[],
) {
  const terms = words(question),
    normalized = plain(question)
      .trim()
      .replace(/[?!.,]+$/g, "");
  const currentPassages = passages(current);
  let selected: Passage[] = [];
  if (["giai thich y chinh cua bai", "bai nay day gi"].includes(normalized))
    selected = currentPassages.slice(0, 2);
  else if (
    ["vi du thuc hanh cua bai", "cho toi vi du cua bai"].includes(normalized)
  )
    selected = currentPassages.filter(
      (p) => p.section === (current.example?.title || "Thực hành từng bước"),
    );
  else if (
    [
      "nhung loi can tranh trong bai",
      "toi can kiem tra nhung loi nao",
    ].includes(normalized)
  )
    selected = currentPassages.filter((p) => p.section === "Lỗi thường gặp");
  else if (terms.length) {
    const definition = /\bla gi\b|\bkhai niem\b/.test(normalized);
    const comparison = /\bkhac\b|\bphan biet\b|\bso sanh\b/.test(normalized);
    const ranked = allowed
      .flatMap(passages)
      .filter((p) => p.section !== "Mục tiêu bài học")
      .map((p) => {
        const hit = matches(p.section + " " + p.text, terms);
        const concept = p.lesson.concepts.some(
          ([title]) => title === p.section,
        );
        const exactQuestion =
          plain(p.section).replace(/[?!.,]+$/g, "") === normalized;
        return {
          ...p,
          hit,
          score:
            (hit / terms.length) * 10 +
            matches(p.section, terms) * (definition ? 1 : 2) +
            matches(p.lesson.title, terms) * (definition ? 6 : 1) +
            (concept ? 3 : 0) +
            (exactQuestion ? 25 : 0) +
            (p.lesson.id === current.id ? (comparison ? 3 : 0.5) : 0),
        };
      })
      .filter(
        (p) =>
          p.hit >= Math.min(2, terms.length) && p.hit / terms.length >= 0.5,
      )
      .sort((a, b) => b.score - a.score);
    if (ranked.length)
      selected = ranked
        .filter((p) => p.lesson.id === ranked[0].lesson.id)
        .slice(0, 2);
  }
  if (!selected.length)
    return {
      answer:
        "Chưa tìm thấy đoạn giáo trình khớp rõ với câu hỏi này. Bạn hãy thêm tên khái niệm, linh kiện, lệnh hoặc thao tác đang vướng để tra cứu chính xác hơn. Bạn cũng có thể gửi câu hỏi cho người chủ trì ở mục Trao đổi.",
      evidence: {
        matched: false,
        references: [],
        videos: [],
        documents: [],
      } satisfies AnswerEvidence,
    };
  const lesson = selected[0].lesson;
  const videos = lessonSources(track, lesson)
    .map((source, index) => {
      const chapters = (source.chapters || []).filter(
        (c) =>
          Number.isFinite(c.start_time) &&
          c.start_time >= 0 &&
          !/\b(ad|outro|courses)\b/i.test(c.title),
      );
      const chapter = chapters
        .map((c) => ({ ...c, score: matches(c.title, terms) }))
        .sort((a, b) => b.score - a.score)[0];
      const relevantChapter =
        chapter && chapter.score >= Math.min(2, Math.max(1, terms.length))
          ? chapter
          : undefined;
      const start = relevantChapter?.start_time ?? source.start;
      return {
        value: {
          id: source.id,
          title: source.title || "Video tham khảo của bài",
          start,
          chapter:
            relevantChapter?.title ||
            chapters.find((c) => c.start_time === start)?.title,
          focus: source.focus,
          language: source.language,
          channel: source.channel,
          softwareVersion: source.softwareVersion,
        },
        score:
          matches((source.title || "") + " " + source.focus, terms) +
          (relevantChapter?.score || 0) +
          (source.kind === "kicad" ? 2 : 0) -
          index * 0.01,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((v) => v.value);
  return {
    answer: selected.map((p) => `${p.section}\n\n${p.text}`).join("\n\n"),
    evidence: {
      matched: true,
      references: selected.map((p) => ({
        lessonId: p.lesson.id,
        lessonTitle: p.lesson.title,
        section: p.section,
      })),
      videos,
      documents: lesson.sources.slice(0, 3),
    } satisfies AnswerEvidence,
  };
}
