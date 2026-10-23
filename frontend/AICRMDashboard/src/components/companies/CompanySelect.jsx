import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { companiesApi } from "../../lib/services";
import { cn } from "../../lib/utils";

/**
 * Searchable company picker. Lists the workspace's existing companies and
 * offers to create a new one from whatever was typed. The value is the
 * company name (leads store the company by name).
 */
export function CompanySelect({ value, onChange, placeholder = "Search or add a company" }) {
  const [companies, setCompanies] = useState(null); // null = loading
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    companiesApi
      .list()
      .then((res) => setCompanies(res.companies))
      .catch(() => setCompanies([]));
  }, []);

  // Keep the input in sync when the form resets to another lead.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value || "");
  }

  // Close on outside click; discard unsaved typing by reverting to the value.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery(value || "");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value]);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    const list = companies || [];
    if (!trimmed || trimmed === value) return list;
    const q = trimmed.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, trimmed, value]);

  const exactMatch = (companies || []).some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = Boolean(trimmed) && !exactMatch;
  // Options: existing matches, then the "create" row last.
  const optionCount = matches.length + (canCreate ? 1 : 0);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const openList = () => {
    setActive(0);
    setOpen(true);
  };

  const select = (name) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await companiesApi.create({ name: trimmed });
      setCompanies((prev) =>
        [...(prev || []), { ...res.company, leadCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      toast.success(`Company "${res.company.name}" created`);
      select(res.company.name);
    } catch (err) {
      toast.error(err?.message || "Could not create company");
    } finally {
      setCreating(false);
    }
  };

  const choose = (index) => {
    if (index < matches.length) select(matches[index].name);
    else if (canCreate) create();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      // Don't submit the surrounding lead form while picking.
      e.preventDefault();
      if (optionCount) choose(active);
    } else if (e.key === "Escape" && open) {
      // Keep the parent dialog open; just close the list.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      setQuery(value || "");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onFocus={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          openList();
          if (!e.target.value.trim()) onChange("");
        }}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-ink-soft/60 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft transition",
          open && "rotate-180"
        )}
      />

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-(--shadow-pop)"
        >
          {companies === null ? (
            <p className="px-3 py-2.5 text-sm text-ink-soft">Loading companies…</p>
          ) : (
            <>
              {matches.length === 0 && !canCreate && (
                <p className="px-3 py-2.5 text-sm text-ink-soft">
                  No companies yet. Type a name to add one.
                </p>
              )}
              {matches.map((c, i) => (
                <button
                  key={c._id}
                  type="button"
                  role="option"
                  data-index={i}
                  aria-selected={c.name === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(c.name)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
                    active === i ? "bg-surface-muted" : ""
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{c.name}</span>
                    {(c.industry || c.leadCount > 0) && (
                      <span className="block truncate text-xs text-ink-soft">
                        {[
                          c.industry,
                          c.leadCount > 0 &&
                            `${c.leadCount} lead${c.leadCount === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                  {c.name === value && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  data-index={matches.length}
                  onMouseEnter={() => setActive(matches.length)}
                  onClick={create}
                  disabled={creating}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-700 transition",
                    matches.length > 0 && "mt-1 border-t border-line",
                    active === matches.length ? "bg-brand-50" : ""
                  )}
                >
                  {creating ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">Create company “{trimmed}”</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
