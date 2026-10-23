import { Activity } from "../models/Activity.js";
import { Lead } from "../models/Lead.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const LEAD_FIELDS = "name company email phone status";

const assertLead = async (owner, leadId) => {
  const lead = await Lead.exists({ _id: leadId, owner });
  if (!lead) throw new ApiError(404, "Lead not found");
};

/* Keep completedAt in step with status changes. */
const withCompletion = (data) => {
  if (data.status === "done" && !data.completedAt) data.completedAt = new Date();
  if (data.status && data.status !== "done") data.completedAt = null;
  return data;
};

export const getActivities = asyncHandler(async (req, res) => {
  const { lead, status, type, from, to } = req.query;
  const filter = { owner: req.user._id };
  if (lead) filter.lead = lead;
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);
  }

  const activities = await Activity.find(filter)
    .sort({ scheduledAt: 1, completedAt: -1, createdAt: -1 })
    .populate("lead", LEAD_FIELDS);

  res.json({ success: true, count: activities.length, activities });
});

export const createActivity = asyncHandler(async (req, res) => {
  const { owner, ...data } = req.body;
  if (!data.lead) throw new ApiError(400, "Activity must belong to a lead");
  await assertLead(req.user._id, data.lead);
  if (data.status === "scheduled" && !data.scheduledAt) {
    throw new ApiError(400, "Pick a date and time for the follow-up");
  }

  const activity = await Activity.create(withCompletion({ ...data, owner: req.user._id }));
  await activity.populate("lead", LEAD_FIELDS);
  res.status(201).json({ success: true, activity });
});

export const updateActivity = asyncHandler(async (req, res) => {
  const { owner, lead, ...updates } = req.body;

  const activity = await Activity.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    withCompletion(updates),
    { new: true, runValidators: true }
  ).populate("lead", LEAD_FIELDS);
  if (!activity) throw new ApiError(404, "Activity not found");
  res.json({ success: true, activity });
});

export const deleteActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!activity) throw new ApiError(404, "Activity not found");
  res.json({ success: true, message: "Activity deleted" });
});
