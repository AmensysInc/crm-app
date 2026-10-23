import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isTomorrow,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  AlarmClock,
  AlertTriangle,
  CalendarClock,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Send,
  Video,
} from "lucide-react";

import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { StatCard } from "../components/common/StatCard";
import { Button, Card, Dropdown, DropdownItem, DropdownSeparator, Spinner } from "../components/ui";
import { ActivityDialogs } from "../components/activity/ActivityDialogs";
import { activitiesApi } from "../lib/services";
import {
  ACTIVITY_TYPES,
  SCHEDULABLE_TYPES,
  nextWeekday,
  smsLink,
  telLink,
  tomorrowAt,
  whatsappLink,
} from "../lib/activity";
import { cn } from "../lib/utils";

const GROUPS = [
  { key: "overdue", label: "Overdue", className: "text-rose-700" },
  { key: "today", label: "Today", className: "text-brand-700" },
  { key: "tomorrow", label: "Tomorrow", className: "text-ink" },
  { key: "week", label: "Later this week", className: "text-ink" },
  { key: "later", label: "Later", className: "text-ink-soft" },
];

function groupOf(date, now) {
  if (date < now && !isToday(date)) return "overdue";
  if (isToday(date)) return date < now ? "overdue" : "today";
  if (isTomorrow(date)) return "tomorrow";
  if (date <= endOfWeek(now, { weekStartsOn: 1 })) return "week";
  return "later";
}

/** Agenda of every planned follow-up across all leads. */
export default function FollowUps() {
  const [items, setItems] = useState([]);
  const [doneThisWeek, setDoneThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [day, setDay] = useState(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const [scheduled, done] = await Promise.all([
        activitiesApi.list({ status: "scheduled" }),
        activitiesApi.list({ status: "done", from: weekStart.toISOString() }),
      ]);
      setItems(scheduled.activities.filter((a) => a.lead));
      setDoneThisWeek(done.count);
    } catch (err) {
      toast.error(err.message || "Could not load follow-ups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = (activity) => {
    if (activity.status === "scheduled") {
      setItems((list) => [...list.filter((a) => a._id !== activity._id), activity]);
    } else {
      setItems((list) => list.filter((a) => a._id !== activity._id));
      setDoneThisWeek((n) => n + 1);
    }
  };

  const update = async (a, data, message) => {
    try {
      const res = await activitiesApi.update(a._id, data);
      onSaved(res.activity);
      toast.success(message);
    } catch (err) {
      toast.error(err.message || "Could not update");
    }
  };

  const complete = (a) => update(a, { status: "done" }, "Marked as done");
  const snooze = (a, when) =>
    update(a, { scheduledAt: when }, `Moved to ${format(when, "EEE d MMM, h:mm a")}`);

  const now = new Date();
  const filtered = useMemo(
    () =>
      items
        .filter((a) => type === "all" || a.type === type)
        .filter((a) => !day || isSameDay(new Date(a.scheduledAt), day))
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    [items, type, day]
  );

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: filtered.filter((a) => groupOf(new Date(a.scheduledAt), now) === g.key),
  })).filter((g) => g.items.length);

  const counts = {
    overdue: items.filter((a) => groupOf(new Date(a.scheduledAt), now) === "overdue").length,
    today: items.filter((a) => isToday(new Date(a.scheduledAt))).length,
    week: items.filter((a) => new Date(a.scheduledAt) <= endOfWeek(now, { weekStartsOn: 1 })).length,
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Follow-ups" subtitle="Every planned call, email, meeting and message across your leads." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overdue" value={counts.overdue} icon={AlertTriangle} />
        <StatCard label="Due today" value={counts.today} icon={Clock} accent />
        <StatCard label="Due this week" value={counts.week} icon={CalendarDays} />
        <StatCard label="Done this week" value={doneThisWeek} icon={CalendarCheck2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-5 sm:p-6">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {["all", ...SCHEDULABLE_TYPES].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  type === t ? "bg-ink text-white" : "bg-surface-muted text-ink-soft hover:text-ink"
                )}
              >
                {t === "all" ? "All" : ACTIVITY_TYPES[t].label}
              </button>
            ))}
            {day && (
              <button
                onClick={() => setDay(null)}
                className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800"
              >
                {format(day, "d MMM")} ✕
              </button>
            )}
          </div>

          {grouped.length ? (
            <div className="mt-5 space-y-6">
              {grouped.map((g) => (
                <section key={g.key}>
                  <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", g.className)}>
                    {g.label} · {g.items.length}
                  </h3>
                  <ul className="divide-y divide-line rounded-2xl border border-line">
                    {g.items.map((a) => (
                      <FollowUpRow
                        key={a._id}
                        activity={a}
                        overdue={g.key === "overdue"}
                        onComplete={complete}
                        onSnooze={snooze}
                        onReschedule={() =>
                          setDialog({ kind: a.type === "email" ? "email" : "schedule", type: a.type, activity: a, lead: a.lead })
                        }
                        onSendEmail={() => setDialog({ kind: "email", activity: a, lead: a.lead })}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title={items.length ? "Nothing matches this filter" : "No follow-ups planned"}
              description="Open a lead and use “Schedule follow-up” to plan the next call, email or meeting."
              action={
                <Link to="/leads">
                  <Button variant="outline">Go to leads</Button>
                </Link>
              }
            />
          )}
        </Card>

        <MiniCalendar items={items} month={month} onMonth={setMonth} selected={day} onSelect={setDay} />
      </div>

      <ActivityDialogs dialog={dialog} onClose={() => setDialog(null)} onSaved={onSaved} />
    </div>
  );
}

function FollowUpRow({ activity: a, overdue, onComplete, onSnooze, onReschedule, onSendEmail }) {
  const { icon: Icon, label, tone } = ACTIVITY_TYPES[a.type];
  const when = new Date(a.scheduledAt);
  const phone = a.lead.phone;

  const primary = (() => {
    if (a.type === "email") return { label: "Send now", icon: Send, onClick: onSendEmail };
    if (a.type === "meeting" && a.meetingLink) return { label: "Join", icon: Video, href: a.meetingLink };
    if (a.type === "call" && phone) return { label: "Call", icon: ExternalLink, href: telLink(phone) };
    if (a.type === "whatsapp" && phone) return { label: "Open WhatsApp", icon: ExternalLink, href: whatsappLink(phone, a.body) };
    if (a.type === "sms" && phone) return { label: "Open SMS", icon: ExternalLink, href: smsLink(phone, a.body) };
    return null;
  })();

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{a.title || label}</p>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            <span className={cn("font-medium", overdue && "text-rose-600")}>
              {isToday(when) || isTomorrow(when) ? format(when, "h:mm a") : format(when, "EEE d MMM · h:mm a")}
            </span>
            {" · "}
            <Link to={`/leads/${a.lead._id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
              {a.lead.name}
            </Link>
            {a.lead.company && ` · ${a.lead.company}`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
        {primary &&
          (primary.href ? (
            <a
              href={primary.href}
              target={primary.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full brand-gradient px-3.5 text-sm font-medium text-white"
            >
              <primary.icon className="h-3.5 w-3.5" /> {primary.label}
            </a>
          ) : (
            <Button size="sm" onClick={primary.onClick}>
              <primary.icon className="h-3.5 w-3.5" /> {primary.label}
            </Button>
          ))}
        <Button size="sm" variant="secondary" onClick={() => onComplete(a)} aria-label="Mark done" title="Mark done">
          <Check className="h-4 w-4" />
        </Button>
        <Dropdown
          trigger={
            <Button size="sm" variant="outline" aria-label="Snooze" title="Snooze">
              <AlarmClock className="h-4 w-4" />
            </Button>
          }
        >
          <DropdownItem onClick={() => onSnooze(a, new Date(Date.now() + 60 * 60 * 1000))}>In 1 hour</DropdownItem>
          <DropdownItem onClick={() => onSnooze(a, tomorrowAt(9))}>Tomorrow 9:00 AM</DropdownItem>
          <DropdownItem onClick={() => onSnooze(a, nextWeekday(1, 9))}>Next Monday 9:00 AM</DropdownItem>
          <DropdownSeparator />
          <DropdownItem onClick={onReschedule}>Pick date &amp; time…</DropdownItem>
        </Dropdown>
      </div>
    </li>
  );
}

function MiniCalendar({ items, month, onMonth, selected, onSelect }) {
  const days = [];
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  const countOn = (d) => items.filter((a) => isSameDay(new Date(a.scheduledAt), d)).length;
  const today = startOfDay(new Date());

  return (
    <Card className="h-fit p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{format(month, "MMMM yyyy")}</p>
        <div className="flex gap-1">
          <button onClick={() => onMonth(addMonths(month, -1))} className="rounded-lg p-1 text-ink-soft hover:bg-surface-muted" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => onMonth(addMonths(month, 1))} className="rounded-lg p-1 text-ink-soft hover:bg-surface-muted" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-soft">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const n = countOn(d);
          const isSel = selected && isSameDay(d, selected);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(isSel ? null : d)}
              className={cn(
                "relative flex h-9 flex-col items-center justify-center rounded-lg text-xs transition",
                !isSameMonth(d, month) && "text-ink-soft/50",
                isSameDay(d, today) && "font-bold text-brand-700",
                isSel ? "bg-ink text-white" : "hover:bg-surface-muted"
              )}
            >
              {format(d, "d")}
              {n > 0 && (
                <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", isSel ? "bg-white" : d < today ? "bg-rose-500" : "bg-brand-600")} />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-soft">Click a day to see only its follow-ups.</p>
    </Card>
  );
}
