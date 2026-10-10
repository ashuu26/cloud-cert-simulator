import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/question-form";
import { requireAdmin } from "@/lib/auth";
import { getQuestion } from "@/lib/services/admin-questions";
import { listCertifications } from "@/lib/services/catalog";

export default async function EditQuestion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/questions/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [q, certs] = await Promise.all([getQuestion(id), listCertifications()]);
  if (!q) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit question</h1>
      <QuestionForm
        certs={certs.map((c) => ({ id: c.id, exam_code: c.exam_code }))}
        initial={{
          id: q.id,
          certification_id: q.certification_id,
          external_ref: q.external_ref ?? "",
          question_text: q.question_text,
          question_type: q.question_type,
          options: Object.fromEntries(q.options.map((o) => [o.key, o.text])),
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          topic: q.topic,
          difficulty: q.difficulty,
          is_free: q.is_free,
          free_order: q.free_order?.toString() ?? "",
          is_active: q.is_active,
        }}
      />
    </div>
  );
}
