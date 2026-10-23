import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Pencil,
  CalendarClock,
  History,
  Video,
} from "lucide-react";

import { Button, Card, Badge, Avatar, Spinner } from "../components/ui";
import { EmptyState } from "../components/common/EmptyState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { LeadFormDialog } from "../components/leads/LeadFormDialog";
import { ActivityTimeline } from "../components/activity/ActivityTimeline";
import { ActivityDialogs } from "../components/activity/ActivityDialogs";
import { leadsApi, activitiesApi } from "../lib/services";
import { ACTIVITY_TYPES, activityDate, telLink } from "../lib/activity";
import { currency, shortDate, relative } from "../lib/format";
import { STAGE_STYLES, PRIORITY_STYLES } from "../lib/constants";
import { cn } from "../lib/utils";

/* Quick actions across the top: what each button opens. */
const QUICK_ACTIONS = [
  { type: "call", label: "Log call", kind: "log" },
  { type: "email", label: "Email", kind: "email" },
  { type: "sms", label: "SMS", kind: "log" },
  { type: "whatsapp", label: "WhatsApp", kind: "log" },
  { type: "meeting", label: "Meeting", kind: "schedule" },
  { type: "note", label: "Note", kind: "log" },
];

const FILTERS = ["all", "call", "email", "sms", "whatsapp", "meeting", "note", "task"];

/** Full lead page: who they are, everything done with them, and what's next. */
export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([leadsApi.get(id), activitiesApi.list({ lead: id })]);
      setLead(l.lead);
      setActivities(a.activities);
    } catch (err) {
      toast.error(err.message || "Could not load lead");
      if (err.status === 404) navigate("/leads", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = (activity) =>
    setActivities((list) => [activity, ...list.filter((a) => a._id !== activity._id)]);

  const complete = async (a) => {
    try {
      const res = await activitiesApi.update(a._id, { status: "done" });
      upsert(res.activity);
      toast.success("Marked as done");
    } catch (err) {
      toast.error(err.message || "Could not update");
    }
  };

  const confirmDelete = async () => {
    try {
      await activitiesApi.remove(toDelete._id);
      setActivities((list) => list.filter((a) => a._id !== toDelete._id));
      toast.success("Activity deleted");
    } catch (err) {
      toast.error(err.message || "Could not delete");
    } finally {
      setToDelete(null);
    }
  };

  const stats = useMemo(() => {
    const since = subDays(new Date(), 30);
    const done = activities.filter((a) => a.status === "done");
    const recent = done.filter((a) => activityDate(a) >= since);
    const count = (...types) => recent.filter((a) => types.includes(a.type)).length;
    const lastTouch = done.filter((a) => a.type !== "note").sort((a, b) => activityDate(b) - activityDate(a))[0];
    const next = activities
      .filter((a) => a.status === "scheduled")
      .sort((a, b) => activityDate(a) - activityDate(b))[0];
    return {
      calls: count("call"),
      emails: count("email"),
      messages: count("sms", "whatsapp"),
      meetings: count("meeting"),
      lastTouch,
      next,
    };
  }, [activities]);

  const visible = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  if (loading) return <Spinner />;
  if (!lead) return null;

  const stage = STAGE_STYLES[lead.status] || STAGE_STYLES.New;
  const open = (kind, type, activity) => setDialog({ kind, type, activity, lead });

  return (
    <div className="space-y-6">
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      {/* Header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={lead.name} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-ink">{lead.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                {lead.company && (
                  <Link to={`/companies?search=${encodeURIComponent(lead.company)}`} className="hover:text-brand-700 hover:underline">
                    {lead.company}
                  </Link>
                )}
                <Badge className={stage.badge} dot={stage.dot}>
                  {lead.status}
                </Badge>
                <Badge className={PRIORITY_STYLES[lead.priority]}>{lead.priority} priority</Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)} className="self-start lg:self-auto">
            <Pencil className="h-4 w-4" /> Edit lead
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {QUICK_ACTIONS.map((q) => {
            const { icon: Icon, tone } = ACTIVITY_TYPES[q.type];
            return (
              <button
                key={q.type}
                onClick={() => open(q.kind, q.type)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              >
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", tone)}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {q.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Timeline */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Activity</h2>
            <Button size="sm" variant="subtle" onClick={() => open("schedule", "call")}>
              <CalendarClock className="h-4 w-4" /> Schedule follow-up
            </Button>
          </div>

          <div className="no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => {
              const n = f === "all" ? activities.length : activities.filter((a) => a.type === f).length;
              if (f !== "all" && !n) return null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    filter === f ? "bg-ink text-white" : "bg-surface-muted text-ink-soft hover:text-ink"
                  )}
                >
                  {f === "all" ? "All" : ACTIVITY_TYPES[f].label} · {n}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            {visible.length ? (
              <ActivityTimeline
                activities={visible}
                onComplete={complete}
                onReschedule={(a) => open(a.type === "email" ? "email" : "schedule", a.type, a)}
                onSendEmail={(a) => open("email", "email", a)}
                onDelete={setToDelete}
              />
            ) : (
              <EmptyState
                icon={History}
                title="No activity yet"
                description="Log a call, send an email or schedule a follow-up — it will all show up here."
              />
            )}
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-ink-soft">Deal value</p>
            <p className="mt-1 text-2xl font-bold text-ink">{currency(lead.value)}</p>
            <div className="mt-4 space-y-2.5 text-sm">
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2.5 text-ink hover:text-brand-700">
                  <Mail className="h-4 w-4 text-ink-soft" /> <span className="truncate">{lead.email}</span>
                </a>
              )}
              {lead.phone && (
                <a href={telLink(lead.phone)} className="flex items-center gap-2.5 text-ink hover:text-brand-700">
                  <Phone className="h-4 w-4 text-ink-soft" /> {lead.phone}
                </a>
              )}
              {lead.company && (
                <p className="flex items-center gap-2.5 text-ink">
                  <Building2 className="h-4 w-4 text-ink-soft" /> {lead.company}
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              {lead.source} · added {shortDate(lead.createdAt)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Next follow-up</p>
            {stats.next ? (
              <NextFollowUp
                activity={stats.next}
                onDone={() => complete(stats.next)}
                onSend={() => open("email", "email", stats.next)}
              />
            ) : (
              <div className="mt-2">
                <p className="text-sm text-ink-soft">Nothing planned.</p>
                <Button size="sm" variant="subtle" className="mt-3" onClick={() => open("schedule", "call")}>
                  <CalendarClock className="h-4 w-4" /> Schedule one
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Last 30 days</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Calls", stats.calls],
                ["Emails", stats.emails],
                ["Messages", stats.messages],
                ["Meetings", stats.meetings],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="text-lg font-bold text-ink">{n}</p>
                  <p className="text-xs text-ink-soft">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Last contact:{" "}
              <span className="font-medium text-ink">
                {stats.lastTouch ? relative(activityDate(stats.lastTouch)) : "never"}
              </span>
            </p>
          </Card>
        </div>
      </div>

      <ActivityDialogs dialog={dialog} onClose={() => setDialog(null)} onSaved={upsert} />
      <LeadFormDialog open={editOpen} onClose={() => setEditOpen(false)} lead={lead} onSaved={setLead} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this activity?"
        description="It will be removed from the lead's timeline."
      />
    </div>
  );
}

function NextFollowUp({ activity: a, onDone, onSend }) {
  const { icon: Icon, label, tone } = ACTIVITY_TYPES[a.type];
  const when = activityDate(a);
  const overdue = when < new Date();
  return (
    <div className="mt-3">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{a.title || label}</p>
          <p className={cn("text-xs", overdue ? "font-semibold text-rose-600" : "text-ink-soft")}>
            {overdue ? "Overdue · " : ""}
            {format(when, "EEE d MMM · h:mm a")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {a.type === "email" ? (
          <Button size="sm" onClick={onSend}>Send now</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onDone}>Mark done</Button>
        )}
        {a.meetingLink && (
          <a
            href={a.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            <Video className="h-3.5 w-3.5" /> Join
          </a>
        )}
      </div>
    </div>
  );
}
