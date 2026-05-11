"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import { asObject, pickString } from "@/lib/hr/utils";

function splitList(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(form: FormData, key: string) {
  const value = textValue(form, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function Field({
  label,
  children,
  span = false,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={span ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-foreground/30">{label}</span>
      {children}
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-28 w-full rounded-2xl border border-white/40 bg-white/40 px-4 py-3 text-sm leading-relaxed shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/20 placeholder:text-foreground/20 backdrop-blur-md"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-xl border border-white/40 bg-white/40 px-4 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/20 appearance-none backdrop-blur-md"
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-black/[0.03] pt-8">
      <h2 className="mb-6 text-sm font-black text-foreground tracking-tight uppercase tracking-widest opacity-40">{title}</h2>
      <div className="grid gap-6 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Toggle({ name, label, defaultChecked = true }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 border-b border-black/[0.03] py-3 last:border-0 cursor-pointer group">
      <span className="text-sm font-bold text-foreground/60 group-hover:text-pink-600 transition-colors">{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-pink-500 rounded-lg" />
    </label>
  );
}

function CheckOption({ name, value, label, defaultChecked = false }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-black/[0.03] py-2 last:border-0 cursor-pointer group">
      <input name={name} type="checkbox" value={value} defaultChecked={defaultChecked} className="size-5 accent-pink-500" />
      <span className="text-sm font-bold text-foreground/60 group-hover:text-pink-600 transition-colors">{label}</span>
    </label>
  );
}

export function ApplicationEditForm({ applicationId, initialData, members = [] }: { applicationId: string; initialData: any; members?: any[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const meta = asObject(initialData.metadata) as Record<string, any>;
  const salary = asObject(initialData.salary_range) as Record<string, any>;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const mustHaveSkills = splitList(form.get("must_have_skills"));
    const niceToHaveSkills = splitList(form.get("nice_to_have_skills"));

    const payload = {
      title: textValue(form, "title"),
      department: textValue(form, "department"),
      location: textValue(form, "location"),
      seniority: textValue(form, "seniority"),
      created_by: textValue(form, "created_by"),
      remote_policy: textValue(form, "remote_policy"),
      employment_type: textValue(form, "employment_type"),
      salary_range: {
        min: numberValue(form, "salary_min"),
        max: numberValue(form, "salary_max"),
        currency: textValue(form, "salary_currency") ?? "EUR",
      },
      description: textValue(form, "description"),
      responsibilities: textValue(form, "responsibilities"),
      requirements: mustHaveSkills.join("\n"),
      must_have_skills: mustHaveSkills,
      nice_to_have_skills: niceToHaveSkills,
      company_context: textValue(form, "company_context"),
      current_situation: textValue(form, "current_situation"),
      hiring_goal: textValue(form, "hiring_goal"),
      pain_challenge: textValue(form, "pain_challenge"),
      team_context: textValue(form, "team_context"),
      team_workflow: textValue(form, "team_workflow"),
      previous_team_work: textValue(form, "previous_team_work"),
      manager_expectations: textValue(form, "manager_expectations"),
      success_criteria: textValue(form, "success_criteria"),
      generate_contextual_pipeline: form.get("generate_contextual_pipeline") === "on",
      difficulty_level: textValue(form, "difficulty_level") ?? "medium",
      number_of_questions: numberValue(form, "number_of_questions") ?? 5,
      estimated_time_minutes: numberValue(form, "estimated_time_minutes") ?? 25,
      question_types: form.getAll("question_types").filter((value): value is string => typeof value === "string"),
      candidate_link_enabled: form.get("candidate_link_enabled") === "on",
      apply_enabled: form.get("candidate_link_enabled") === "on",
      pipeline_generation_mode: textValue(form, "pipeline_generation_mode") ?? "dynamic",
      require_cv_upload: form.get("require_cv_upload") === "on",
      require_linkedin_url: form.get("require_linkedin_url") === "on",
      use_linkedin_verification: form.get("use_linkedin_verification") === "on",
      require_cv_coherence: form.get("require_cv_coherence") === "on",
    };

    try {
      const response = await fetch(`/api/hr/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to update application");
      }

      router.push(`/hr/applications/${applicationId}/settings`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update application");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl space-y-12">
      <Section title="Basic information">
        <Field label="Job title">
          <Input name="title" required defaultValue={initialData.title} placeholder="Senior SDR - US Market" className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Company / Team">
          <Input name="department" defaultValue={initialData.department} placeholder="Sales / Pre-sales" className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Location">
          <Input name="location" defaultValue={initialData.location} placeholder="Remote / Paris / US" className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Seniority">
          <Select name="seniority" defaultValue={initialData.seniority ?? meta.seniority ?? "mid"}>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </Select>
        </Field>
        <Field label="Salary min">
          <Input name="salary_min" type="number" min="0" defaultValue={salary.min} placeholder="45000" className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Salary max">
          <Input name="salary_max" type="number" min="0" defaultValue={salary.max} placeholder="65000" className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Currency">
          <Select name="salary_currency" defaultValue={salary.currency ?? "EUR"}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
        <Field label="Work mode">
          <Select name="remote_policy" defaultValue={initialData.remote_policy ?? "remote"}>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </Select>
        </Field>
        <Field label="Responsable">
          <Select name="created_by" defaultValue={initialData.created_by}>
            {members.map((member: any) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title="Job description">
        <Field label="Description" span>
          <Textarea name="description" defaultValue={initialData.description} placeholder="General role description." />
        </Field>
        <Field label="Responsibilities" span>
          <Textarea name="responsibilities" defaultValue={initialData.responsibilities} placeholder="Main responsibilities, ownership areas and expected outcomes." />
        </Field>
        <Field label="Must-have skills">
          <Textarea name="must_have_skills" defaultValue={meta.must_have_skills?.join("\n")} placeholder="Outbound sales&#10;US market&#10;CRM hygiene" />
        </Field>
        <Field label="Nice-to-have skills">
          <Textarea name="nice_to_have_skills" defaultValue={meta.nice_to_have_skills?.join("\n")} placeholder="SaaS sales&#10;Salesforce&#10;French speaking" />
        </Field>
      </Section>

      <Section title="Company context">
        <Field label="Company context" span>
          <Textarea name="company_context" defaultValue={meta.company_context} placeholder="What the company does and how it wins." />
        </Field>
        <Field label="Current situation">
          <Textarea name="current_situation" defaultValue={meta.current_situation} placeholder="Growth, transformation, urgent hiring, new market." />
        </Field>
        <Field label="Hiring goal">
          <Textarea name="hiring_goal" defaultValue={meta.hiring_goal} placeholder="Why this role exists now." />
        </Field>
        <Field label="Pain / challenge" span>
          <Textarea name="pain_challenge" defaultValue={meta.pain_challenge} placeholder="What this person must solve." />
        </Field>
      </Section>

      <Section title="Team context">
        <Field label="Team description">
          <Textarea name="team_context" defaultValue={meta.team_context} placeholder="The team the candidate will join." />
        </Field>
        <Field label="Team workflow">
          <Textarea name="team_workflow" defaultValue={meta.team_workflow} placeholder="How the team works day to day." />
        </Field>
        <Field label="Previous work">
          <Textarea name="previous_team_work" defaultValue={meta.previous_team_work} placeholder="Examples of projects or tasks already done." />
        </Field>
        <Field label="Manager expectations">
          <Textarea name="manager_expectations" defaultValue={meta.manager_expectations} placeholder="What the manager actually expects." />
        </Field>
        <Field label="Success criteria" span>
          <Textarea name="success_criteria" defaultValue={meta.success_criteria} placeholder="What will make this candidate a strong hire." />
        </Field>
      </Section>

      <Section title="Pipeline settings">
        <div className="md:col-span-2 space-y-2">
          <Toggle name="generate_contextual_pipeline" label="Generate contextual pipeline" defaultChecked={meta.generate_contextual_pipeline !== false} />
          <Toggle name="candidate_link_enabled" label="Public apply link enabled" defaultChecked={initialData.apply_enabled === true} />
        </div>
        <Field label="Generation mode">
          <Select name="pipeline_generation_mode" defaultValue={initialData.pipeline_generation_mode ?? meta.pipeline_generation_mode ?? "dynamic"}>
            <option value="dynamic">Dynamic variations</option>
            <option value="fixed">Fixed question set</option>
          </Select>
        </Field>
        <Field label="Difficulty level">
          <Select name="difficulty_level" defaultValue={meta.difficulty_level ?? "medium"}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
        <Field label="Number of questions">
          <Input name="number_of_questions" type="number" min="1" max="12" defaultValue={meta.number_of_questions ?? 5} className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <Field label="Estimated completion time">
          <Input name="estimated_time_minutes" type="number" min="5" max="120" defaultValue={meta.estimated_time_minutes ?? 25} className="bg-white/40 border-white/40 h-11 rounded-xl" />
        </Field>
        <div className="md:col-span-2">
          <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-foreground/30">Question types</span>
          <div className="grid gap-x-6 rounded-2xl border border-white/40 bg-white/10 px-4 backdrop-blur-md md:grid-cols-2">
            <CheckOption name="question_types" value="short_answer" label="Quick timed answer" defaultChecked={meta.question_types?.includes("short_answer")} />
            <CheckOption name="question_types" value="multiple_choice" label="Multiple choice" defaultChecked={meta.question_types?.includes("multiple_choice")} />
            <CheckOption name="question_types" value="written_answer" label="Written answer" defaultChecked={meta.question_types?.includes("written_answer")} />
            <CheckOption name="question_types" value="scenario" label="Scenario" defaultChecked={meta.question_types?.includes("scenario")} />
            <CheckOption name="question_types" value="prioritization" label="Prioritization" defaultChecked={meta.question_types?.includes("prioritization")} />
            <CheckOption name="question_types" value="problem_solving" label="Problem solving" defaultChecked={meta.question_types?.includes("problem_solving")} />
          </div>
        </div>
      </Section>

      <Section title="Verification settings">
        <div className="md:col-span-2 space-y-2">
          <Toggle name="require_cv_upload" label="Require CV upload" defaultChecked={meta.require_cv_upload !== false} />
          <Toggle name="require_linkedin_url" label="Require LinkedIn URL" defaultChecked={meta.require_linkedin_url !== false} />
          <Toggle name="use_linkedin_verification" label="Use LinkedIn verification" defaultChecked={meta.use_linkedin_verification !== false} />
          <Toggle name="require_cv_coherence" label="Require CV / LinkedIn coherence" defaultChecked={meta.require_cv_coherence !== false} />
        </div>
      </Section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 text-sm text-rose-600 font-bold backdrop-blur-md">{error}</p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-black/[0.03] pt-8">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-pink-500 px-8 text-sm font-black text-white shadow-[0_8px_20px_rgba(236,72,153,0.3)] transition hover:bg-pink-600 hover:shadow-[0_12px_24px_rgba(236,72,153,0.4)] disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold text-foreground/40 hover:text-foreground/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
