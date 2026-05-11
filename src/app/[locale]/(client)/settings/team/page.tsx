import { ShieldCheck, UserRoundCheck, Users, Plus, Trash2 } from "lucide-react";
import { ActionLink, EmptyState, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

export default async function TeamSettingsPage() {
  const { team, role } = await getSettingsWorkspaceData();
  const isOwner = role === "owner";

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
        actions={isOwner && <ActionLink href="/settings/team/invite" icon={Plus} variant="pink">Invite member</ActionLink>}
      />

      <div className="mb-10 grid gap-6 md:grid-cols-4">
        <SectionBlock title="Members" icon={Users}>
          <p className="text-3xl font-black text-foreground tracking-tight">{team.total}</p>
          <p className="mt-1 text-xs font-medium text-foreground/30 uppercase tracking-widest">Workspace users</p>
        </SectionBlock>
        <SectionBlock title="Admins" icon={ShieldCheck}>
          <p className="text-3xl font-black text-foreground tracking-tight">{team.admins}</p>
          <p className="mt-1 text-xs font-medium text-foreground/30 uppercase tracking-widest">Management roles</p>
        </SectionBlock>
        <SectionBlock title="Recruiters" icon={UserRoundCheck}>
          <p className="text-3xl font-black text-foreground tracking-tight">{team.recruiters}</p>
          <p className="mt-1 text-xs font-medium text-foreground/30 uppercase tracking-widest">Flow managers</p>
        </SectionBlock>
        <SectionBlock title="Reviewers">
          <p className="text-3xl font-black text-foreground tracking-tight">{team.reviewers}</p>
          <p className="mt-1 text-xs font-medium text-foreground/30 uppercase tracking-widest">Compliance roles</p>
        </SectionBlock>
      </div>

      {team.members.length ? (
        <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/20 backdrop-blur-md shadow-sm">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/[0.03] text-left text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 bg-black/[0.01]">
                <th className="px-6 py-4 font-bold">Member</th>
                <th className="px-6 py-4 font-bold">Email</th>
                <th className="px-6 py-4 font-bold">Role</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Joined</th>
                {isOwner && <th className="px-6 py-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {team.members.map((member) => (
                <tr key={member.id} className="transition hover:bg-black/[0.02]">
                  <td className="px-6 py-4 font-bold text-foreground">{member.name}</td>
                  <td className="px-6 py-4 text-foreground/50 font-medium">{member.email}</td>
                  <td className="px-6 py-4"><StatusBadge>{member.role}</StatusBadge></td>
                  <td className="px-6 py-4"><StatusBadge>{member.status}</StatusBadge></td>
                  <td className="px-6 py-4 text-foreground/40 font-medium">{member.joinedAt}</td>
                  {isOwner && (
                    <td className="px-6 py-4 text-right">
                      {member.role !== "owner" && (
                        <button className="p-2 text-foreground/20 hover:text-rose-500 transition-colors" title="Remove member">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  )}
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
