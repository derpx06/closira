import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getTickets } from '../../services/api';

const formatLabel = (value = '') => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatSlotLabel = (timestamp) =>
  new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatSlotWithDate = (timestamp) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const parseFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getDurationMinutesFromTicket = (ticket) => {
  const createdAtMs = new Date(ticket?.createdAt || '').getTime();
  const updatedAtMs = new Date(ticket?.updatedAt || '').getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(updatedAtMs)) return null;
  if (updatedAtMs < createdAtMs) return null;
  return Number(((updatedAtMs - createdAtMs) / (1000 * 60)).toFixed(1));
};

const getTicketResponseMinutes = (ticket) => {
  const explicit =
    parseFiniteNumber(ticket?.firstResponseMinutes) ??
    parseFiniteNumber(ticket?.firstResponseTimeMinutes) ??
    parseFiniteNumber(ticket?.responseMinutes);

  if (explicit !== null) return explicit;
  return getDurationMinutesFromTicket(ticket);
};

const getTicketResolutionMinutes = (ticket) => {
  const explicitMinutes = parseFiniteNumber(ticket?.resolutionMinutes);
  if (explicitMinutes !== null) return explicitMinutes;

  const explicitHours = parseFiniteNumber(ticket?.resolutionHours);
  if (explicitHours !== null) return Number((explicitHours * 60).toFixed(1));

  const normalizedStatus = String(ticket?.status || '').toLowerCase();
  if (!['resolved', 'escalated'].includes(normalizedStatus)) return null;
  return getDurationMinutesFromTicket(ticket);
};

const RoleBasedDashboard = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
  const isAdmin = normalizedRole === 'admin';

  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const selectedTicket =
    tickets.find((ticket) => (ticket._id || ticket.id) === selectedTicketId) || null;

  const priorityStyles = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-green-100 text-green-700',
    critical: 'bg-red-200 text-red-800',
  };

  const statusStyles = {
    assigned: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    escalated: 'bg-rose-100 text-rose-700',
  };

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        const result = await getTickets();
        const list = Array.isArray(result) ? result : [];
        setTickets(list);
        if (list.length > 0) {
          setSelectedTicketId(list[0]._id || list[0].id || '');
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load dashboard tickets.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, []);

  const statCards = useMemo(() => {
    const assigned = tickets.filter((ticket) => ticket.status === 'assigned').length;
    const pending = tickets.filter((ticket) => ticket.status === 'pending').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved').length;
    const escalated = tickets.filter((ticket) => ticket.status === 'escalated').length;

    return [
      { label: 'Assigned Tickets', value: assigned, subtitle: 'Tickets assigned to you' },
      { label: 'Pending Tickets', value: pending, subtitle: 'Awaiting response' },
      { label: 'Resolved Tickets', value: resolved, subtitle: 'Handled successfully' },
      { label: 'Escalated Tickets', value: escalated, subtitle: 'Forwarded to higher team' },
    ];
  }, [tickets]);

  const assignedCount = statCards[0]?.value ?? 0;
  const pendingCount = statCards[1]?.value ?? 0;
  const resolvedCount = statCards[2]?.value ?? 0;
  const escalatedCount = statCards[3]?.value ?? 0;
  const employeeOpenLoad = assignedCount + pendingCount + escalatedCount;
  const employeeResolvedShare = tickets.length ? Math.round((resolvedCount / tickets.length) * 100) : 0;
  const employeeUrgentTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const priority = typeof ticket.priority === 'string' ? ticket.priority.toLowerCase() : '';
        const status = typeof ticket.status === 'string' ? ticket.status.toLowerCase() : '';
        return (priority === 'high' || priority === 'critical') && status !== 'resolved';
      }),
    [tickets]
  );

  const employeeStatCards = [
    {
      label: 'Assigned',
      value: assignedCount,
      subtitle: 'Actively owned tickets',
      icon: Layers3,
      palette: 'border-blue-200 bg-blue-50/70 text-blue-700',
    },
    {
      label: 'Pending',
      value: pendingCount,
      subtitle: 'Awaiting your action',
      icon: Clock3,
      palette: 'border-amber-200 bg-amber-50/70 text-amber-700',
    },
    {
      label: 'Resolved',
      value: resolvedCount,
      subtitle: 'Completed successfully',
      icon: CheckCircle2,
      palette: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
    },
    {
      label: 'Escalated',
      value: escalatedCount,
      subtitle: 'Forwarded for support',
      icon: CircleAlert,
      palette: 'border-rose-200 bg-rose-50/70 text-rose-700',
    },
  ];

  const recentTickets = useMemo(() => {
    return [...tickets]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [tickets]);

  const openTicketInQueries = (ticketId) => {
    if (!ticketId) return;
    navigate(`/queries?ticketId=${encodeURIComponent(ticketId)}`);
  };

  const adminAnalytics = useMemo(() => {
    const total = tickets.length;
    const statusCount = tickets.reduce(
      (acc, ticket) => {
        const status = typeof ticket.status === 'string' ? ticket.status.toLowerCase() : '';
        if (status) acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { pending: 0, resolved: 0, escalated: 0 }
    );

    const categoryCount = tickets.reduce((acc, ticket) => {
      const category = ticket?.category ? formatLabel(ticket.category) : 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const responseValues = tickets
      .map((ticket) => getTicketResponseMinutes(ticket))
      .filter((value) => Number.isFinite(value));
    const avgFirstResponse = responseValues.length
      ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length)
      : 0;

    const resolutionMinuteValues = tickets
      .map((ticket) => getTicketResolutionMinutes(ticket))
      .filter((value) => Number.isFinite(value));
    const avgResolutionHours = resolutionMinuteValues.length
      ? (resolutionMinuteValues.reduce((sum, value) => sum + value, 0) / resolutionMinuteValues.length / 60).toFixed(1)
      : '0.0';

    const resolutionRate = total ? Math.round((statusCount.resolved / total) * 100) : 0;
    const escalationRate = total ? Math.round((statusCount.escalated / total) * 100) : 0;
    const slaMeasuredCount = responseValues.length;
    const slaBreached = responseValues.filter((value) => value > 10).length;
    const slaCompliance = slaMeasuredCount
      ? Math.round(((slaMeasuredCount - slaBreached) / slaMeasuredCount) * 100)
      : 0;

    const timelineTickets = tickets
      .map((ticket) => {
        const createdAt = new Date(ticket.createdAt);
        if (Number.isNaN(createdAt.getTime())) return null;
        return { ...ticket, createdAtMs: createdAt.getTime() };
      })
      .filter(Boolean);

    const intervalMs = 3 * 60 * 60 * 1000;
    const slotCount = 8;
    const latestTimestamp = timelineTickets.length
      ? Math.max(...timelineTickets.map((ticket) => ticket.createdAtMs))
      : Date.now();
    const alignedEnd = Math.ceil(latestTimestamp / intervalMs) * intervalMs;

    const threeHourTrend = Array.from({ length: slotCount }, (_, index) => {
      const slotStart = alignedEnd - (slotCount - index) * intervalMs;
      const slotEnd = slotStart + intervalMs;
      const slotTickets = timelineTickets.filter(
        (ticket) => ticket.createdAtMs >= slotStart && ticket.createdAtMs < slotEnd
      );

      const slotResponseMinutes = slotTickets
        .map((ticket) => getTicketResponseMinutes(ticket))
        .filter((value) => Number.isFinite(value));
      const slotResolutionMinutes = slotTickets
        .map((ticket) => getTicketResolutionMinutes(ticket))
        .filter((value) => Number.isFinite(value));

      return {
        key: String(slotStart),
        label: formatSlotLabel(slotStart),
        slotStart,
        count: slotTickets.length,
        avgResponseMinutes: slotResponseMinutes.length
          ? Number(
            (
              slotResponseMinutes.reduce((sum, value) => sum + value, 0) /
              slotResponseMinutes.length
            ).toFixed(1)
          )
          : null,
        avgResolutionMinutes: slotResolutionMinutes.length
          ? Number(
            (
              slotResolutionMinutes.reduce((sum, value) => sum + value, 0) /
              slotResolutionMinutes.length
            ).toFixed(1)
          )
          : null,
      };
    });

    const peakSlot = threeHourTrend.reduce(
      (best, slot) => (slot.count > best.count ? slot : best),
      threeHourTrend[0] || { count: 0, label: '-', slotStart: Date.now() }
    );

    return {
      total,
      statusCount,
      categoryCount,
      avgFirstResponse,
      avgResolutionHours,
      resolutionRate,
      escalationRate,
      slaCompliance,
      threeHourTrend,
      peakSlot,
    };
  }, [tickets]);

  const employeeLatencySeries = adminAnalytics.threeHourTrend;
  const employeeLatencyChartWidth = 720;
  const employeeLatencyChartHeight = 300;
  const employeeLatencyChartPadding = { top: 22, right: 24, bottom: 44, left: 48 };
  const employeeLatencyPlotWidth =
    employeeLatencyChartWidth - employeeLatencyChartPadding.left - employeeLatencyChartPadding.right;
  const employeeLatencyPlotHeight =
    employeeLatencyChartHeight - employeeLatencyChartPadding.top - employeeLatencyChartPadding.bottom;
  const employeeLatencyMaxMetric = Math.max(
    ...employeeLatencySeries.flatMap((point) => [
      point.avgResponseMinutes ?? 0,
      point.avgResolutionMinutes ?? 0,
    ]),
    1
  );
  const employeeLatencyHasData = employeeLatencySeries.some(
    (point) => typeof point.avgResponseMinutes === 'number' || typeof point.avgResolutionMinutes === 'number'
  );
  const employeeLatencyXStep =
    employeeLatencySeries.length > 1 ? employeeLatencyPlotWidth / (employeeLatencySeries.length - 1) : 0;
  const toEmployeeLatencyX = (index) => employeeLatencyChartPadding.left + index * employeeLatencyXStep;
  const toEmployeeLatencyY = (value) =>
    employeeLatencyChartPadding.top + (1 - value / employeeLatencyMaxMetric) * employeeLatencyPlotHeight;
  const buildEmployeeLatencyPath = (key) => {
    let path = '';
    let isSegmentOpen = false;

    employeeLatencySeries.forEach((point, index) => {
      const value = point[key];
      if (typeof value !== 'number') {
        isSegmentOpen = false;
        return;
      }

      path += `${isSegmentOpen ? ' L ' : ' M '}${toEmployeeLatencyX(index)} ${toEmployeeLatencyY(value)}`;
      isSegmentOpen = true;
    });

    return path.trim();
  };
  const employeeResponsePath = buildEmployeeLatencyPath('avgResponseMinutes');
  const employeeResolutionPath = buildEmployeeLatencyPath('avgResolutionMinutes');
  const employeeLatencyYAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
    Math.round(employeeLatencyMaxMetric * ratio)
  );

  if (isAdmin) {
    const maxCategoryCount = Math.max(...Object.values(adminAnalytics.categoryCount), 1);
    const categoryRows = Object.entries(adminAnalytics.categoryCount).sort((a, b) => b[1] - a[1]);
    const categoryPalette = ['bg-blue-500', 'bg-cyan-500', 'bg-violet-500', 'bg-indigo-500', 'bg-emerald-500'];
    const urgentTickets = tickets.filter((ticket) => {
      const priority = typeof ticket.priority === 'string' ? ticket.priority.toLowerCase() : '';
      const isUrgent = priority === 'high' || priority === 'critical';
      return isUrgent && ticket.status?.toLowerCase() !== 'resolved';
    });

    const latencyChartWidth = 720;
    const latencyChartHeight = 300;
    const latencyChartPadding = { top: 22, right: 24, bottom: 44, left: 48 };
    const latencyPlotWidth = latencyChartWidth - latencyChartPadding.left - latencyChartPadding.right;
    const latencyPlotHeight = latencyChartHeight - latencyChartPadding.top - latencyChartPadding.bottom;
    const intervalSeries = adminAnalytics.threeHourTrend;
    const weeklyMaxMetric = Math.max(
      ...intervalSeries.flatMap((point) => [
        point.avgResponseMinutes ?? 0,
        point.avgResolutionMinutes ?? 0,
      ]),
      1
    );
    const latencyXStep = intervalSeries.length > 1 ? latencyPlotWidth / (intervalSeries.length - 1) : 0;
    const toLatencyX = (index) => latencyChartPadding.left + index * latencyXStep;
    const toLatencyY = (value) =>
      latencyChartPadding.top + (1 - value / weeklyMaxMetric) * latencyPlotHeight;

    const buildLinePath = (key) => {
      let path = '';
      let isSegmentOpen = false;

      intervalSeries.forEach((point, index) => {
        const value = point[key];
        if (typeof value !== 'number') {
          isSegmentOpen = false;
          return;
        }

        path += `${isSegmentOpen ? ' L ' : ' M '}${toLatencyX(index)} ${toLatencyY(value)}`;
        isSegmentOpen = true;
      });

      return path.trim();
    };

    const responsePath = buildLinePath('avgResponseMinutes');
    const resolutionPath = buildLinePath('avgResolutionMinutes');
    const latencyYAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
      Math.round(weeklyMaxMetric * ratio)
    );

    const volumeSeries = adminAnalytics.threeHourTrend;
    const volumeChartWidth = 760;
    const volumeChartHeight = 300;
    const volumeChartPadding = { top: 16, right: 20, bottom: 48, left: 44 };
    const volumePlotWidth = volumeChartWidth - volumeChartPadding.left - volumeChartPadding.right;
    const volumePlotHeight = volumeChartHeight - volumeChartPadding.top - volumeChartPadding.bottom;
    const volumeMax = Math.max(...volumeSeries.map((item) => item.count), 1);
    const volumeStep = volumeSeries.length > 1 ? volumePlotWidth / (volumeSeries.length - 1) : 0;
    const toVolumeX = (index) => volumeChartPadding.left + index * volumeStep;
    const toVolumeY = (value) => volumeChartPadding.top + (1 - value / volumeMax) * volumePlotHeight;

    const volumeLinePath = volumeSeries
      .map((item, index) => `${index === 0 ? 'M' : 'L'} ${toVolumeX(index)} ${toVolumeY(item.count)}`)
      .join(' ');
    const volumeAreaPath = volumeSeries.length
      ? `${volumeLinePath} L ${toVolumeX(volumeSeries.length - 1)} ${volumeChartHeight - volumeChartPadding.bottom
      } L ${toVolumeX(0)} ${volumeChartHeight - volumeChartPadding.bottom} Z`
      : '';
    const volumeYAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(volumeMax * ratio));
    const labelStep = 1;

    return (
      <div className="space-y-6 font-sans">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,1)_0%,_rgba(15,23,42,1)_52%,_rgba(2,6,23,1)_100%)] p-6 text-white md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200">Administrator</p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Closira Analytics Dashboard</h1>
                <p className="mt-1 max-w-xl text-sm text-slate-200">
                  Live conversation intelligence for SOP coverage, escalation health, and team workload risk.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-200">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  Last peak: {formatSlotWithDate(adminAnalytics.peakSlot.slotStart)}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                  Peak volume: {adminAnalytics.peakSlot.count}
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Tickets</p>
              <span className="inline-flex rounded-lg bg-slate-100 p-2 text-slate-600">
                <Layers3 size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{adminAnalytics.total}</p>
            <p className="mt-1 text-xs text-slate-500">Complete dataset in current workspace.</p>
          </article>
          <article className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
              <span className="inline-flex rounded-lg bg-amber-100 p-2 text-amber-700">
                <Clock3 size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-amber-700">{adminAnalytics.statusCount.pending}</p>
            <p className="mt-1 text-xs text-amber-700/80">Awaiting first or follow-up action.</p>
          </article>
          <article className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Escalated</p>
              <span className="inline-flex rounded-lg bg-rose-100 p-2 text-rose-700">
                <CircleAlert size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-rose-700">{adminAnalytics.statusCount.escalated}</p>
            <p className="mt-1 text-xs text-rose-700/80">Needs senior-team intervention.</p>
          </article>
          <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resolution Rate</p>
              <span className="inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <CheckCircle2 size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{adminAnalytics.resolutionRate}%</p>
            <p className="mt-1 text-xs text-emerald-700/80">Closed vs total ticket volume.</p>
          </article>
          <article className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">SLA Compliance</p>
              <span className="inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
                <ShieldCheck size={16} />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold text-blue-700">{adminAnalytics.slaCompliance}%</p>
            <p className="mt-1 text-xs text-blue-700/80">Tickets replied under SLA threshold.</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Average Response & Resolution Time</h2>
                  <p className="text-xs text-slate-500">Last 24 hours in 3-hour intervals (minutes)</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    Response
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    Resolution
                  </span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <svg
                  viewBox={`0 0 ${latencyChartWidth} ${latencyChartHeight}`}
                  className="h-64 w-full min-w-[640px]"
                  role="img"
                  aria-label="Average response and resolution time in 3-hour intervals"
                >
                  {latencyYAxisTicks.map((tick, index) => {
                    const y = toLatencyY(tick);
                    return (
                      <g key={`grid-${tick}-${index}`}>
                        <line
                          x1={latencyChartPadding.left}
                          y1={y}
                          x2={latencyChartWidth - latencyChartPadding.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 5"
                        />
                        <text
                          x={latencyChartPadding.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[11px]"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={latencyChartPadding.left}
                    y1={latencyChartPadding.top}
                    x2={latencyChartPadding.left}
                    y2={latencyChartHeight - latencyChartPadding.bottom}
                    stroke="#cbd5e1"
                  />
                  <line
                    x1={latencyChartPadding.left}
                    y1={latencyChartHeight - latencyChartPadding.bottom}
                    x2={latencyChartWidth - latencyChartPadding.right}
                    y2={latencyChartHeight - latencyChartPadding.bottom}
                    stroke="#cbd5e1"
                  />

                  {responsePath && (
                    <path
                      d={responsePath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}
                  {resolutionPath && (
                    <path
                      d={resolutionPath}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}

                  {intervalSeries.map((point, index) =>
                    typeof point.avgResponseMinutes === 'number' ? (
                      <circle
                        key={`response-dot-${point.key}`}
                        cx={toLatencyX(index)}
                        cy={toLatencyY(point.avgResponseMinutes)}
                        r="4"
                        fill="#2563eb"
                      />
                    ) : null
                  )}
                  {intervalSeries.map((point, index) =>
                    typeof point.avgResolutionMinutes === 'number' ? (
                      <circle
                        key={`resolution-dot-${point.key}`}
                        cx={toLatencyX(index)}
                        cy={toLatencyY(point.avgResolutionMinutes)}
                        r="4"
                        fill="#16a34a"
                      />
                    ) : null
                  )}

                  {intervalSeries.map((point, index) => (
                    <text
                      key={`x-label-${point.key}`}
                      x={toLatencyX(index)}
                      y={latencyChartHeight - 16}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px]"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Ticket Volume Trend</h2>
                  <p className="text-xs text-slate-500">Last 24 hours in 3-hour intervals</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <BarChart3 size={14} />
                  Peak {adminAnalytics.peakSlot.count} at {adminAnalytics.peakSlot.label}
                </span>
              </div>

              {volumeSeries.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${volumeChartWidth} ${volumeChartHeight}`}
                    className="h-64 w-full min-w-[680px]"
                    role="img"
                    aria-label="Ticket volume trend chart"
                  >
                    <defs>
                      <linearGradient id="ticketVolumeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {volumeYAxisTicks.map((tick, index) => {
                      const y = toVolumeY(tick);
                      return (
                        <g key={`vol-grid-${index}`}>
                          <line
                            x1={volumeChartPadding.left}
                            y1={y}
                            x2={volumeChartWidth - volumeChartPadding.right}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="3 5"
                          />
                          <text
                            x={volumeChartPadding.left - 8}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-slate-400 text-[11px]"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    <line
                      x1={volumeChartPadding.left}
                      y1={volumeChartPadding.top}
                      x2={volumeChartPadding.left}
                      y2={volumeChartHeight - volumeChartPadding.bottom}
                      stroke="#cbd5e1"
                    />
                    <line
                      x1={volumeChartPadding.left}
                      y1={volumeChartHeight - volumeChartPadding.bottom}
                      x2={volumeChartWidth - volumeChartPadding.right}
                      y2={volumeChartHeight - volumeChartPadding.bottom}
                      stroke="#cbd5e1"
                    />

                    {volumeAreaPath ? <path d={volumeAreaPath} fill="url(#ticketVolumeFill)" /> : null}
                    {volumeLinePath ? (
                      <path
                        d={volumeLinePath}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {volumeSeries.map((item, index) => (
                      <circle
                        key={`volume-dot-${item.key}`}
                        cx={toVolumeX(index)}
                        cy={toVolumeY(item.count)}
                        r="3.8"
                        fill="#2563eb"
                      />
                    ))}

                    {volumeSeries.map((item, index) =>
                      index % labelStep === 0 || index === volumeSeries.length - 1 ? (
                        <text
                          key={`volume-label-${item.key}`}
                          x={toVolumeX(index)}
                          y={volumeChartHeight - 16}
                          textAnchor="middle"
                          className="fill-slate-500 text-[11px]"
                        >
                          {item.label}
                        </text>
                      ) : null
                    )}
                  </svg>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No ticket volume data available yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Category Distribution</h2>
              <div className="mt-4 space-y-3">
                {categoryRows.map(([category, count], index) => (
                  <div key={category} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
                    <p className="text-xs font-medium text-slate-600">{category}</p>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${categoryPalette[index % categoryPalette.length]}`}
                        style={{ width: `${Math.max((count / maxCategoryCount) * 100, 8)}%` }}
                      />
                    </div>
                    <p className="text-right text-xs font-semibold text-slate-700">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5 xl:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Performance Snapshot</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Avg First Response</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {adminAnalytics.avgFirstResponse} mins
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Avg Resolution Time</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {adminAnalytics.avgResolutionHours} hrs
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Escalation Rate</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {adminAnalytics.escalationRate}%
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-700" />
                <h2 className="text-lg font-semibold text-rose-700">Urgent Queue</h2>
              </div>
              <p className="mt-1 text-sm text-rose-700">
                High-priority unresolved tickets: {urgentTickets.length}
              </p>
              <ul className="mt-3 space-y-2">
                {urgentTickets.map((ticket) => (
                  <li
                    key={ticket._id || ticket.id}
                    className={`rounded-md border border-rose-200 bg-white p-2 text-sm ${selectedTicketId === (ticket._id || ticket.id) ? 'ring-2 ring-rose-300' : ''
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(ticket._id || ticket.id)}
                      className="w-full text-left"
                    >
                      <p className="font-semibold text-rose-700">
                        {ticket.ticketCode || ticket._id || ticket.id}
                      </p>
                      <p className="truncate text-xs text-slate-600">{ticket.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Focused Conversation</h2>
              {selectedTicket ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-blue-700">
                    {selectedTicket.ticketCode || selectedTicket._id || selectedTicket.id}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{selectedTicket.message}</p>
                  <p className="mt-2 text-xs text-slate-500">{selectedTicket.customer}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No ticket selected.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-[linear-gradient(120deg,_rgba(15,23,42,1)_0%,_rgba(30,64,175,1)_58%,_rgba(2,132,199,1)_100%)] px-5 py-6 text-white sm:px-6">
          <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-16 left-20 h-40 w-40 rounded-full bg-cyan-300/25 blur-2xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">Employee Console</p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Closira Execution Dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-blue-100">
                Keep conversation flow steady, prioritize urgent customer messages, and close loops with confidence.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs font-medium text-slate-100 sm:grid-cols-2">
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                Live tickets: {tickets.length}
              </span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                Open workload: {employeeOpenLoad}
              </span>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4">
            {employeeStatCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-100">{card.label}</p>
                    <Icon size={14} className="text-blue-100" />
                  </div>
                  <p className="mt-0.5 text-lg text-white">{card.value}</p>
                  <p className="text-[11px] text-blue-100/90">{card.subtitle}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {employeeStatCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={`${card.label}-summary`}
              className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.palette}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide">{card.label}</p>
                <span className="inline-flex rounded-lg bg-white/60 p-2">
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs">{card.subtitle}</p>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Average Response & Resolution Time</h2>
                <p className="text-xs text-slate-500">Last 24 hours in 3-hour intervals (minutes)</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Response
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  Resolution
                </span>
              </div>
            </div>

            {employeeLatencyHasData ? (
              <div className="mt-4 overflow-x-auto">
                <svg
                  viewBox={`0 0 ${employeeLatencyChartWidth} ${employeeLatencyChartHeight}`}
                  className="h-64 w-full min-w-[640px]"
                  role="img"
                  aria-label="Average response and resolution time in 3-hour intervals"
                >
                  {employeeLatencyYAxisTicks.map((tick, index) => {
                    const y = toEmployeeLatencyY(tick);
                    return (
                      <g key={`employee-grid-${tick}-${index}`}>
                        <line
                          x1={employeeLatencyChartPadding.left}
                          y1={y}
                          x2={employeeLatencyChartWidth - employeeLatencyChartPadding.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 5"
                        />
                        <text
                          x={employeeLatencyChartPadding.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[11px]"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={employeeLatencyChartPadding.left}
                    y1={employeeLatencyChartPadding.top}
                    x2={employeeLatencyChartPadding.left}
                    y2={employeeLatencyChartHeight - employeeLatencyChartPadding.bottom}
                    stroke="#cbd5e1"
                  />
                  <line
                    x1={employeeLatencyChartPadding.left}
                    y1={employeeLatencyChartHeight - employeeLatencyChartPadding.bottom}
                    x2={employeeLatencyChartWidth - employeeLatencyChartPadding.right}
                    y2={employeeLatencyChartHeight - employeeLatencyChartPadding.bottom}
                    stroke="#cbd5e1"
                  />

                  {employeeResponsePath ? (
                    <path
                      d={employeeResponsePath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {employeeResolutionPath ? (
                    <path
                      d={employeeResolutionPath}
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  ) : null}

                  {employeeLatencySeries.map((point, index) =>
                    typeof point.avgResponseMinutes === 'number' ? (
                      <circle
                        key={`employee-response-dot-${point.key}`}
                        cx={toEmployeeLatencyX(index)}
                        cy={toEmployeeLatencyY(point.avgResponseMinutes)}
                        r="4"
                        fill="#2563eb"
                      />
                    ) : null
                  )}
                  {employeeLatencySeries.map((point, index) =>
                    typeof point.avgResolutionMinutes === 'number' ? (
                      <circle
                        key={`employee-resolution-dot-${point.key}`}
                        cx={toEmployeeLatencyX(index)}
                        cy={toEmployeeLatencyY(point.avgResolutionMinutes)}
                        r="4"
                        fill="#16a34a"
                      />
                    ) : null
                  )}

                  {employeeLatencySeries.map((point, index) => (
                    <text
                      key={`employee-x-label-${point.key}`}
                      x={toEmployeeLatencyX(index)}
                      y={employeeLatencyChartHeight - 16}
                      textAnchor="middle"
                      className="fill-slate-500 text-[11px]"
                    >
                      {point.label}
                    </text>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Timing data will appear after replies and ticket status updates are recorded.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Conversation Stream</h2>
                  <p className="text-xs text-slate-500">Latest customer conversations and assignment updates</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <BarChart3 size={13} />
                  {recentTickets.length} of {tickets.length} shown
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <p className="px-5 py-6 text-sm text-slate-500">Loading ticket activity...</p>
              ) : recentTickets.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">No recent tickets available.</p>
              ) : (
                recentTickets.map((ticket) => (
                  <button
                    key={ticket._id || ticket.id}
                    type="button"
                    onClick={() => openTicketInQueries(ticket._id || ticket.id)}
                    className="group w-full px-5 py-4 text-left transition hover:bg-blue-50/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-blue-700">
                          {ticket.ticketCode || ticket._id || ticket.id}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ticket.message}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {formatLabel(ticket.category)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityStyles[ticket.priority] || 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {formatLabel(ticket.priority)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[ticket.status] || 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {formatLabel(ticket.status)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        {ticket.createdAt ? formatSlotWithDate(ticket.createdAt) : 'Unknown time'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-rose-700" />
              <h2 className="text-lg font-semibold text-rose-700">Priority Radar</h2>
            </div>
            <p className="mt-1 text-sm text-rose-700">
              High-priority unresolved tickets: {employeeUrgentTickets.length}
            </p>
            {employeeUrgentTickets.length === 0 ? (
              <p className="mt-3 text-sm text-rose-600/90">No active high-priority tickets right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {employeeUrgentTickets.slice(0, 4).map((ticket) => (
                  <li key={ticket._id || ticket.id}>
                    <button
                      type="button"
                      onClick={() => openTicketInQueries(ticket._id || ticket.id)}
                      className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-left transition hover:bg-rose-50"
                    >
                      <p className="text-sm font-semibold text-rose-700">
                        {ticket.ticketCode || ticket._id || ticket.id}
                      </p>
                      <p className="truncate text-xs text-slate-600">{ticket.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Shift Insights</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Open Workload</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{employeeOpenLoad} tickets</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Resolution Share</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{employeeResolvedShare}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Queue Health</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {pendingCount > resolvedCount ? 'Backlog building' : 'Healthy processing pace'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {pendingCount > resolvedCount
                    ? 'Prioritize pending tickets to reduce spillover.'
                    : 'Current response and resolution pace is stable.'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default RoleBasedDashboard;
