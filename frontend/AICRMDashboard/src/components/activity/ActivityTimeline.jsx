import { useMemo } from "react";
import { isToday, isYesterday, format } from "date-fns";
import { MoreHorizontal, Check, CalendarClock, Trash2, Send, ArrowDownLeft, Video, Download } from "lucide-react";
import { Dropdown, DropdownItem, Button } from "../ui";
import { ACTIVITY_TYPES, activityDate, downloadIcs } from "../../lib/activity";
import { timeOf } from "../../lib/format";
import { cn } from "../../lib/utils";

const dayLabel = (d) =>
  isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, d MMM yyyy");

/** Group activities: upcoming follow-ups first, then history by day (newest first). */
function groupActivities(activities) {
  const upcoming = activities
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => activityDate(a) - activityDate(b));
  const history = activities
    .filter((a) => a.status !== "scheduled")
    .sort((a, b) => activityDate(b) - activityDate(a));

  const groups = [];
  if (upcoming.length) groups.push({ label: "Upcoming", items: upcoming, upcoming: true });
  for (const a of history) {
    const label = dayLabel(activityDate(a));
    const last = groups[groups.length - 1];
    if (last && last.label === label && !last.upcoming) last.items.push(a);
    else groups.push({ label, items: [a] });
  }
  return groups;
}

/** Vertical timeline of everything done with a lead, plus planned follow-ups. */
export function ActivityTimeline({ activities, onComplete, onReschedule, onSendEmail, onDelete }) {
  const groups = useMemo(() => groupActivities(activities), [activities]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h4
            className={cn(
              "mb-3 text-xs font-semibold uppercase tracking-wide",
              g.upcoming ? "text-brand-700" : "text-ink-soft"
            )}
          >
            {g.label}
          </h4>
          <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-line">
            {g.items.map((a) => (
              <TimelineItem
                key={a._id}
                activity={a}
                onComplete={onComplete}
                onReschedule={onReschedule}
                onSendEmail={onSendEmail}
                onDelete={onDelete}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineItem({ activity: a, onComplete, onReschedule, onSendEmail, onDelete }) {
  const cfg = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.note;
  const Icon = cfg.icon;
  const scheduled = a.status === "scheduled";
  const overdue = scheduled && activityDate(a) < new Date();
  const when = activityDate(a);

  const meta = [
    scheduled ? format(when, "EEE d MMM · h:mm a") : timeOf(when),
    a.direction === "inbound" && "Received",
    a.outcome,
    a.durationMin > 0 && `${a.durationMin} min`,
    a.location,
  ].filter(Boolean);

  return (
    <li className="relative flex gap-3">
      <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-surface", cfg.tone)}>
        <Icon className="h-[18px] w-[18px]" />
        {a.direction === "inbound" && (
          <ArrowDownLeft className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-surface p-0.5 text-ink-soft" />
        )}
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-2xl border p-3.5",
          scheduled ? (overdue ? "border-rose-200 bg-rose-50/40" : "border-brand-200 bg-brand-50/40") : "border-line bg-surface"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {a.title || cfg.label}
              {overdue && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Overdue</span>}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              <span className="font-medium">{cfg.label}</span>
              {meta.map((m) => ` · ${m}`)}
            </p>
          </div>
          <Dropdown
            trigger={
              <button className="rounded-lg p-1 text-ink-soft hover:bg-surface-muted hover:text-ink" aria-label="Activity actions">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            {scheduled && (
              <>
                <DropdownItem onClick={() => onComplete(a)}>
                  <Check className="h-4 w-4" /> Mark done
                </DropdownItem>
                <DropdownItem onClick={() => onReschedule(a)}>
                  <CalendarClock className="h-4 w-4" /> Reschedule
                </DropdownItem>
              </>
            )}
            {scheduled && a.type === "meeting" && (
              <DropdownItem onClick={() => downloadIcs(a)}>
                <Download className="h-4 w-4" /> Calendar invite (.ics)
              </DropdownItem>
            )}
            <DropdownItem danger onClick={() => onDelete(a)}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </Dropdown>
        </div>

        {a.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{a.body}</p>}

        {a.attendees?.length > 0 && (
          <p className="mt-2 text-xs text-ink-soft">With {a.attendees.join(", ")}</p>
        )}

        {scheduled && (
          <div className="mt-3 flex flex-wrap gap-2">
            {a.type === "email" ? (
              <Button size="sm" onClick={() => onSendEmail(a)}>
                <Send className="h-3.5 w-3.5" /> Send now
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => onComplete(a)}>
                <Check className="h-3.5 w-3.5" /> Mark done
              </Button>
            )}
            {a.meetingLink && (
              <a
                href={a.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                <Video className="h-3.5 w-3.5" /> Join
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
