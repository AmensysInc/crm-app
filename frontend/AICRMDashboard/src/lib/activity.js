import {
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  CalendarDays,
  StickyNote,
  CheckSquare,
} from "lucide-react";

/* Display config for each activity type (mirrors backend ACTIVITY_TYPES). */
export const ACTIVITY_TYPES = {
  call: { label: "Call", icon: Phone, tone: "bg-sky-50 text-sky-700" },
  email: { label: "Email", icon: Mail, tone: "bg-violet-50 text-violet-700" },
  sms: { label: "SMS", icon: MessageSquare, tone: "bg-amber-50 text-amber-700" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "bg-emerald-50 text-emerald-700" },
  meeting: { label: "Meeting", icon: CalendarDays, tone: "bg-pink-50 text-pink-700" },
  note: { label: "Note", icon: StickyNote, tone: "bg-slate-100 text-slate-600" },
  task: { label: "Task", icon: CheckSquare, tone: "bg-teal-50 text-teal-700" },
};

export const SCHEDULABLE_TYPES = ["call", "email", "meeting", "sms", "whatsapp", "task"];
export const CALL_OUTCOMES = ["Connected", "No answer", "Left voicemail", "Busy", "Wrong number"];
export const MEETING_LOCATIONS = ["Google Meet", "Zoom", "Phone", "In person"];
export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: 10, label: "10 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

/** When an activity happened (done) or is due (scheduled). */
export const activityDate = (a) =>
  new Date(a.status === "scheduled" ? a.scheduledAt : a.completedAt || a.createdAt);

/** Digits-only phone for wa.me links. */
const phoneDigits = (phone = "") => phone.replace(/[^\d]/g, "");

export const telLink = (phone) => `tel:${phone}`;
export const smsLink = (phone, text = "") =>
  `sms:${phone}${text ? `?body=${encodeURIComponent(text)}` : ""}`;
export const whatsappLink = (phone, text = "") =>
  `https://wa.me/${phoneDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const mailtoLink = (to, subject = "", body = "") =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** Combine <input type="date"> and <input type="time"> values into a Date. */
export const combineDateTime = (date, time) => new Date(`${date}T${time || "09:00"}`);

/** Next occurrence of a weekday (0=Sun) at the given hour. */
export function nextWeekday(day, hour = 9) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const diff = (day - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Tomorrow at the given hour. */
export function tomorrowAt(hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const icsDate = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s = "") =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

/** Download an .ics calendar invite so meetings can be added to any calendar app. */
export function downloadIcs(activity) {
  const start = new Date(activity.scheduledAt);
  const end = new Date(start.getTime() + (activity.durationMin || 30) * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Xeno CRM//EN",
    "BEGIN:VEVENT",
    `UID:${activity._id || Date.now()}@xeno-crm`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(activity.title)}`,
    `DESCRIPTION:${icsText([activity.body, activity.meetingLink].filter(Boolean).join("\n\n"))}`,
    `LOCATION:${icsText(activity.meetingLink || activity.location || "")}`,
    ...(activity.reminderMinutes
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", `TRIGGER:-PT${activity.reminderMinutes}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(activity.title || "meeting").replace(/[^\w-]+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
