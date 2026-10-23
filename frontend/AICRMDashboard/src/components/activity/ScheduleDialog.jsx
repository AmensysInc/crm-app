import { useEffect, useState } from "react";
import { X, Video, Phone, MapPin, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, Button, Field, Input, Textarea, Select, Avatar } from "../ui";
import { activitiesApi, contactsApi } from "../../lib/services";
import {
  ACTIVITY_TYPES,
  SCHEDULABLE_TYPES,
  MEETING_LOCATIONS,
  REMINDER_OPTIONS,
  combineDateTime,
  downloadIcs,
  tomorrowAt,
} from "../../lib/activity";
import { dateInputValue } from "../../lib/format";
import { cn } from "../../lib/utils";

const LOCATION_ICONS = { "Google Meet": Video, Zoom: Video, Phone, "In person": MapPin };
const DURATIONS = [15, 30, 45, 60, 90];

const timeValue = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const defaultTitle = (type, lead) =>
  ({
    call: `Call ${lead.name}`,
    email: `Email ${lead.name}`,
    meeting: `Meeting with ${lead.company || lead.name}`,
    sms: `Text ${lead.name}`,
    whatsapp: `WhatsApp ${lead.name}`,
    task: `Follow up with ${lead.name}`,
  })[type];

function initialForm(lead, type, activity) {
  if (activity) {
    const at = new Date(activity.scheduledAt);
    return {
      type: activity.type,
      title: activity.title,
      date: dateInputValue(at),
      time: timeValue(at),
      durationMin: activity.durationMin || 30,
      location: activity.location || "Google Meet",
      meetingLink: activity.meetingLink || "",
      attendees: activity.attendees || [],
      body: activity.body || "",
      reminderMinutes: activity.reminderMinutes ?? "",
      invite: false,
    };
  }
  const at = tomorrowAt(10);
  return {
    type,
    title: defaultTitle(type, lead),
    date: dateInputValue(at),
    time: timeValue(at),
    durationMin: 30,
    location: "Google Meet",
    meetingLink: "",
    attendees: [lead.name],
    body: "",
    reminderMinutes: 30,
    invite: true,
  };
}

/**
 * Schedule (or reschedule) a follow-up for a lead: call, email, meeting, SMS,
 * WhatsApp or task. Meetings get a place, attendees and an optional .ics invite.
 */
export function ScheduleDialog({ open, onClose, lead, type = "meeting", activity, onSaved }) {
  const [form, setForm] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [saving, setSaving] = useState(false);

  const key = open && lead ? `${lead._id}-${activity?._id || type}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(key ? initialForm(lead, type, activity) : null);
    setAttendeeInput("");
  }

  // Colleagues at the lead's company are suggested as attendees.
  const company = open ? lead?.company : "";
  useEffect(() => {
    if (!company) return;
    let alive = true;
    contactsApi
      .list({ search: company })
      .then((res) => alive && setContacts(res.contacts))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [company]);

  if (!lead || !form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isMeeting = form.type === "meeting";

  const changeType = (t) =>
    setForm((f) => ({
      ...f,
      type: t,
      // Keep a custom title; swap the auto-generated one.
      title: f.title === defaultTitle(f.type, lead) ? defaultTitle(t, lead) : f.title,
    }));

  const addAttendee = (name) => {
    const n = name.trim();
    if (!n || form.attendees.includes(n)) return;
    setForm((f) => ({ ...f, attendees: [...f.attendees, n] }));
    setAttendeeInput("");
  };
  const removeAttendee = (n) =>
    setForm((f) => ({ ...f, attendees: f.attendees.filter((a) => a !== n) }));

  const suggestions = contacts.filter(
    (c) => c.company === company && !form.attendees.includes(c.name)
  );

  const save = async () => {
    if (!form.title.trim()) return toast.error("Give the follow-up a title");
    if (!form.date) return toast.error("Pick a date");
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        status: "scheduled",
        title: form.title.trim(),
        body: form.body.trim(),
        scheduledAt: combineDateTime(form.date, form.time),
        durationMin: isMeeting || form.type === "call" ? Number(form.durationMin) : 0,
        location: isMeeting ? form.location : "",
        meetingLink: isMeeting ? form.meetingLink.trim() : "",
        attendees: isMeeting ? form.attendees : [],
        reminderMinutes: form.reminderMinutes === "" ? null : Number(form.reminderMinutes),
      };
      const res = activity
        ? await activitiesApi.update(activity._id, payload)
        : await activitiesApi.create({ ...payload, lead: lead._id });
      if (isMeeting && form.invite) downloadIcs(res.activity);
      toast.success(activity ? "Follow-up updated" : "Follow-up scheduled");
      onSaved?.(res.activity);
      onClose();
    } catch (err) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={activity ? "Reschedule follow-up" : "Schedule follow-up"}
      description={`${lead.name}${lead.company ? ` · ${lead.company}` : ""}`}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Type</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SCHEDULABLE_TYPES.map((t) => {
              const { icon: Icon, label } = ACTIVITY_TYPES[t];
              const active = form.type === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeType(t)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-xs font-medium transition",
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-line text-ink-soft hover:bg-surface-muted"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Title">
          <Input value={form.title} onChange={set("title")} />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={set("date")} />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.time} onChange={set("time")} />
          </Field>
          {(isMeeting || form.type === "call") && (
            <Field label="Duration">
              <Select value={form.durationMin} onChange={set("durationMin")}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} minutes
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {isMeeting && (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Where</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEETING_LOCATIONS.map((loc) => {
                  const Icon = LOCATION_ICONS[loc];
                  const active = form.location === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, location: loc }))}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "border-brand-600 bg-brand-50 text-brand-800"
                          : "border-line text-ink-soft hover:bg-surface-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {loc}
                    </button>
                  );
                })}
              </div>
              {(form.location === "Google Meet" || form.location === "Zoom") && (
                <div className="relative mt-2">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <Input
                    className="pl-9"
                    value={form.meetingLink}
                    onChange={set("meetingLink")}
                    placeholder={`Paste the ${form.location} link (optional)`}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Attendees</p>
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line px-2 py-1.5">
                {form.attendees.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted py-0.5 pl-1 pr-1.5 text-sm">
                    <Avatar name={n} size="sm" className="h-6 w-6 text-[10px]" />
                    {n}
                    <button type="button" aria-label={`Remove ${n}`} onClick={() => removeAttendee(n)} className="text-ink-soft hover:text-ink">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAttendee(attendeeInput);
                    }
                  }}
                  placeholder="Add a name and press Enter"
                  className="min-w-40 flex-1 bg-transparent px-1 text-sm focus:outline-none"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                  From {company}:
                  {suggestions.slice(0, 6).map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => addAttendee(c.name)}
                      className="rounded-full border border-line px-2.5 py-1 font-medium text-ink hover:bg-surface-muted"
                    >
                      + {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Field label={isMeeting ? "Agenda" : "Notes"}>
          <Textarea
            rows={3}
            value={form.body}
            onChange={set("body")}
            placeholder={isMeeting ? "What will you cover?" : "What is this follow-up about?"}
          />
        </Field>

        <Field label="Reminder">
          <Select value={form.reminderMinutes} onChange={set("reminderMinutes")}>
            {REMINDER_OPTIONS.map((r) => (
              <option key={r.label} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        {isMeeting && (
          <label className="flex items-start gap-2.5 rounded-xl border border-line px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.invite}
              onChange={(e) => setForm((f) => ({ ...f, invite: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-brand-700"
            />
            <span>
              <span className="font-medium text-ink">Download calendar invite (.ics)</span>
              <span className="text-ink-soft"> — open it to add the meeting to your calendar and send it to attendees.</span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {activity ? "Save changes" : isMeeting ? "Schedule meeting" : "Schedule"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
