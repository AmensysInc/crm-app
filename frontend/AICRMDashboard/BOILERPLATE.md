# UI Boilerplate (`boilerplate-src/`)

A **copy of `src/` with no API integration** — the entire UI runs on in-memory
**mock data** so you can build and demo the frontend before the backend exists.
This is the folder you clone at the start of the frontend tutorial.

## How to use it

Copy it in as your app's `src/` in a fresh Vite project:

```bash
# inside your new frontend project
rm -rf src
cp -R /path/to/boilerplate-src src
npm install   # deps below
npm run dev
```

Runtime deps used by the UI:
`react-router-dom axios react-hook-form recharts lucide-react clsx tailwind-merge class-variance-authority date-fns @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner`
(plus `tailwindcss @tailwindcss/vite` from the Vite + Tailwind v4 setup).

Log in with **any** email/password (or the "Try the demo account" button) — auth
is mocked, so it always succeeds and drops you into the app with sample data.

## What's different from the real `src/`

Only the **data layer** changed — every page, component, chart and dialog is
identical:

| File | Boilerplate (this copy) | Real app (`src/`) |
| --- | --- | --- |
| `lib/api.js` | axios client **commented out**; only `TOKEN_KEY` exported | live axios instance + interceptors |
| `lib/services.js` | returns **mock data** via `reply(...)`; real `api.*` calls kept commented above each method | real `api.*` calls |
| `lib/mockData.js` | **mock dataset** (leads, contacts, notes, tasks, AI, user) | _does not exist_ |

CRUD works during the demo via small in-memory stores (they reset on refresh).
The dashboard analytics are computed from those same mock leads, so every page
stays consistent — even after you add or edit records.

## Switching to the real backend (after the backend tutorial)

Three small steps — no page/component edits needed because the shapes match:

1. **`lib/api.js`** — uncomment the `import axios` line and the API-client block.
2. **`lib/services.js`** — uncomment `import api from "./api"`, then for each
   method swap the mock line for the commented real `api.*(...)` line right above
   it. (Optionally delete `lib/mockData.js` and the in-memory store helpers.)
3. Create `.env` with `VITE_API_URL=http://localhost:8000/api` if your API isn't
   on the default port.

That's it — the UI is now fully wired to your Express + MongoDB backend.
