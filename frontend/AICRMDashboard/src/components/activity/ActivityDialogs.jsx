import { LogActivityDialog } from "./LogActivityDialog";
import { ScheduleDialog } from "./ScheduleDialog";
import { EmailComposeDialog } from "./EmailComposeDialog";

/**
 * Renders whichever activity dialog `dialog` describes:
 *   { kind: "log", type, lead }            log a call / SMS / WhatsApp / note
 *   { kind: "schedule", type, lead, activity? }  plan or reschedule a follow-up
 *   { kind: "email", lead, activity? }     compose (or send a scheduled) email
 */
export function ActivityDialogs({ dialog, onClose, onSaved }) {
  const lead = dialog?.lead;
  return (
    <>
      <LogActivityDialog
        open={dialog?.kind === "log"}
        onClose={onClose}
        lead={lead}
        type={dialog?.type}
        onSaved={onSaved}
      />
      <ScheduleDialog
        open={dialog?.kind === "schedule"}
        onClose={onClose}
        lead={lead}
        type={dialog?.type}
        activity={dialog?.activity}
        onSaved={onSaved}
      />
      <EmailComposeDialog
        open={dialog?.kind === "email"}
        onClose={onClose}
        lead={lead}
        activity={dialog?.activity}
        onSaved={onSaved}
      />
    </>
  );
}
