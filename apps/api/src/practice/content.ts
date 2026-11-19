import curriculum from "./curriculum.json" with { type: "json" };
import library from "./videos.json" with { type: "json" };
export { curriculum, library };
export type Exercise = (typeof curriculum.exercises)[number];
export type StudyLesson = (typeof curriculum.lessons)[number];
export function publicStudy(body: StudyLesson) {
  return {
    ...body,
    quiz: { question: body.quiz.question, options: body.quiz.options },
  };
}
