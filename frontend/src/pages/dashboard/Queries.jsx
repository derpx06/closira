import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  FilterX,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { acceptTicket, getTickets, searchTickets, updateTicket } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const priorityWeight = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const priorityStyles = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-orange-100 text-orange-700',
  low: 'bg-emerald-100 text-emerald-700',
  critical: 'bg-red-200 text-red-800',
};

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  escalated: 'bg-rose-100 text-rose-700',
};

const categoryStyles = {
  billing: 'bg-indigo-100 text-indigo-700',
  technical: 'bg-cyan-100 text-cyan-700',
  login: 'bg-violet-100 text-violet-700',
};

const formatLabel = (value = '') => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const filterControlClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const Queries = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRoleId = user?.companyRole?.id ?? null;
  const [tickets, setTickets] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [selectedId, setSelectedId] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [teamView, setTeamView] = useState('my-team');
  const [smartSearch, setSmartSearch] = useState(false);
  const [smartResults, setSmartResults] = useState(null);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAcceptId, setPendingAcceptId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        const result = await getTickets();
        setTickets(Array.isArray(result) ? result : []);
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load tickets.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  useEffect(() => {
    if (!smartSearch || !searchText.trim()) {
      setSmartResults(null);
      return;
    }

    let cancelled = false;
    setIsSmartSearching(true);
    searchTickets(searchText.trim(), 35)
      .then((results) => {
        if (!cancelled) {
          setSmartResults(Array.isArray(results) ? results : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error?.response?.data?.message || 'Smart search failed.');
          setSmartResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSmartSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [smartSearch, searchText]);

  const filteredTickets = useMemo(() => {
    const baseTickets = smartSearch && smartResults ? smartResults : tickets;
    const filtered = baseTickets.filter((ticket) => {
      if (user?.role !== 'admin' && teamView === 'my-team') {
        if (!userRoleId) return false;
        return Number(ticket.assignedRoleId) === Number(userRoleId);
      }

      const matchesSearch =
        (ticket.ticketCode || ticket._id || ticket.id || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (ticket.message || '').toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus =
        statusFilter === 'All' || (ticket.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesPriority =
        priorityFilter === 'All' ||
        (ticket.priority || '').toLowerCase() === priorityFilter.toLowerCase();
      const matchesCategory =
        categoryFilter === 'All' ||
        (ticket.category || '').toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'Similarity') {
        return Number(b.similarity ?? 0) - Number(a.similarity ?? 0);
      }
      if (sortBy === 'Priority') {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [
    tickets,
    searchText,
    statusFilter,
    priorityFilter,
    categoryFilter,
    sortBy,
    teamView,
    userRoleId,
    user?.role,
    smartSearch,
    smartResults,
  ]);

  const selectedTicket =
    tickets.find((ticket) => (ticket._id || ticket.id) === selectedId) || null;

  const dashboardStats = useMemo(() => {
    const counts = filteredTickets.reduce(
      (acc, ticket) => {
        const status = String(ticket.status || '').toLowerCase();
        if (status) {
          acc[status] = (acc[status] || 0) + 1;
        }
        return acc;
      },
      { pending: 0, assigned: 0, resolved: 0, escalated: 0 }
    );

    const open = counts.pending + counts.assigned + counts.escalated;

    return {
      total: filteredTickets.length,
      open,
      pending: counts.pending,
      resolved: counts.resolved,
      escalated: counts.escalated,
    };
  }, [filteredTickets]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchText.trim()) count += 1;
    if (statusFilter !== 'All') count += 1;
    if (priorityFilter !== 'All') count += 1;
    if (categoryFilter !== 'All') count += 1;
    if (sortBy !== 'Newest') count += 1;
    if (smartSearch) count += 1;
    if (user?.role !== 'admin' && teamView !== 'my-team') count += 1;
    return count;
  }, [searchText, statusFilter, priorityFilter, categoryFilter, sortBy, smartSearch, user?.role, teamView]);

  useEffect(() => {
    if (selectedId && !selectedTicket) {
      setIsDetailsOpen(false);
      setSelectedId('');
    }
  }, [selectedId, selectedTicket]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDetailsOpen(false);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    const ticketIdFromUrl = searchParams.get('ticketId');
    if (!ticketIdFromUrl || isLoading) return;

    const matchedTicket = tickets.find(
      (ticket) => String(ticket._id || ticket.id || '') === String(ticketIdFromUrl)
    );

    if (matchedTicket) {
      const resolvedId = matchedTicket._id || matchedTicket.id;
      setSelectedId(resolvedId);
      setIsDetailsOpen(true);
    }

    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      nextParams.delete('ticketId');
      return nextParams;
    }, { replace: true });
  }, [searchParams, setSearchParams, tickets, isLoading]);

  const updateTicketState = (ticketId, updates) => {
    setTickets((previous) =>
      previous.map((ticket) =>
        (ticket._id || ticket.id) === ticketId ? { ...ticket, ...updates } : ticket
      )
    );
  };

  const openTicketDetails = (ticketId) => {
    setSelectedId(ticketId);
    setIsDetailsOpen(true);
  };

  const clearFilters = () => {
    setSearchText('');
    setStatusFilter('All');
    setPriorityFilter('All');
    setCategoryFilter('All');
    setSortBy('Newest');
    setSmartSearch(false);
    setSmartResults(null);
    if (user?.role !== 'admin') {
      setTeamView('my-team');
    }
  };

  const isActionBlocked = (ticket) => {
    const status = String(ticket?.status || '').toLowerCase();
    const isLockedStatus = ['assigned', 'resolved'].includes(status);
    if (isLockedStatus) return true;
    if (user?.role === 'admin') return false;
    if (!userRoleId || !ticket?.assignedRoleId) return true;
    return Number(ticket.assignedRoleId) !== Number(userRoleId);
  };

  const handleAccept = async (ticketId) => {
    if (user?.role !== 'admin') {
      const ticket = tickets.find((item) => (item._id || item.id) === ticketId);
      const status = String(ticket?.status || '').toLowerCase();
      if (status === 'assigned' || status === 'resolved') {
        toast.error('This ticket cannot be accepted.');
        return;
      }
      const assignedRoleId = ticket?.assignedRoleId;
      if (!userRoleId || !assignedRoleId || Number(assignedRoleId) !== Number(userRoleId)) {
        toast.error('You can only accept tickets assigned to your team.');
        return;
      }
    }

    try {
      setPendingAcceptId(ticketId);
      const accepted = await acceptTicket(ticketId);
      updateTicketState(ticketId, accepted || { status: 'assigned' });
      toast.success('Conversation accepted and moved to My Chats.');
      const nextId = accepted?._id || accepted?.id || ticketId;
      navigate(`/chat?ticketId=${nextId}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to accept ticket.');
    } finally {
      setPendingAcceptId('');
    }
  };

  const handleReject = async (ticketId) => {
    if (user?.role !== 'admin') {
      const ticket = tickets.find((item) => (item._id || item.id) === ticketId);
      const status = String(ticket?.status || '').toLowerCase();
      if (status === 'assigned' || status === 'resolved') {
        toast.error('This ticket cannot be rejected.');
        return;
      }
      const assignedRoleId = ticket?.assignedRoleId;
      if (!userRoleId || !assignedRoleId || Number(assignedRoleId) !== Number(userRoleId)) {
        toast.error('You can only reject tickets assigned to your team.');
        return;
      }
    }

    try {
      const updated = await updateTicket(ticketId, { status: 'escalated' });
      updateTicketState(ticketId, updated || { status: 'escalated' });
      toast.success('Conversation escalated.');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to reject ticket.');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role !== 'admin' && (
        <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_100%)] p-2 shadow-sm">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <Ticket size={13} />
            View Mode
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTeamView('my-team')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              teamView === 'my-team'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Team
          </button>
          <button
            type="button"
            onClick={() => setTeamView('all')}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              teamView === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Queries
          </button>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,_rgba(15,23,42,1)_0%,_rgba(30,64,175,1)_62%,_rgba(37,99,235,1)_100%)] px-4 py-5 text-white sm:px-5">
          <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-14 left-20 h-36 w-36 rounded-full bg-blue-300/25 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Ticket size={22} />
                Closira Inbox Workspace
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                Review inbound customer enquiries, prioritize urgency, and resolve faster with smart search.
              </p>
            </div>
            <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50">
              {dashboardStats.total} Visible Conversation{dashboardStats.total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4">
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
              <p className="text-blue-100">Open</p>
              <p className="mt-0.5 text-lg text-white">{dashboardStats.open}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
              <p className="text-blue-100">Pending</p>
              <p className="mt-0.5 text-lg text-white">{dashboardStats.pending}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
              <p className="text-blue-100">Resolved</p>
              <p className="mt-0.5 text-lg text-white">{dashboardStats.resolved}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
              <p className="text-blue-100">Escalated</p>
              <p className="mt-0.5 text-lg text-white">{dashboardStats.escalated}</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <SlidersHorizontal size={14} />
                </span>
                Refine Conversations
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  <Clock3 size={12} />
                  {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FilterX size={12} />
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="xl:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Search size={13} />
                    Search
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSmartSearch((prev) => {
                        const next = !prev;
                        if (next) {
                          setSortBy('Similarity');
                        } else if (sortBy === 'Similarity') {
                          setSortBy('Newest');
                        }
                        return next;
                      });
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                      smartSearch
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Sparkles size={12} />
                    Smart search
                  </button>
                </div>
                <div className="group relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-500"
                  />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Conversation ID, customer, message..."
                    className={`${filterControlClass} pl-10`}
                  />
                </div>
                {smartSearch && searchText.trim() && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isSmartSearching ? 'Searching by similarity...' : 'Smart similarity search enabled'}
                  </p>
                )}
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className={filterControlClass}
                >
                  <option>All</option>
                  <option>Pending</option>
                  <option>Assigned</option>
                  <option>Escalated</option>
                  <option>Resolved</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Priority
                </span>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className={filterControlClass}
                >
                  <option>All</option>
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className={filterControlClass}
                >
                  <option>All</option>
                  <option>Billing</option>
                  <option>Technical</option>
                  <option>Login</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{filteredTickets.length}</span>{' '}
                result{filteredTickets.length === 1 ? '' : 's'}
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <ArrowUpDown size={13} />
                Sort
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
                >
                  <option>Newest</option>
                  <option>Priority</option>
                  {smartSearch && <option>Similarity</option>}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {filteredTickets.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredTickets.map((ticket) => {
                const ticketId = ticket._id || ticket.id;
                return (
                  <button
                    key={ticketId}
                    type="button"
                    onClick={() => openTicketDetails(ticketId)}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,_#ffffff_0%,_#f8fafc_100%)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_36px_-24px_rgba(37,99,235,0.75)]"
                  >
                    <span className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-blue-50/80 transition group-hover:bg-blue-100/90" />

                    <div className="relative flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {ticket.ticketCode || ticketId}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {ticket.customerName || '-'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          statusStyles[ticket.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatLabel(ticket.status)}
                      </span>
                    </div>

                    <p className="relative mt-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-700">
                      {ticket.message || 'No description provided.'}
                    </p>

                    <div className="relative mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assigned Role</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        {ticket.assignedRoleId ? `Team #${ticket.assignedRoleId}` : 'Unassigned'}
                      </p>
                    </div>

                    <div className="relative mt-3 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          categoryStyles[ticket.category] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatLabel(ticket.category)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          priorityStyles[ticket.priority] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatLabel(ticket.priority)}
                      </span>
                      {ticket.sentimentEmoji ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                          <span>{ticket.sentimentEmoji}</span>
                          {formatLabel(ticket.sentiment || 'neutral')}
                        </span>
                      ) : null}
                    </div>

                    <div className="relative mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{formatDateTime(ticket.createdAt)}</span>
                      {smartSearch && typeof ticket.similarity === 'number' ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                          Similarity {ticket.similarity.toFixed(3)}
                        </span>
                      ) : (
                        <span className="font-semibold text-blue-600">View details</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div>
                <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  {isLoading ? <Clock3 size={18} /> : <AlertTriangle size={18} />}
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {isLoading ? 'Loading tickets...' : 'No tickets match your filters.'}
                </p>
                {!isLoading && activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    <FilterX size={12} />
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {isDetailsOpen && selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsDetailsOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_rgba(30,58,138,1),_rgba(30,64,175,1),_rgba(37,99,235,1))] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Conversation Details</p>
                  <h2 className="mt-1 break-all text-lg font-semibold">
                    {selectedTicket.ticketCode || selectedTicket._id || selectedTicket.id}
                  </h2>
                  <p className="mt-1 text-sm text-blue-100">{selectedTicket.customerName || '-'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="rounded-lg border border-white/40 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    statusStyles[selectedTicket.status] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {formatLabel(selectedTicket.status)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    categoryStyles[selectedTicket.category] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {formatLabel(selectedTicket.category)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    priorityStyles[selectedTicket.priority] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {formatLabel(selectedTicket.priority)}
                </span>
                {selectedTicket.sentimentEmoji ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    <span>{selectedTicket.sentimentEmoji}</span>
                    {formatLabel(selectedTicket.sentiment || 'neutral')}
                  </span>
                ) : null}
                {smartSearch && typeof selectedTicket.similarity === 'number' ? (
                  <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Similarity {selectedTicket.similarity.toFixed(3)}
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Customer Message</p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {selectedTicket.message || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {formatDateTime(selectedTicket.createdAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Role</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedTicket.assignedRoleId ? `#${selectedTicket.assignedRoleId}` : '-'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      pendingAcceptId === (selectedTicket._id || selectedTicket.id) ||
                      isActionBlocked(selectedTicket)
                    }
                    onClick={() => handleAccept(selectedTicket._id || selectedTicket.id)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 size={15} />
                    {pendingAcceptId === (selectedTicket._id || selectedTicket.id)
                      ? 'Accepting...'
                      : 'Accept Conversation'}
                  </button>
                  <button
                    type="button"
                    disabled={isActionBlocked(selectedTicket)}
                    onClick={() => handleReject(selectedTicket._id || selectedTicket.id)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <AlertTriangle size={15} />
                    Escalate Conversation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queries;
