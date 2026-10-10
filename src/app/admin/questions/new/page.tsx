import { QuestionForm } from "@/components/admin/question-form";
import { requireAdmin } from "@/lib/auth";
import { listCertifications } from "@/lib/services/catalog";

export default async function NewQuestion() {
  await requireAdmin("/admin/questions/new");
  const certs = await listCertifications();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Add question</h1>
      <QuestionForm
        certs={certs.map((c) => ({ id: c.id, exam_code: c.exam_code }))}
        initial={{
          certification_id: certs[0]?.id ?? "",
          external_ref: "",
          question_text: "",
          question_type: "single",
          options: {},
          correct_answer: [],
          explanation: "",
          topic: "",
          difficulty: "medium",
          is_free: false,
          free_order: "",
          is_active: false,
        }}
      />
    </div>
  );
}
