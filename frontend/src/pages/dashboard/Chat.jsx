import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowUpRight,
  ImagePlus,
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getTickets,
  getMessagesByTicket,
  getMyTickets,
  sendMessage,
  uploadChatImage,
  updateTicket,
} from '../../services/api';
import teamService from '../../services/teamService';
import { createAgentSocket } from '../../services/socketClient';
import { useAuth } from '../../hooks/useAuth';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  assigned: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  escalated: 'bg-rose-100 text-rose-700',
};

const formatLabel = (value = '') => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getInitials = (value = '') =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'TM';

const panelClass =
  'relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.52)] ring-1 ring-white/70 backdrop-blur';

const inputClass =
  'flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/80 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400';

const mdComponents = {
  h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-slate-900">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-slate-900">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-xs font-semibold text-slate-800">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 text-sm">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt}
      className="mt-2 max-w-full rounded-xl border border-slate-200 shadow-sm"
    />
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900/95 p-3 text-xs text-slate-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-2 py-1 text-left font-semibold text-slate-600">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 px-2 py-1 text-slate-700">{children}</td>
  ),
};

const Chat = () => {
  const { role, user } = useAuth();
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  const currentUserId = Number(user?.id);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messagesByTicket, setMessagesByTicket] = useState({});
  const [conversationSearch, setConversationSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false);
  const [assigningMemberId, setAssigningMemberId] = useState(null);
  const bottomRef = useRef(null);
  const uploadInputRef = useRef(null);
  const socketRef = useRef(null);
  const activeIdRef = useRef(activeId);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => (conversation._id || conversation.id) === activeId),
    [activeId, conversations]
  );
  const activeMessages = messagesByTicket[activeId] || [];
  const activeStatus = String(activeConversation?.status || '').trim().toLowerCase();
  const activeAssignedTo =
    typeof activeConversation?.assignedTo === 'number' ? activeConversation.assignedTo : null;
  const isAssignedToAnotherAgent =
    activeAssignedTo != null && Number.isFinite(currentUserId) && activeAssignedTo !== currentUserId;
  const isLockedConversation = activeStatus === 'resolved' || isAssignedToAnotherAgent;
  const assignedAgentName =
    activeAssignedTo != null
      ? teamMembers.find((member) => Number(member.id) === Number(activeAssignedTo))?.fullName || null
      : null;

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const conversationId = String(conversation._id || conversation.id || '');
      const lastMessage = (messagesByTicket[conversationId] || []).at(-1);
      return (
        (conversation.message || '').toLowerCase().includes(query)
        || (conversation.customerName || '').toLowerCase().includes(query)
        || String(conversation.ticketCode || conversationId).toLowerCase().includes(query)
        || (lastMessage?.text || '').toLowerCase().includes(query)
      );
    });
  }, [conversations, messagesByTicket, conversationSearch]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const result = isAdmin ? await getTickets() : await getMyTickets();
        const list = Array.isArray(result) ? result : [];
        setConversations(list);
        setActiveId((previousActiveId) => {
          if (
            previousActiveId
            && list.some((conversation) => (conversation._id || conversation.id) === previousActiveId)
          ) {
            return previousActiveId;
          }
          return list[0]?._id || list[0]?.id || '';
        });
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load Closira conversations.');
      } finally {
        setIsLoadingConversations(false);
      }
    };

    loadConversations();
  }, [isAdmin]);

  useEffect(() => {
    activeIdRef.current = activeId;
  });

  useEffect(() => {
    const socket = createAgentSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setIsSocketConnected(true);
      const currentActiveId = activeIdRef.current;
      if (currentActiveId) {
        socket.emit('agent:join_ticket', { ticketId: currentActiveId });
      }
    };
    const onDisconnect = () => setIsSocketConnected(false);
    const onSocketError = (payload) => {
      const message = payload?.message || 'Real-time Closira chat connection error.';
      toast.error(message);
    };
    const onIncomingMessage = (message) => {
      const ticketId = String(message?.ticketId || '');
      if (!ticketId || !message?._id) return;

      setMessagesByTicket((previous) => {
        const current = previous[ticketId] || [];
        if (current.some((entry) => entry._id === message._id)) {
          return previous;
        }
        return {
          ...previous,
          [ticketId]: [...current, message],
        };
      });
    };
    const onHandoff = () => {
      if (isAdmin) {
        void (async () => {
          try {
            const refreshed = await getTickets();
            setConversations(Array.isArray(refreshed) ? refreshed : []);
          } catch {
            // handled by user action refresh later
          }
        })();
      }
    };
    const onTicketStatus = (payload) => {
      const ticketId = String(payload?.ticketId || '');
      if (!ticketId) return;
      const nextStatus = String(payload?.status || '').trim().toLowerCase();
      const assignedTo = payload?.assignedTo ?? null;
      setConversations((previous) =>
        previous.map((conversation) => {
          const conversationId = String(conversation._id || conversation.id || '');
          if (conversationId !== ticketId) return conversation;
          return {
            ...conversation,
            status: nextStatus || conversation.status,
            assignedTo:
              typeof assignedTo === 'number'
                ? assignedTo
                : assignedTo === null
                  ? null
                  : conversation.assignedTo ?? null,
          };
        }),
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onSocketError);
    socket.on('chat:error', onSocketError);
    socket.on('chat:message', onIncomingMessage);
    socket.on('chat:handoff_requested', onHandoff);
    socket.on('chat:ticket_status', onTicketStatus);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onSocketError);
      socket.off('chat:error', onSocketError);
      socket.off('chat:message', onIncomingMessage);
      socket.off('chat:handoff_requested', onHandoff);
      socket.off('chat:ticket_status', onTicketStatus);
      socket.close();
      socketRef.current = null;
    };
  }, [isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isLockedConversation]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });

  const handleImageUpload = async (file) => {
    if (!file || !activeId || !activeConversation) return;
    try {
      setIsUploading(true);
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadChatImage({
        fileName: file.name,
        dataUrl,
      });
      if (!result?.url) {
        throw new Error('Upload succeeded but no URL was returned.');
      }
      const markdown = `![Uploaded image](${result.url})`;
      const socket = socketRef.current;
      if (socket && isSocketConnected) {
        socket.emit('agent:send_message', {
          ticketId: activeId,
          text: markdown,
        });
      } else {
        const created = await sendMessage({
          ticketId: activeId,
          text: markdown,
          sender: 'agent',
        });
        const fallback = {
          _id: created?._id || `${Date.now()}`,
          ticketId: activeId,
          text: markdown,
          sender: 'agent',
          createdAt: new Date().toISOString(),
        };
        setMessagesByTicket((previous) => ({
          ...previous,
          [activeId]: [...(previous[activeId] || []), fallback],
        }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const loadMessages = async () => {
      if (!activeId) return;

      try {
        setIsLoadingMessages(true);
        const result = await getMessagesByTicket(activeId);
        const list = Array.isArray(result) ? result : [];
        setMessagesByTicket((previous) => ({ ...previous, [activeId]: list }));
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load messages.');
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeId) return;

    socket.emit('agent:join_ticket', { ticketId: activeId });
    return () => {
      socket.emit('agent:leave_ticket', { ticketId: activeId });
    };
  }, [activeId]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!activeConversation || !activeId || !draft.trim() || isSending || isLockedConversation) {
      return;
    }

    const text = draft.trim();
    setIsSending(true);

    try {
      const socket = socketRef.current;
      if (socket && isSocketConnected) {
        socket.emit('agent:send_message', {
          ticketId: activeId,
          text,
        });
      } else {
        const created = await sendMessage({
          ticketId: activeId,
          text,
          sender: 'agent',
        });

        const fallback = {
          _id: `${Date.now()}`,
          ticketId: activeId,
          text,
          sender: 'agent',
          createdAt: new Date().toISOString(),
        };

        setMessagesByTicket((previous) => ({
          ...previous,
          [activeId]: [...(previous[activeId] || []), created || fallback],
        }));
      }
      setDraft('');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (nextStatus) => {
    if (!activeConversation || !activeId) return;

    try {
      const updated = await updateTicket(activeId, { status: nextStatus });
      setConversations((previous) =>
        previous.map((conversation) =>
          (conversation._id || conversation.id) === activeId
            ? { ...conversation, status: updated?.status || nextStatus }
            : conversation
        )
      );
      toast.success(
        nextStatus === 'resolved' ? 'Conversation marked as resolved.' : 'Conversation escalated.'
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update ticket status.');
    }
  };

  const openEscalationModal = async () => {
    setIsEscalationModalOpen(true);

    if (teamMembers.length > 0 || isLoadingTeamMembers) {
      return;
    }

    try {
      setIsLoadingTeamMembers(true);
      const members = await teamService.listMembers();
      setTeamMembers(Array.isArray(members) ? members : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load team members.');
    } finally {
      setIsLoadingTeamMembers(false);
    }
  };

  const assignConversationToMember = async (member) => {
    if (!activeId || !member?.id || assigningMemberId) return;

    try {
      setAssigningMemberId(member.id);
      const updated = await updateTicket(activeId, {
        status: 'escalated',
        assignedTo: member.id,
      });

      setConversations((previous) =>
        previous.map((conversation) =>
          (conversation._id || conversation.id) === activeId
            ? {
                ...conversation,
                status: updated?.status || 'escalated',
                assignedTo:
                  typeof updated?.assignedTo === 'number' ? updated.assignedTo : Number(member.id),
              }
            : conversation
        )
      );

      toast.success(`Conversation assigned to ${member.fullName || 'team member'}.`);
      setIsEscalationModalOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to assign ticket.');
    } finally {
      setAssigningMemberId(null);
    }
  };

  return (
    <div className="rounded-[32px] bg-[linear-gradient(145deg,rgba(186,230,253,0.62),rgba(191,219,254,0.38),rgba(226,232,240,0.72))] p-[1px] lg:h-[calc(100dvh-8rem)]">
      <div className="grid grid-cols-1 gap-5 rounded-[31px] bg-slate-50/85 p-3 sm:p-4 lg:h-full lg:min-h-0 lg:grid-cols-10 lg:p-5">
        <aside className={`${panelClass} flex min-h-0 flex-col lg:col-span-3`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 top-24 h-40 w-40 rounded-full bg-sky-200/45 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
          />
          <div className="relative border-b border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-800 to-blue-900 p-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold">Closira Conversation Desk</h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                  isSocketConnected
                    ? 'border-emerald-300 bg-emerald-200 text-emerald-800'
                    : 'border-amber-300 bg-amber-200 text-amber-800'
                }`}
              >
                {isSocketConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-200">
              {isAdmin ? 'Company-wide customer conversations' : 'Assigned customer conversations'}
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-white/40 focus:bg-white/15"
              />
            </div>
          </div>

          <div className="relative flex-1 min-h-0 space-y-2.5 overflow-y-auto bg-slate-50/65 p-3">
            {filteredConversations.map((conversation) => {
              const conversationId = conversation._id || conversation.id;
              const conversationStatus = String(conversation.status || '').trim().toLowerCase();
              const isLocked =
                conversationStatus === 'resolved'
                || (
                  typeof conversation.assignedTo === 'number'
                  && Number.isFinite(currentUserId)
                  && conversation.assignedTo !== currentUserId
                );

              return (
                <button
                  key={conversationId}
                  type="button"
                  onClick={() => setActiveId(conversationId)}
                  className={`w-full rounded-2xl border p-3 text-left transition duration-200 ${
                    conversationId === activeId
                      ? 'border-blue-300 bg-blue-50/90 shadow-[0_16px_28px_-20px_rgba(37,99,235,0.82)] ring-2 ring-blue-100'
                      : 'border-slate-200/90 bg-white/95 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {conversation.message || 'No description'}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        statusStyles[conversation.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formatLabel(conversation.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-slate-400">
                      {conversation.customerName || conversation.ticketCode || conversationId}
                    </p>
                    {isLocked && (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Closed
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {!isLoadingConversations && filteredConversations.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-3 text-xs text-slate-500">
                No assigned conversations.
              </p>
            )}
          </div>
        </aside>

        <section className={`${panelClass} flex min-h-0 flex-col p-4 sm:p-5 lg:col-span-7`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-indigo-100/45 blur-3xl"
          />
          {activeConversation ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{activeConversation.message}</h2>
                  <p className="text-sm text-slate-500">
                    {activeConversation.customerName || activeConversation.ticketCode || activeId}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isLockedConversation && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      <ShieldAlert size={12} />
                      {isAssignedToAnotherAgent ? 'Assigned Away' : 'Chat Closed'}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyles[activeConversation.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {formatLabel(activeConversation.status)}
                  </span>
                </div>
              </div>

              <div className="relative mb-4 flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.14),transparent_55%)]"
                />
                {isLockedConversation && (
                  <div className="relative flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-900 px-4 py-3 text-sm text-white shadow-[0_16px_30px_-22px_rgba(15,23,42,0.9)]">
                    <div className="mt-0.5 rounded-full bg-white/10 p-1.5">
                      <AlertCircle size={16} />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {isAssignedToAnotherAgent ? 'This ticket has been handed off.' : 'This chat has been closed.'}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {isAssignedToAnotherAgent
                          ? `This ticket is assigned to ${assignedAgentName || 'another team member'}, so only that teammate can continue the live chat.`
                          : 'This ticket is resolved, so messaging and status changes are disabled for this conversation.'}
                      </p>
                    </div>
                  </div>
                )}
                {activeMessages.map((entry, index) => (
                  <div
                    key={`${activeId}-${entry._id || index}`}
                    className={`relative w-fit max-w-[86%] break-words whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-[0_12px_22px_-16px_rgba(15,23,42,0.55)] ${
                      entry.sender === 'agent'
                        ? 'ml-auto border border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        : entry.sender === 'system'
                          ? 'mx-auto border border-slate-200 bg-slate-100 text-center text-slate-600'
                          : 'mr-auto border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {entry.text || ''}
                    </ReactMarkdown>
                  </div>
                ))}
                {isLoadingMessages && (
                  <div className="relative mr-auto w-fit max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                    Loading messages...
                  </div>
                )}
                {isSending && (
                  <div className="relative mr-auto w-fit max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                    Sending...
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className={`mb-3 flex gap-2 rounded-2xl border p-2 ${
                  isLockedConversation
                    ? 'border-slate-200 bg-slate-100/90'
                    : 'border-slate-200/80 bg-white/90'
                }`}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={isLockedConversation ? 'This chat is closed.' : 'Type your reply...'}
                  disabled={isLockedConversation}
                  className={inputClass}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={!activeConversation || isUploading || isLockedConversation}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus size={18} />
                </button>
                <button
                  type="submit"
                  disabled={!draft.trim() || isSending || isLockedConversation}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(37,99,235,0.85)] transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400"
                >
                  Send
                </button>
              </form>

              {!isLockedConversation && (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2.5">
                  <button
                    type="button"
                    onClick={() => updateStatus('pending')}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Mark Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus('resolved')}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Mark as Resolved
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={openEscalationModal}
                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                    >
                      Escalate
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Select a conversation to start chatting.
            </div>
          )}
        </section>
      </div>

      {isEscalationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_90px_-34px_rgba(15,23,42,0.7)]">
            <div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,0.96),rgba(30,64,175,0.9))] px-6 py-5 text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl"
              />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">
                    Escalation Desk
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Company team members</h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-200">
                    Choose a teammate to assign this ticket. The selected member will see it in
                    their chat list and can continue the conversation in real time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEscalationModalOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close escalation modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[70dvh] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-6">
              <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                    <UsersRound size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Available team members</p>
                    <p className="text-xs text-slate-500">
                      {isLoadingTeamMembers
                        ? 'Loading members from backend...'
                        : `${teamMembers.length} member${teamMembers.length === 1 ? '' : 's'} found`}
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingTeamMembers ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-slate-100"
                    />
                  ))}
                </div>
              ) : teamMembers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {teamMembers.map((member) => {
                    const isAssigning = assigningMemberId === member.id;
                    return (
                    <div
                      key={member.id}
                      className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_20px_30px_-24px_rgba(37,99,235,0.75)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100 text-sm font-bold text-blue-700">
                          {getInitials(member.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {member.fullName || 'Unnamed member'}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">{member.email}</p>
                            </div>
                            <ArrowUpRight
                              size={16}
                              className="shrink-0 text-slate-300 transition group-hover:text-blue-500"
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              <UserRound size={12} />
                              {formatLabel(member.systemRole || 'member')}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                              {member.companyRole?.name || 'No company role'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => assignConversationToMember(member)}
                            disabled={!!assigningMemberId}
                            className="mt-4 inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
                          >
                            {isAssigning ? 'Assigning...' : 'Assign Conversation'}
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <AlertCircle size={18} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">No team members found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    The backend returned an empty company member list for this account.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsEscalationModalOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <X size={14} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
