import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Users,
  Contact2,
  CircleDollarSign,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import {
  Button,
  Card,
  Input,
  Textarea,
  Field,
  Badge,
  Avatar,
  Dialog,
  Dropdown,
  DropdownItem,
  Spinner,
} from "../components/ui";
import { companiesApi } from "../lib/services";
import { currency } from "../lib/format";
import { cn } from "../lib/utils";

/* ─── Companies page ─────────────────────────────────────────────────────────
   Accounts your leads belong to. Companies used on leads are listed
   automatically; new ones can be added here or from the lead form.
   ──────────────────────────────────────────────────────────────────────────── */
export default function Companies() {
  // null = loading, [] = empty, [...] = loaded
  const [companies, setCompanies] = useState(null);
  // Other pages link here with ?search=<company name>.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // company being edited
  const [toDelete, setToDelete] = useState(null); // company pending deletion
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    companiesApi
      .list()
      .then((res) => setCompanies(res.companies))
      .catch(() => setCompanies([]));
  };
  useEffect(load, []);

  // ── Derived data ────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const list = companies || [];
    return {
      total: list.length,
      withLeads: list.filter((c) => c.leadCount > 0).length,
      pipeline: list.reduce((sum, c) => sum + (c.pipelineValue || 0), 0),
    };
  }, [companies]);

  const filtered = useMemo(() => {
    if (!companies) return [];
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.website?.toLowerCase().includes(q)
    );
  }, [companies, search]);

  // ── Handlers ──────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (company) => {
    setEditing(company);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await companiesApi.remove(toDelete._id);
      toast.success("Company removed");
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader title="Companies" subtitle="The accounts your leads belong to.">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Add company
        </Button>
      </PageHeader>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={Building2}
          tint="bg-brand-50 text-brand-600"
          label="Total companies"
          value={kpis.total}
        />
        <StatTile
          icon={Users}
          tint="bg-sky-50 text-sky-600"
          label="With active leads"
          value={kpis.withLeads}
        />
        <StatTile
          icon={CircleDollarSign}
          tint="bg-amber-50 text-amber-500"
          label="Pipeline value"
          value={currency(kpis.pipeline, { compact: true })}
        />
      </div>

      {/* ── Search ── */}
      <Card className="flex items-center gap-3 p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, industry, or website…"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-soft/60 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <span className="whitespace-nowrap text-sm text-ink-soft">
          <span className="font-semibold text-ink">{filtered.length}</span> of{" "}
          {companies?.length ?? 0}
        </span>
      </Card>

      {/* ── Results — loading / empty / grid ── */}
      {companies === null ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "No companies match" : "No companies yet"}
          description={
            search
              ? "Try a different search term."
              : "Add a company, or pick one when creating a lead."
          }
          action={
            !search ? (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Add company
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company) => (
            <CompanyCard
              key={company._id}
              company={company}
              onEdit={() => openEdit(company)}
              onDelete={() => setToDelete(company)}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <CompanyFormDialog
        open={formOpen}
        company={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove this company?"
        description={`"${toDelete?.name}" will be permanently deleted. Companies that still have leads or contacts can't be removed.`}
        confirmLabel="Remove company"
      />
    </div>
  );
}

/* ─── StatTile ───────────────────────────────────────────────────────────────
   KPI card: tinted icon square + label + large value.
   ──────────────────────────────────────────────────────────────────────────── */
function StatTile({ icon: Icon, label, value, tint }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            tint
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-soft">{label}</p>
          <p className="font-display text-lg font-bold text-ink">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/* ─── CompanyCard ────────────────────────────────────────────────────────────
   Single company tile: identity, lead / contact counts, pipeline value,
   contact info. The contact count links to the filtered Contacts page.
   ──────────────────────────────────────────────────────────────────────────── */
function CompanyCard({ company, onEdit, onDelete }) {
  const website = company.website?.replace(/^https?:\/\//, "");

  return (
    <div className="relative rounded-2xl border border-line bg-surface p-5 shadow-(--shadow-card)">
      <div className="absolute right-3 top-3">
        <Dropdown
          trigger={
            <button
              aria-label="Company actions"
              className="rounded-lg p-1.5 text-ink-soft/50 transition hover:bg-surface-muted hover:text-ink-soft"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        >
          <DropdownItem onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownItem>
          <DropdownItem danger onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownItem>
        </Dropdown>
      </div>

      {/* Identity */}
      <div className="flex items-start gap-3 pr-8">
        <Avatar name={company.name} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight text-ink">{company.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {company.industry || "No industry set"}
          </p>
        </div>
      </div>

      {/* Lead stats */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge className="bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
          {company.leadCount} lead{company.leadCount === 1 ? "" : "s"}
        </Badge>
        <Link
          to={`/contacts?company=${encodeURIComponent(company.name)}`}
          title={`Show contacts at ${company.name}`}
          className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 transition hover:bg-sky-100"
        >
          <Contact2 className="h-3 w-3" />
          {company.contactCount} contact{company.contactCount === 1 ? "" : "s"}
        </Link>
        {company.pipelineValue > 0 && (
          <Badge className="bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
            {currency(company.pipelineValue, { compact: true })}
          </Badge>
        )}
      </div>

      {/* Info rows */}
      <div className="mt-3 space-y-1.5">
        {website && (
          <InfoRow icon={Globe}>
            <a
              href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noreferrer"
              className="truncate hover:text-brand-700 hover:underline"
            >
              {website}
            </a>
          </InfoRow>
        )}
        {company.email && <InfoRow icon={Mail}>{company.email}</InfoRow>}
        {company.phone && <InfoRow icon={Phone}>{company.phone}</InfoRow>}
        {company.address && <InfoRow icon={MapPin}>{company.address}</InfoRow>}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, children }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

/* ─── CompanyFormDialog ──────────────────────────────────────────────────────
   Add / Edit dialog backed by react-hook-form. Renaming a company also
   renames it on its leads (handled by the API).
   ──────────────────────────────────────────────────────────────────────────── */
function CompanyFormDialog({ open, company, onClose, onSaved }) {
  const isEdit = Boolean(company);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      name: company?.name || "",
      industry: company?.industry || "",
      website: company?.website || "",
      email: company?.email || "",
      phone: company?.phone || "",
      address: company?.address || "",
      notes: company?.notes || "",
    });
  }, [open, company, reset]);

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await companiesApi.update(company._id, values);
        toast.success("Company updated");
      } else {
        await companiesApi.create(values);
        toast.success("Company added");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Something went wrong");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit company" : "New company"}
      description={
        isEdit ? "Update the details below." : "Add a company to attach leads to."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-4">
        <Field label="Company name" error={errors.name?.message}>
          <Input
            {...register("name", {
              required: "Company name is required",
              validate: (v) => v.trim() !== "" || "Company name is required",
            })}
            placeholder="Acme Inc."
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry">
            <Input {...register("industry")} placeholder="SaaS" />
          </Field>
          <Field label="Website">
            <Input {...register("website")} placeholder="acme.com" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input {...register("email")} type="email" placeholder="hello@acme.com" />
          </Field>
          <Field label="Phone">
            <Input {...register("phone")} type="tel" placeholder="+1 555 000 0000" />
          </Field>
        </div>

        <Field label="Address">
          <Input {...register("address")} placeholder="City, Country" />
        </Field>

        <Field label="Notes">
          <Textarea
            {...register("notes")}
            placeholder="Anything worth remembering about this account…"
            rows={3}
          />
        </Field>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Add company"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
