import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: [true, "Company name is required"], trim: true },
    industry: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// One company per name per workspace — leads reference companies by name.
companySchema.index({ owner: 1, name: 1 }, { unique: true });

export const Company = mongoose.model("Company", companySchema);
