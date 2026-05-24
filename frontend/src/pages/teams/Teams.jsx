import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  AlertTriangle,
  Copy,
  Mail,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus2,
  UsersRound,
} from 'lucide-react';
import teamService from '../../services/teamService';
import { SkeletonBlock } from '../../components/feedback/Skeleton';
import { useAuth } from '../../hooks/useAuth';

const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const tableShellClass = 'overflow-x-auto rounded-2xl border border-slate-200 bg-white';
const tableHeadClass = 'bg-slate-50/90 text-slate-600';
const tableRowClass = 'transition-colors hover:bg-slate-50/80';
const tableHeaderCellClass = 'px-4 py-3 font-semibold';
const tableCellClass = 'px-4 py-3 text-slate-600';

const getInitials = (name = '') => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return initials || 'NA';
};

const TeamsSkeleton = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <SkeletonBlock className="h-7 w-48" />
      <SkeletonBlock className="mt-2 h-4 w-full max-w-xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-16 rounded-xl" />
        <SkeletonBlock className="h-16 rounded-xl" />
        <SkeletonBlock className="h-16 rounded-xl" />
      </div>
    </div>

    {Array.from({ length: 3 }).map((_, idx) => (
      <div key={idx} className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-100 px-5 py-4">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-2 h-4 w-64" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }).map((__, row) => (
            <SkeletonBlock key={row} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const SectionShell = ({ icon: Icon, title, subtitle, action, children }) => (
  <section className={`${cardClass} overflow-hidden`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Icon size={16} />
          </span>
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const IconButton = ({ onClick, title, tone = 'default', children }) => {
  const toneClass =
    tone === 'danger'
      ? 'border border-rose-100 text-rose-600 hover:bg-rose-50'
      : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-blue-700';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${toneClass}`}
    >
      {children}
    </button>
  );
};

const MemberIdentity = ({ name, subtitle, tone = 'blue' }) => {
  const toneClass =
    tone === 'violet'
      ? 'bg-violet-100 text-violet-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-blue-100 text-blue-700';

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold ${toneClass}`}
      >
        {getInitials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{name || 'Unnamed'}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
};

const ModalShell = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#eff6ff_0%,_#f8fafc_45%,_#eef2ff_100%)] px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

const Teams = () => {
  const { user } = useAuth();
  const companyUuid = user?.company?.uuid || user?.companyUuid || user?.companyId || 'N/A';

  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [roleModal, setRoleModal] = useState(null);
  const [memberModal, setMemberModal] = useState(false);
  const [editMember, setEditMember] = useState(null);

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
  });

  const [memberForm, setMemberForm] = useState({
    fullName: '',
    email: '',
    passcode: '',
    companyRoleId: '',
  });

  const [editForm, setEditForm] = useState({ companyRoleId: '' });

  const copyCompanyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(String(companyUuid));
      toast.success('Company UUID copied.');
    } catch {
      toast.error('Unable to copy Company UUID.');
    }
  }, [companyUuid]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([teamService.listRoles(), teamService.listMembers()]);
      setRoles(r);
      setMembers(m);
    } catch (e) {
      const status = e.response?.status;
      const base = e.message || 'Failed to load teams data.';
      toast.error(
        status
          ? `${base}${status === 503 ? ' (server could not update the database schema.)' : ''}`
          : base
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const adminMembers = useMemo(
    () => members.filter((m) => m.systemRole === 'admin'),
    [members]
  );

  const rolesOrdered = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [roles]
  );

  const membersByRoleId = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => map.set(role.id, []));
    members.forEach((m) => {
      if (m.systemRole === 'admin') return;
      const rid = m.companyRole?.id;
      if (rid != null && map.has(rid)) {
        map.get(rid).push(m);
      }
    });
    return map;
  }, [roles, members]);

  const roleIds = useMemo(() => new Set(roles.map((r) => r.id)), [roles]);
  const unassignedMembers = useMemo(
    () =>
      members.filter(
        (m) => m.systemRole !== 'admin' && (!m.companyRole || !roleIds.has(m.companyRole.id))
      ),
    [members, roleIds]
  );

  const roleCount = roles.length;
  const memberCount = members.filter((m) => m.systemRole !== 'admin').length;
  const adminCount = adminMembers.length;

  const openCreateRole = () => {
    setRoleForm({ name: '', description: '' });
    setRoleModal('create');
  };

  const openEditRole = (role) => {
    setRoleForm({
      name: role.name,
      description: role.description ?? '',
    });
    setRoleModal({ mode: 'edit', id: role.id });
  };

  const submitRole = async (event) => {
    event.preventDefault();
    if (!roleForm.name.trim()) {
      toast.error('Role name is required.');
      return;
    }

    try {
      if (roleModal === 'create') {
        await teamService.createRole({
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
        });
        toast.success('Role created.');
      } else if (roleModal?.mode === 'edit') {
        await teamService.updateRole(roleModal.id, {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
        });
        toast.success('Role updated.');
      }
      setRoleModal(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not save role.');
    }
  };

  const removeRole = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await teamService.deleteRole(role.id);
      toast.success('Role removed.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not delete role.');
    }
  };

  const openCreateMemberForRole = (role) => {
    setMemberForm({
      fullName: '',
      email: '',
      passcode: '',
      companyRoleId: String(role.id),
    });
    setMemberModal(true);
  };

  const submitMember = async (event) => {
    event.preventDefault();
    if (memberForm.passcode.length < 6) {
      toast.error('Passcode must be at least 6 characters.');
      return;
    }

    try {
      await teamService.createMember({
        fullName: memberForm.fullName.trim(),
        email: memberForm.email.trim(),
        password: memberForm.passcode,
        companyRoleId: Number(memberForm.companyRoleId),
      });
      toast.success('Team member added. They sign in with this email and passcode.');
      setMemberModal(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not add member.');
    }
  };

  const openEditMember = (member) => {
    if (member.systemRole === 'admin') {
      toast.error('Organization admins are managed separately.');
      return;
    }

    setEditForm({
      companyRoleId: member.companyRole?.id ?? '',
    });
    setEditMember(member);
  };

  const submitEditMember = async (event) => {
    event.preventDefault();
    if (!editForm.companyRoleId) {
      toast.error('Select a team role.');
      return;
    }

    try {
      await teamService.updateMember(editMember.id, {
        companyRoleId: Number(editForm.companyRoleId),
      });
      toast.success('Member updated.');
      setEditMember(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update member.');
    }
  };

  const removeMember = async (member) => {
    if (member.systemRole === 'admin') {
      toast.error('Cannot remove admins from this screen.');
      return;
    }
    if (!window.confirm(`Remove ${member.fullName} from the workspace?`)) return;

    try {
      await teamService.deleteMember(member.id);
      toast.success('Member removed.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not remove member.');
    }
  };

  if (loading && members.length === 0 && roles.length === 0) {
    return <TeamsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <section className={`${cardClass} relative overflow-hidden`}>
        <div className="relative overflow-hidden bg-[linear-gradient(125deg,_rgba(15,23,42,1)_0%,_rgba(30,64,175,1)_52%,_rgba(37,99,235,1)_100%)] px-5 py-6 text-white sm:px-6">
          <span className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-16 left-16 h-44 w-44 rounded-full bg-blue-300/20 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                <UsersRound size={28} />
                Closira Team Workspace
              </h1>
              <p className="mt-2 text-sm text-blue-100 sm:text-base">
                Build your Closira team structure with clear roles, fast onboarding, and visibility into every customer-communication team.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                  Live Closira roster
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
                  Role-based structure
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-xs font-semibold">
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
                <p className="text-blue-100">Roles</p>
                <p className="mt-0.5 text-lg text-white">{roleCount}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
                <p className="text-blue-100">Members</p>
                <p className="mt-0.5 text-lg text-white">{memberCount}</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
                <p className="text-blue-100">Admins</p>
                <p className="mt-0.5 text-lg text-white">{adminCount}</p>
              </div>
            </div>
          </div>
        </div>

        
      </section>

      <SectionShell
        icon={Settings2}
        title="Role Definitions"
        subtitle="Define company roles used to group and assign members."
        action={
          <button
            type="button"
            onClick={openCreateRole}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus size={16} />
            New Role
          </button>
        }
      >
        <div className={tableShellClass}>
          <table className="w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className={tableHeaderCellClass}>Role Name</th>
                <th className={tableHeaderCellClass}>Description</th>
                <th className={tableHeaderCellClass}>Members</th>
                <th className={`${tableHeaderCellClass} w-28 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rolesOrdered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    No roles created yet. Add your first role to start assigning members.
                  </td>
                </tr>
              ) : (
                rolesOrdered.map((role) => {
                  const count = (membersByRoleId.get(role.id) || []).length;
                  return (
                    <tr key={role.id} className={tableRowClass}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Settings2 size={15} />
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{role.name}</p>
                            <p className="text-xs text-slate-500">Role ID: {role.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <span className="line-clamp-2">{role.description || 'No description added yet.'}</span>
                      </td>
                      <td className={tableCellClass}>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <UsersRound size={13} />
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton onClick={() => openEditRole(role)} title="Edit role">
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton onClick={() => removeRole(role)} title="Delete role" tone="danger">
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell
        icon={ShieldCheck}
        title="Administrators"
        subtitle="Company admins created during onboarding. Managed separately."
      >
        <div className={tableShellClass}>
          <table className="w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className={tableHeaderCellClass}>Name</th>
                <th className={tableHeaderCellClass}>Email</th>
                <th className={tableHeaderCellClass}>System Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {adminMembers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No administrators listed.
                  </td>
                </tr>
              ) : (
                adminMembers.map((member) => (
                  <tr key={member.id} className={tableRowClass}>
                    <td className="px-4 py-3">
                      <MemberIdentity
                        name={member.fullName}
                        subtitle="Organization administrator"
                        tone="violet"
                      />
                    </td>
                    <td className={tableCellClass}>
                      <span className="inline-flex items-center gap-1">
                        <Mail size={14} />
                        {member.email}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        Admin
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <div className="grid gap-6 2xl:grid-cols-2">
        {rolesOrdered.map((role) => {
          const rows = membersByRoleId.get(role.id) || [];

          return (
            <SectionShell
              key={role.id}
              icon={UsersRound}
              title={role.name}
              subtitle={`${rows.length} member${rows.length === 1 ? '' : 's'} in this role`}
              action={
                <button
                  type="button"
                  onClick={() => openCreateMemberForRole(role)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <UserPlus2 size={16} />
                  Add Member
                </button>
              }
            >
              <div className={tableShellClass}>
                <table className="w-full text-left text-sm">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className={tableHeaderCellClass}>Name</th>
                      <th className={tableHeaderCellClass}>Email</th>
                      <th className={tableHeaderCellClass}>Access</th>
                      <th className={`${tableHeaderCellClass} w-28 text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          No members in this role yet.
                        </td>
                      </tr>
                    ) : (
                      rows.map((member) => {
                        const accessLabel = member.systemRole || 'employee';
                        return (
                          <tr key={member.id} className={tableRowClass}>
                            <td className="px-4 py-3">
                              <MemberIdentity name={member.fullName} subtitle={accessLabel} />
                            </td>
                            <td className={tableCellClass}>
                              <span className="inline-flex items-center gap-1">
                                <Mail size={14} />
                                {member.email}
                              </span>
                            </td>
                            <td className={tableCellClass}>
                              <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold capitalize text-sky-700">
                                {accessLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <IconButton onClick={() => openEditMember(member)} title="Edit member">
                                  <Pencil size={15} />
                                </IconButton>
                                <IconButton onClick={() => removeMember(member)} title="Remove member" tone="danger">
                                  <Trash2 size={15} />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionShell>
          );
        })}
      </div>

      {unassignedMembers.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,_rgba(255,251,235,1)_0%,_rgba(255,247,237,1)_100%)] shadow-sm">
          <div className="border-b border-amber-200 bg-amber-100/70 px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-900">
              <AlertTriangle size={18} />
              Without a Team Role
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              These members are not admins and currently do not have a company role assigned.
            </p>
          </div>
          <div className="p-5">
            <div className="overflow-x-auto rounded-xl border border-amber-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-100/70 text-amber-900">
                  <tr>
                    <th className={tableHeaderCellClass}>Name</th>
                    <th className={tableHeaderCellClass}>Email</th>
                    <th className={tableHeaderCellClass}>System Role</th>
                    <th className={`${tableHeaderCellClass} w-28 text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 bg-white">
                  {unassignedMembers.map((member) => (
                    <tr key={member.id} className="transition-colors hover:bg-amber-50/70">
                      <td className="px-4 py-3">
                        <MemberIdentity name={member.fullName} subtitle="No company role assigned" tone="amber" />
                      </td>
                      <td className={tableCellClass}>
                        <span className="inline-flex items-center gap-1">
                          <Mail size={14} />
                          {member.email}
                        </span>
                      </td>
                      <td className={`${tableCellClass} capitalize`}>{member.systemRole}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton onClick={() => openEditMember(member)} title="Edit member">
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton onClick={() => removeMember(member)} title="Remove member" tone="danger">
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {roleModal && (
        <ModalShell
          title={roleModal === 'create' ? 'Create Role' : 'Edit Role'}
          subtitle="Role definitions help organize team members and permissions."
          onClose={() => setRoleModal(null)}
        >
          <form id="role-form" onSubmit={submitRole} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Role Name</label>
              <input
                value={roleForm.name}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Description</label>
              <textarea
                rows={3}
                value={roleForm.description}
                onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                className={`${inputClass} resize-y`}
                placeholder="Optional: what does this group handle?"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Save Role
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {memberModal && (
        <ModalShell
          title="Add Team Member"
          subtitle="New members sign in using email and passcode."
          onClose={() => setMemberModal(false)}
        >
          <form id="member-form" onSubmit={submitMember} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Full Name</label>
              <input
                value={memberForm.fullName}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email (Login)</label>
              <input
                type="email"
                value={memberForm.email}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, email: event.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Passcode (Login)</label>
              <input
                type="password"
                autoComplete="new-password"
                value={memberForm.passcode}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, passcode: event.target.value }))}
                className={inputClass}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
              <p className="mt-1 text-xs text-slate-500">
                This is the password they will use on the sign-in page.
              </p>
            </div>
            <div className="hidden">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Role</label>
              <select
                value={memberForm.companyRoleId}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, companyRoleId: event.target.value }))}
                className={inputClass}
                required
              >
                {rolesOrdered.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Add Member
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {editMember && (
        <ModalShell
          title="Edit Member"
          subtitle={editMember.fullName}
          onClose={() => setEditMember(null)}
        >
          <form id="edit-member-form" onSubmit={submitEditMember} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Team Role</label>
              <select
                value={editForm.companyRoleId}
                onChange={(event) => setEditForm((prev) => ({ ...prev, companyRoleId: event.target.value }))}
                className={inputClass}
                required
              >
                {rolesOrdered.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};

export default Teams;
