import { Company } from "../models/Company.js";
import { Lead } from "../models/Lead.js";
import { Contact } from "../models/Contact.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Make sure every company name already used on a lead or contact has a
 * Company record, so records created before companies existed still show up.
 */
export const ensureCompanies = async (owner, names) => {
  const unique = [...new Set(names.map((n) => n?.trim()).filter(Boolean))];
  if (!unique.length) return;
  await Company.bulkWrite(
    unique.map((name) => ({
      updateOne: {
        filter: { owner, name },
        update: { $setOnInsert: { owner, name } },
        upsert: true,
      },
    }))
  );
};

export const getCompanies = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const [leadNames, contactNames] = await Promise.all([
    Lead.distinct("company", { owner }),
    Contact.distinct("company", { owner }),
  ]);
  await ensureCompanies(owner, [...leadNames, ...contactNames]);

  const { search } = req.query;
  const filter = { owner };
  if (search) filter.name = new RegExp(search, "i");

  const [companies, leadCounts, contactCounts] = await Promise.all([
    Company.find(filter).sort({ name: 1 }).lean(),
    Lead.aggregate([
      { $match: { owner } },
      { $group: { _id: "$company", leads: { $sum: 1 }, value: { $sum: "$value" } } },
    ]),
    Contact.aggregate([
      { $match: { owner } },
      { $group: { _id: "$company", contacts: { $sum: 1 } } },
    ]),
  ]);

  // Attach lead / contact counts + pipeline value per company for the UI.
  const leadsByName = new Map(leadCounts.map((c) => [c._id, c]));
  const contactsByName = new Map(contactCounts.map((c) => [c._id, c.contacts]));
  const withStats = companies.map((c) => ({
    ...c,
    leadCount: leadsByName.get(c.name)?.leads || 0,
    pipelineValue: leadsByName.get(c.name)?.value || 0,
    contactCount: contactsByName.get(c.name) || 0,
  }));

  res.json({ success: true, count: withStats.length, companies: withStats });
});

export const getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, owner: req.user._id });
  if (!company) throw new ApiError(404, "Company not found");
  res.json({ success: true, company });
});

export const createCompany = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  if (await Company.exists({ owner: req.user._id, name })) {
    throw new ApiError(409, `A company named "${name}" already exists`);
  }
  const company = await Company.create({ ...req.body, owner: req.user._id });
  res.status(201).json({ success: true, company });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const { owner, ...updates } = req.body;
  const existing = await Company.findOne({ _id: req.params.id, owner: req.user._id });
  if (!existing) throw new ApiError(404, "Company not found");

  const newName = updates.name?.trim();
  if (newName && newName !== existing.name) {
    if (await Company.exists({ owner: req.user._id, name: newName })) {
      throw new ApiError(409, `A company named "${newName}" already exists`);
    }
    // Leads and contacts store the company by name, so carry the rename over.
    const match = { owner: req.user._id, company: existing.name };
    await Promise.all([
      Lead.updateMany(match, { $set: { company: newName } }),
      Contact.updateMany(match, { $set: { company: newName } }),
    ]);
  }

  Object.assign(existing, updates);
  await existing.save();
  res.json({ success: true, company: existing });
});

export const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ _id: req.params.id, owner: req.user._id });
  if (!company) throw new ApiError(404, "Company not found");

  const match = { owner: req.user._id, company: company.name };
  const [leadCount, contactCount] = await Promise.all([
    Lead.countDocuments(match),
    Contact.countDocuments(match),
  ]);
  if (leadCount > 0 || contactCount > 0) {
    const parts = [
      leadCount && `${leadCount} lead${leadCount === 1 ? "" : "s"}`,
      contactCount && `${contactCount} contact${contactCount === 1 ? "" : "s"}`,
    ].filter(Boolean);
    throw new ApiError(
      400,
      `"${company.name}" has ${parts.join(" and ")}. Move or delete them first.`
    );
  }

  await company.deleteOne();
  res.json({ success: true, message: "Company deleted" });
});
