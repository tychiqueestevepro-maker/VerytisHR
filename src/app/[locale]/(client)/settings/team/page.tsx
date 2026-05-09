import { ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import { EmptyState, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

export default async function TeamSettingsPage() {
  const { team, role } = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Settings"
        title="Team"
        meta={
          <>
            <span>{team.total} members</span>
            <span>{team.admins} admins</span>
            <span>Your role: {role}</span>
          </>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <SectionBlock title="Members" icon={Users}>
          <p className="text-2xl font-semibold text-foreground">{team.total}</p>
          <p className="mt-2 text-sm text-foreground/45">Active workspace users</p>
        </SectionBlock>
        <SectionBlock title="Admins" icon={ShieldCheck}>
          <p className="text-2xl font-semibold text-foreground">{team.admins}</p>
          <p className="mt-2 text-sm text-foreground/45">Owner or admin roles</p>
        </SectionBlock>
        <SectionBlock title="Recruiters" icon={UserRoundCheck}>
          <p className="text-2xl font-semibold text-foreground">{team.recruiters}</p>
          <p className="mt-2 text-sm text-foreground/45">Can manage applications</p>
        </SectionBlock>
        <SectionBlock title="Reviewers">
          <p className="text-2xl font-semibold text-foreground">{team.reviewers}</p>
          <p className="mt-2 text-sm text-foreground/45">Can review evaluations</p>
        </SectionBlock>
      </div>

      {team.members.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                <th className="px-3 py-3 font-medium">Member</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last seen</th>
                <th className="px-3 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {team.members.map((member) => (
                <tr key={member.id} className="transition hover:bg-secondary/35">
                  <td className="px-3 py-4 font-medium text-foreground">{member.name}</td>
                  <td className="px-3 py-4 text-foreground/65">{member.email}</td>
                  <td className="px-3 py-4"><StatusBadge>{member.role}</StatusBadge></td>
                  <td className="px-3 py-4"><StatusBadge>{member.status}</StatusBadge></td>
                  <td className="px-3 py-4 text-foreground/55">{member.lastSeen}</td>
                  <td className="px-3 py-4 text-foreground/55">{member.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No team members" detail="No active users are attached to this company yet." />
      )}
    </div>
  );
}
