"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
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

function numberValue(form: FormData, key: string, fallback: number) {
  const value = textValue(form, key);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export function ImportTargetForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const mustHaveSkills = splitList(form.get("must_have_skills"));
    const niceToHaveSkills = splitList(form.get("nice_to_have_skills"));
    const prioritySignals = splitList(form.get("priority_signals"));
    const disqualifiers = splitList(form.get("disqualifiers"));

    const payload = {
      title: textValue(form, "title"),
      department: textValue(form, "department"),
      location: textValue(form, "location"),
      seniority: textValue(form, "seniority"),
      remote_policy: textValue(form, "remote_policy"),
      employment_type: textValue(form, "employment_type"),
      status: "open",
      priority: textValue(form, "priority") ?? "medium",
      description: textValue(form, "description"),
      responsibilities: textValue(form, "responsibilities"),
      requirements: mustHaveSkills.join("\n"),
      must_have_skills: mustHaveSkills,
      nice_to_have_skills: niceToHaveSkills,
      import_list_name: textValue(form, "import_list_name"),
      import_source: textValue(form, "import_source"),
      target_profiles: textValue(form, "target_profiles"),
      qualification_goal: textValue(form, "qualification_goal"),
      priority_signals: prioritySignals,
      disqualifiers,
      company_context: textValue(form, "company_context"),
      hiring_goal: textValue(form, "hiring_goal"),
      pain_challenge: textValue(form, "pain_challenge"),
      team_context: textValue(form, "team_context"),
      manager_expectations: textValue(form, "manager_expectations"),
      success_criteria: textValue(form, "success_criteria"),
      fit_threshold: numberValue(form, "fit_threshold", 80),
      opportunity_threshold: numberValue(form, "opportunity_threshold", 70),
      profile_confidence_threshold: numberValue(form, "profile_confidence_threshold", 75),
      use_linkedin_verification: form.get("use_linkedin_verification") === "on",
      require_linkedin_consistency: form.get("require_linkedin_consistency") === "on",
      generate_contextual_pipeline: false,
      candidate_link_enabled: false,
      qualification_strictness: textValue(form, "qualification_strictness") ?? "balanced",
      workflow_type: "sourcing",
    };

    try {
      const response = await fetch("/api/hr/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to create import target");
      }

      const id = body?.mission?.id;
      if (typeof id !== "string") throw new Error("Target created, but the response did not include an id");

      router.push(`/hr/sourcing/${id}/import`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create import target");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl space-y-8">
      <Section title="Target mission">
        <Field label="Target role">
          <Input name="title" required placeholder="Senior Account Executive - France" />
        </Field>
        <Field label="Company / Team">
          <Input name="department" placeholder="Sales / Revenue" />
        </Field>
        <Field label="Location">
          <Input name="location" placeholder="Paris / Remote / Europe" />
        </Field>
        <Field label="Seniority">
          <Select name="seniority" defaultValue="mid">
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </Select>
        </Field>
        <Field label="Work mode">
          <Select name="remote_policy" defaultValue="hybrid">
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </Select>
        </Field>
        <Field label="Contract">
          <Select name="employment_type" defaultValue="full_time">
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </Select>
        </Field>
      </Section>

      <Section title="Imported list context">
        <Field label="List name">
          <Input name="import_list_name" placeholder="Outbound AE shortlist - May" />
        </Field>
        <Field label="Source">
          <Select name="import_source" defaultValue="csv">
            <option value="csv">CSV / spreadsheet</option>
            <option value="linkedin">LinkedIn search</option>
            <option value="ats">ATS / internal database</option>
            <option value="referral">Referral list</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Who is inside this list?" span>
          <Textarea name="target_profiles" placeholder="Profiles already identified: current AEs in B2B SaaS, 3+ years closing experience, France or remote Europe." />
        </Field>
        <Field label="Qualification goal" span>
          <Textarea name="qualification_goal" placeholder="Rank who should be contacted first, who needs manual review, and who should be rejected for this mission." />
        </Field>
        <Field label="Priority signals">
          <Textarea name="priority_signals" placeholder="Closed mid-market deals&#10;Sold to HR teams&#10;French + English" />
        </Field>
        <Field label="Hard exclusions">
          <Textarea name="disqualifiers" placeholder="No outbound experience&#10;Only B2C background&#10;Outside target geography" />
        </Field>
      </Section>

      <Section title="Role criteria">
        <Field label="Role description" span>
          <Textarea name="description" placeholder="What the person will do and why this role matters." />
        </Field>
        <Field label="Responsibilities" span>
          <Textarea name="responsibilities" placeholder="Main ownership areas, day-to-day work and expected outcomes." />
        </Field>
        <Field label="Must-have skills">
          <Textarea name="must_have_skills" placeholder="Outbound sales&#10;B2B SaaS&#10;Full-cycle closing" />
        </Field>
        <Field label="Nice-to-have skills">
          <Textarea name="nice_to_have_skills" placeholder="HR tech&#10;HubSpot&#10;MEDDIC" />
        </Field>
      </Section>

      <Section title="Company and team context">
        <Field label="Company context" span>
          <Textarea name="company_context" placeholder="What the company does, market, stage and positioning." />
        </Field>
        <Field label="Hiring goal">
          <Textarea name="hiring_goal" placeholder="Why this list is being qualified now." />
        </Field>
        <Field label="Pain / challenge">
          <Textarea name="pain_challenge" placeholder="What this hire must solve." />
        </Field>
        <Field label="Team context">
          <Textarea name="team_context" placeholder="Team structure and manager context." />
        </Field>
        <Field label="Manager expectations">
          <Textarea name="manager_expectations" placeholder="What the manager will actually look for." />
        </Field>
        <Field label="Success criteria" span>
          <Textarea name="success_criteria" placeholder="What makes a profile a strong fit for this imported list." />
        </Field>
      </Section>

      <Section title="Analysis settings">
        <div className="md:col-span-2">
          <Toggle name="use_linkedin_verification" label="Use LinkedIn verification" />
          <Toggle name="require_linkedin_consistency" label="Verify LinkedIn profile consistency" />
        </div>
        <Field label="Fit threshold">
          <Input name="fit_threshold" type="number" min="0" max="100" defaultValue="80" />
        </Field>
        <Field label="Opportunity threshold">
          <Input name="opportunity_threshold" type="number" min="0" max="100" defaultValue="70" />
        </Field>
        <Field label="Profile confidence threshold">
          <Input name="profile_confidence_threshold" type="number" min="0" max="100" defaultValue="75" />
        </Field>
        <Field label="Qualification strictness">
          <Select name="qualification_strictness" defaultValue="balanced">
            <option value="loose">Loose</option>
            <option value="balanced">Balanced</option>
            <option value="strict">Strict</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
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
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Create target and import profiles
        </button>
      </div>
    </form>
  );
}
