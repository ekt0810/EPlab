export type Track = "embedded" | "kicad" | "solidworks";
export type Progress = {
  lesson_id: string;
  scene: number;
  note: string;
  checklist: number[];
  quiz_passed: boolean;
  completed: boolean;
};
export type LessonSummary = {
  id: string;
  module: number;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  preview: boolean;
  accessible: boolean;
  objectives: string[];
  progress: Progress | null;
};
export type Lesson = LessonSummary & {
  prerequisites: string[];
  concepts: [string, string][];
  steps: string[];
  mistakes: string[];
  quiz: { question: string; options: string[] };
  sources: string[];
  deliverable: string;
  rubric: string[];
  discussion: string;
  visualGuide?: { watchFor: string[]; tryIt: string };
  code?: string;
  codeLanguage?: string;
  example?: { title: string; body: string; rows?: string[][] };
  questions?: string[];
  assignment?: {
    id: string;
    brief: string;
    checks: string[][];
    criteria: string[];
  };
};
export type Source = {
  id: string;
  title: string | null;
  track: Track;
  url: string;
  kind: string;
  reason: string;
  duration: number | null;
  start?: number;
  focus?: string;
  chapters?: { start_time: number; title: string }[];
  verification?: string;
  lessonIds?: string[];
  upload_date?: string;
  language?: "vi" | "en";
  channel?: string;
  softwareVersion?: string;
};
export type Message = {
  id: string;
  question: string;
  answer: string;
  mode: "guide" | "ai";
  evidence?: {
    matched?: boolean;
    references?: { lessonId: string; lessonTitle: string; section: string }[];
    videos?: {
      id: string;
      title: string;
      start: number;
      chapter?: string;
      focus: string;
      language?: "vi" | "en";
      channel?: string;
      softwareVersion?: string;
    }[];
    documents?: string[];
  };
};
export type Course = {
  track: Track;
  title: string;
  description: string;
  version: string;
  modules: { id: number; title: string; description: string }[];
  lessons: LessonSummary[];
  checkedAt: string;
  ai: { available: boolean; model: string | null };
  handbook: { url: string; accessible: boolean };
};
export type Detail = {
  lesson: Lesson;
  sources: Source[];
  progress: Progress | null;
  messages: Message[];
  scenes: number;
  ai: { available: boolean; model: string | null };
};
export const baseFor = (track: Track) =>
  ({ embedded: "/nhung-c", kicad: "/kicad", solidworks: "/solidworks" })[track];
export const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
