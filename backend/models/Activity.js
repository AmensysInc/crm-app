import mongoose from "mongoose";

export const ACTIVITY_TYPES = ["call", "email", "sms", "whatsapp", "meeting", "note", "task"];
export const ACTIVITY_STATUSES = ["done", "scheduled", "canceled"];
export const CALL_OUTCOMES = ["Connected", "No answer", "Left voicemail", "Busy", "Wrong number"];
export const MEETING_LOCATIONS = ["Google Meet", "Zoom", "Phone", "In person", "Other"];

/* One touchpoint with a lead: something already done (logged call, sent email,
   WhatsApp message…) or a planned follow-up (status "scheduled"). */
const activitySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    status: { type: String, enum: ACTIVITY_STATUSES, default: "done", index: true },
    direction: { type: String, enum: ["outbound", "inbound"], default: "outbound" },
    title: { type: String, trim: true, default: "" },
    body: { type: String, default: "" },
    outcome: { type: String, default: "" },
    durationMin: { type: Number, default: 0, min: 0 },
    scheduledAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    location: { type: String, default: "" },
    meetingLink: { type: String, trim: true, default: "" },
    attendees: [{ type: String, trim: true }],
    reminderMinutes: { type: Number, default: null },
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", activitySchema);
