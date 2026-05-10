"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Input } from "@/components/ui/input";

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
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/40">{label}</span>
      {children}
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
    <section className="border-t border-border pt-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Toggle({ name, label, defaultChecked = true }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 border-b border-border/70 py-3 last:border-0">
      <span className="text-sm text-foreground/70">{label}</span>
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 accent-foreground" />
    </label>
  );
}

function CheckOption({ name, value, label, defaultChecked = false }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-10 items-center gap-3 border-b border-border/70 py-2 last:border-0">
      <input name={name} type="checkbox" value={value} defaultChecked={defaultChecked} className="size-4 accent-foreground" />
      <span className="text-sm text-foreground/70">{label}</span>
    </label>
  );
}

export function ApplicationCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function uploadWorkSamples(applicationId: string, form: FormData) {
    const content = textValue(form, "work_samples");
    const file = form.get("work_sample_file");
    const hasFile = file instanceof File && file.size > 0;
    if (!content && !hasFile) return;

    const sampleForm = new FormData();
    sampleForm.set("sampleType", "real_team_material");
    if (content) sampleForm.set("content", content);
    if (hasFile) sampleForm.set("file", file);

    const response = await fetch(`/api/hr/applications/${applicationId}/work-samples`, {
      method: "POST",
      body: sampleForm,
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof body.error === "string" ? body.error : "Unable to upload work sample");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const mustHaveSkills = splitList(form.get("must_have_skills"));
    const niceToHaveSkills = splitList(form.get("nice_to_have_skills"));
    const workSamples = textValue(form, "work_samples");

    const payload = {
      title: textValue(form, "title"),
      department: textValue(form, "department"),
      location: textValue(form, "location"),
      seniority: textValue(form, "seniority"),
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
      work_samples: workSamples,
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
      workflow_type: "application",
    };

    try {
      const response = await fetch("/api/hr/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to create application");
      }

      const id = body?.application?.id ?? body?.mission?.id;
      if (typeof id !== "string") throw new Error("Application created, but the response did not include an id");

      await uploadWorkSamples(id, form);
      router.push(`/hr/applications/${id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create application");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl space-y-8">
      <Section title="Basic information">
        <Field label="Job title">
          <Input name="title" required placeholder="Senior SDR - US Market" />
        </Field>
        <Field label="Company / Team">
          <Input name="department" placeholder="Sales / Pre-sales" />
        </Field>
        <Field label="Location">
          <Input name="location" placeholder="Remote / Paris / US" />
        </Field>
        <Field label="Seniority">
          <Select name="seniority" defaultValue="mid">
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </Select>
        </Field>
        <Field label="Salary min">
          <Input name="salary_min" type="number" min="0" placeholder="45000" />
        </Field>
        <Field label="Salary max">
          <Input name="salary_max" type="number" min="0" placeholder="65000" />
        </Field>
        <Field label="Currency">
          <Select name="salary_currency" defaultValue="EUR">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
        <Field label="Work mode">
          <Select name="remote_policy" defaultValue="remote">
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </Select>
        </Field>
      </Section>

      <Section title="Job description">
        <Field label="Description" span>
          <Textarea name="description" placeholder="General role description." />
        </Field>
        <Field label="Responsibilities" span>
          <Textarea name="responsibilities" placeholder="Main responsibilities, ownership areas and expected outcomes." />
        </Field>
        <Field label="Must-have skills">
          <Textarea name="must_have_skills" placeholder="Outbound sales&#10;US market&#10;CRM hygiene" />
        </Field>
        <Field label="Nice-to-have skills">
          <Textarea name="nice_to_have_skills" placeholder="SaaS sales&#10;Salesforce&#10;French speaking" />
        </Field>
      </Section>

      <Section title="Company context">
        <Field label="Company context" span>
          <Textarea name="company_context" placeholder="What the company does and how it wins." />
        </Field>
        <Field label="Current situation">
          <Textarea name="current_situation" placeholder="Growth, transformation, urgent hiring, new market." />
        </Field>
        <Field label="Hiring goal">
          <Textarea name="hiring_goal" placeholder="Why this role exists now." />
        </Field>
        <Field label="Pain / challenge" span>
          <Textarea name="pain_challenge" placeholder="What this person must solve." />
        </Field>
      </Section>

      <Section title="Team context">
        <Field label="Team description">
          <Textarea name="team_context" placeholder="The team the candidate will join." />
        </Field>
        <Field label="Team workflow">
          <Textarea name="team_workflow" placeholder="How the team works day to day." />
        </Field>
        <Field label="Previous work">
          <Textarea name="previous_team_work" placeholder="Examples of projects or tasks already done." />
        </Field>
        <Field label="Work samples / real material" span>
          <div className="space-y-3">
            <Textarea
              name="work_samples"
              placeholder="Paste a real task, client case, code excerpt, internal process, mission example or frequent business situation."
            />
            <Input
              name="work_sample_file"
              type="file"
              accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.java,.cs,.sql,.yaml,.yml,.xml,.html,.css,.scss"
            />
          </div>
        </Field>
        <Field label="Manager expectations">
          <Textarea name="manager_expectations" placeholder="What the manager actually expects." />
        </Field>
        <Field label="Success criteria" span>
          <Textarea name="success_criteria" placeholder="What will make this candidate a strong hire." />
        </Field>
      </Section>

      <Section title="Pipeline settings">
        <div className="md:col-span-2">
          <Toggle name="generate_contextual_pipeline" label="Generate contextual pipeline" />
          <Toggle name="candidate_link_enabled" label="Public apply link enabled" />
        </div>
        <Field label="Generation mode">
          <Select name="pipeline_generation_mode" defaultValue="dynamic">
            <option value="dynamic">Dynamic variations</option>
            <option value="fixed">Fixed question set</option>
          </Select>
        </Field>
        <Field label="Difficulty level">
          <Select name="difficulty_level" defaultValue="medium">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
        <Field label="Number of questions">
          <Input name="number_of_questions" type="number" min="1" max="12" defaultValue="5" />
        </Field>
        <Field label="Estimated completion time">
          <Input name="estimated_time_minutes" type="number" min="5" max="120" defaultValue="25" />
        </Field>
        <div className="md:col-span-2">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/40">Question types</span>
          <div className="grid gap-x-6 rounded-md border border-border px-3 md:grid-cols-2">
            <CheckOption name="question_types" value="short_answer" label="Quick timed answer" defaultChecked />
            <CheckOption name="question_types" value="multiple_choice" label="Multiple choice" defaultChecked />
            <CheckOption name="question_types" value="written_answer" label="Written answer" defaultChecked />
            <CheckOption name="question_types" value="scenario" label="Scenario" defaultChecked />
            <CheckOption name="question_types" value="prioritization" label="Prioritization" defaultChecked />
            <CheckOption name="question_types" value="problem_solving" label="Problem solving" defaultChecked />
          </div>
        </div>
      </Section>

      <Section title="Verification settings">
        <div className="md:col-span-2">
          <Toggle name="require_cv_upload" label="Require CV upload" />
          <Toggle name="require_linkedin_url" label="Require LinkedIn URL" />
          <Toggle name="use_linkedin_verification" label="Use LinkedIn verification" />
          <Toggle name="require_cv_coherence" label="Require CV / LinkedIn coherence" />
        </div>
      </Section>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border pt-5">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create application
        </button>
      </div>
    </form>
  );
}
