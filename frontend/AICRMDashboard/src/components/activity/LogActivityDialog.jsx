import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, Button, Field, Input, Textarea, Select } from "../ui";
import { activitiesApi } from "../../lib/services";
import {
  ACTIVITY_TYPES,
  CALL_OUTCOMES,
  smsLink,
  telLink,
  whatsappLink,
} from "../../lib/activity";
import { cn } from "../../lib/utils";

const nowInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Log something that already happened with a lead: a call, SMS, WhatsApp
 * message or note. For messages, it can also open the phone / WhatsApp app
 * with the text pre-filled.
 */
export function LogActivityDialog({ open, onClose, lead, type = "call", onSaved }) {
  const [form, setForm] = useState(() => initialForm());
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState(null);

  // Reset whenever the dialog is reopened for a (possibly different) type.
  const key = open ? `${type}-${lead?._id}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) setForm(initialForm());
  }

  if (!lead) return null;
  const cfg = ACTIVITY_TYPES[type];
  const isMessage = type === "sms" || type === "whatsapp";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.body.trim() && type !== "call") {
      toast.error(type === "note" ? "Write the note first" : "Add the message text");
      return;
    }
    setSaving(true);
    try {
      const res = await activitiesApi.create({
        lead: lead._id,
        type,
        status: "done",
        direction: form.direction,
        title: type === "call" ? `${form.direction === "inbound" ? "Call from" : "Call with"} ${lead.name}` : "",
        outcome: type === "call" ? form.outcome : "",
        durationMin: type === "call" ? Number(form.durationMin) || 0 : 0,
        body: form.body.trim(),
        completedAt: new Date(form.when),
      });
      toast.success(`${cfg.label} logged`);
      onSaved?.(res.activity);
      onClose();
    } catch (err) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const openApp = () => {
    const href =
      type === "whatsapp" ? whatsappLink(lead.phone, form.body) : smsLink(lead.phone, form.body);
    window.open(href, "_blank", "noopener");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={type === "note" ? "Add note" : `Log ${cfg.label === "SMS" ? "SMS" : cfg.label.toLowerCase()}`}
      description={`${lead.name}${lead.company ? ` · ${lead.company}` : ""}`}
    >
      <div className="space-y-4">
        {type !== "note" && (
          <div className="grid grid-cols-2 gap-2">
            {[
              ["outbound", type === "call" ? "I called" : "I sent"],
              ["inbound", type === "call" ? "They called" : "They sent"],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, direction: v }))}
                className={cn(
                  "h-10 rounded-xl border text-sm font-medium transition",
                  form.direction === v
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-line text-ink-soft hover:bg-surface-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {type === "call" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Outcome">
              <Select value={form.outcome} onChange={set("outcome")}>
                {CALL_OUTCOMES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Duration (minutes)">
              <Input type="number" min="0" value={form.durationMin} onChange={set("durationMin")} />
            </Field>
          </div>
        )}

        <Field label={type === "call" ? "Notes" : type === "note" ? "Note" : "Message"}>
          <Textarea
            rows={5}
            value={form.body}
            onChange={set("body")}
            placeholder={
              type === "call"
                ? "What did you talk about? Any next steps?"
                : type === "note"
                ? "Anything worth remembering about this lead…"
                : "Type the message…"
            }
          />
        </Field>

        <Field label="When">
          <Input type="datetime-local" value={form.when} onChange={set("when")} />
        </Field>

        {(isMessage || type === "call") && lead.phone && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-ink-soft">
            {type === "call" ? (
              <a href={telLink(lead.phone)} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                Call {lead.phone} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <>
                <button type="button" onClick={openApp} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                  Open in {type === "whatsapp" ? "WhatsApp" : "messages app"} <ExternalLink className="h-3 w-3" />
                </button>
                <span>with this text, then save it here.</span>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function initialForm() {
  return { direction: "outbound", outcome: "Connected", durationMin: "", body: "", when: nowInput() };
}
