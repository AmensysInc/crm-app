import { useState } from "react";
import { Send, Clock, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, Button, Field, Input, Textarea, Select, Dropdown, DropdownItem, DropdownLabel } from "../ui";
import { activitiesApi, aiApi } from "../../lib/services";
import { useAuth } from "../../context/AuthContext";
import { mailtoLink, nextWeekday, tomorrowAt, combineDateTime } from "../../lib/activity";
import { dateInputValue } from "../../lib/format";
import { format } from "date-fns";

const TEMPLATES = {
  "": { subject: "", body: "" },
  "Follow-up after call": {
    subject: "Great speaking with you, {first}",
    body: "Hi {first},\n\nThanks for taking the time to talk today. As discussed, I'll share the details we covered and suggested next steps.\n\nLet me know if any questions come up in the meantime.\n\nBest,\n{me}",
  },
  "Proposal follow-up": {
    subject: "Following up on our proposal for {company}",
    body: "Hi {first},\n\nI wanted to check whether you had a chance to review the proposal I sent over. Happy to walk through it or adjust anything to fit {company}'s needs.\n\nWould a quick call this week work?\n\nBest,\n{me}",
  },
  "Meeting request": {
    subject: "Quick meeting next week?",
    body: "Hi {first},\n\nWould you be open to a 30-minute call next week to discuss how we can help {company}? Let me know a time that suits you.\n\nBest,\n{me}",
  },
  "Checking in": {
    subject: "Checking in",
    body: "Hi {first},\n\nJust checking in to see how things are going on your side and whether there is anything I can help with.\n\nBest,\n{me}",
  },
};

const AI_PURPOSES = ["Follow-up", "Meeting request", "Sales pitch", "Re-engagement", "Thank you"];

/**
 * Compose a follow-up email to a lead. "Send now" opens the user's email app
 * with everything filled in and logs it on the timeline; "Send later"
 * schedules it as a follow-up. Passing `activity` sends a scheduled email.
 */
export function EmailComposeDialog({ open, onClose, lead, activity, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [lastKey, setLastKey] = useState(null);
  const [aiPurpose, setAiPurpose] = useState("Follow-up");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const key = open && lead ? `${lead._id}-${activity?._id || "new"}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    setPicking(false);
    setForm(
      key
        ? {
            to: lead.email || "",
            template: "",
            subject: activity?.title || "",
            body: activity?.body || "",
            remind: true,
            remindDays: 3,
            laterDate: dateInputValue(tomorrowAt()),
            laterTime: "09:00",
          }
        : null
    );
  }

  if (!lead || !form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fill = (text) =>
    text
      .replaceAll("{first}", lead.name.split(" ")[0])
      .replaceAll("{company}", lead.company || "your team")
      .replaceAll("{me}", user?.name || "");

  const applyTemplate = (e) => {
    const t = TEMPLATES[e.target.value];
    setForm((f) => ({
      ...f,
      template: e.target.value,
      subject: t.subject ? fill(t.subject) : f.subject,
      body: t.body ? fill(t.body) : f.body,
    }));
  };

  const writeWithAi = async () => {
    setAiLoading(true);
    try {
      const res = await aiApi.generateEmail({
        leadId: lead._id,
        purpose: aiPurpose,
        tone: "Friendly & professional",
      });
      setForm((f) => ({ ...f, subject: res.subject, body: res.body }));
    } catch (err) {
      toast.error(err.message || "Could not generate email");
    } finally {
      setAiLoading(false);
    }
  };

  const validate = () => {
    if (!form.subject.trim()) return toast.error("Add a subject"), false;
    if (!form.body.trim()) return toast.error("Write the message"), false;
    return true;
  };

  const scheduleReminder = () => {
    if (!form.remind) return null;
    const at = new Date();
    at.setDate(at.getDate() + Number(form.remindDays));
    at.setHours(10, 0, 0, 0);
    return activitiesApi.create({
      lead: lead._id,
      type: "call",
      status: "scheduled",
      title: `Follow up on "${form.subject.trim()}"`,
      body: "Check whether they replied to the email.",
      scheduledAt: at,
      durationMin: 15,
    });
  };

  const sendNow = async () => {
    if (!validate()) return;
    if (!form.to.trim()) return toast.error("This lead has no email address");
    setSaving(true);
    try {
      window.location.href = mailtoLink(form.to.trim(), form.subject.trim(), form.body.trim());
      const data = {
        type: "email",
        status: "done",
        title: form.subject.trim(),
        body: form.body.trim(),
        completedAt: new Date(),
      };
      const res = activity
        ? await activitiesApi.update(activity._id, data)
        : await activitiesApi.create({ ...data, lead: lead._id });
      const reminder = await scheduleReminder();
      toast.success("Email opened in your mail app and logged");
      onSaved?.(res.activity);
      if (reminder) onSaved?.(reminder.activity);
      onClose();
    } catch (err) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const sendLater = async (when) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        type: "email",
        status: "scheduled",
        title: form.subject.trim(),
        body: form.body.trim(),
        scheduledAt: when,
      };
      const res = activity
        ? await activitiesApi.update(activity._id, data)
        : await activitiesApi.create({ ...data, lead: lead._id });
      toast.success(`Email scheduled for ${format(when, "EEE d MMM, h:mm a")}`);
      onSaved?.(res.activity);
      onClose();
    } catch (err) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const laterOptions = [
    ["Tomorrow morning", tomorrowAt(9)],
    ["Monday morning", nextWeekday(1, 9)],
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Follow-up email"
      description={`${lead.name}${lead.company ? ` · ${lead.company}` : ""}`}
      className="max-w-xl"
    >
      <div className="space-y-4">
        <Field label="To">
          <Input type="email" value={form.to} onChange={set("to")} placeholder="name@company.com" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Template">
            <Select value={form.template} onChange={applyTemplate}>
              <option value="">No template</option>
              {Object.keys(TEMPLATES)
                .filter(Boolean)
                .map((t) => (
                  <option key={t}>{t}</option>
                ))}
            </Select>
          </Field>
          <Field label="Write with AI">
            <div className="flex gap-2">
              <Select value={aiPurpose} onChange={(e) => setAiPurpose(e.target.value)}>
                {AI_PURPOSES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <Button variant="subtle" onClick={writeWithAi} loading={aiLoading} className="shrink-0">
                {!aiLoading && <Sparkles className="h-4 w-4" />} Write
              </Button>
            </div>
          </Field>
        </div>

        <Field label="Subject">
          <Input value={form.subject} onChange={set("subject")} />
        </Field>
        <Field label="Message">
          <Textarea rows={9} value={form.body} onChange={set("body")} />
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={form.remind}
            onChange={(e) => setForm((f) => ({ ...f, remind: e.target.checked }))}
            className="h-4 w-4 accent-brand-700"
          />
          <span className="font-medium text-ink">Remind me to follow up in</span>
          <Select value={form.remindDays} onChange={set("remindDays")} className="h-8 w-24" disabled={!form.remind}>
            {[1, 2, 3, 5, 7].map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "day" : "days"}
              </option>
            ))}
          </Select>
          <span className="hidden text-ink-soft sm:inline">if sent now</span>
        </label>

        {picking && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-muted p-3">
            <Field label="Send on" className="flex-1">
              <Input type="date" value={form.laterDate} onChange={set("laterDate")} />
            </Field>
            <Field label="At" className="w-32">
              <Input type="time" value={form.laterTime} onChange={set("laterTime")} />
            </Field>
            <Button
              variant="secondary"
              loading={saving}
              onClick={() => sendLater(combineDateTime(form.laterDate, form.laterTime))}
            >
              Schedule
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <p className="mr-auto text-xs text-ink-soft">Send now opens your email app.</p>
          <Dropdown
            align="right"
            className="bottom-full mb-2 mt-0 w-64"
            trigger={
              <Button variant="outline" disabled={saving}>
                <Clock className="h-4 w-4" /> Send later <ChevronDown className="h-4 w-4" />
              </Button>
            }
          >
            <DropdownLabel>Schedule send</DropdownLabel>
            {laterOptions.map(([label, when]) => (
              <DropdownItem key={label} onClick={() => sendLater(when)} className="justify-between">
                <span>{label}</span>
                <span className="text-xs text-ink-soft">{format(when, "EEE h:mm a")}</span>
              </DropdownItem>
            ))}
            <DropdownItem onClick={() => setPicking(true)}>Pick date &amp; time…</DropdownItem>
          </Dropdown>
          <Button onClick={sendNow} loading={saving}>
            <Send className="h-4 w-4" /> Send now
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
