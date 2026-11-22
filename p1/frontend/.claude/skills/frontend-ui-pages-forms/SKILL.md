---
name: frontend-ui-pages-forms
description: How pages, forms, components, routing/auth guard and styling are written in expense-calling-frontend (Next.js App Router, Formik + Yup, Tailwind v4, lucide-react, react-hot-toast). Use when creating or editing a page, form, reusable component, or public/private route.
---

# Pages, forms, components

## Folder map

```
src/app/<route>/page.tsx          pages ('use client'), default export
src/app/validations/<x>Validation.ts   Yup schemas
src/components/ui/                reusable primitives (button, input, loader)
src/components/layout/            layout pieces (header, authContainer)
src/constants/routes.ts           PUBLIC_ROUTES, default redirects
src/config/config.ts              env + app constants (always import config, never process.env)
src/types/*.ts                    interfaces (alias @app-types/*); re-exported from src/utils/interface.ts
src/utils/helpers.ts              handleErrorMessages, handleLogMessages, handleLogout
```

Always import with path aliases (`@components/*`, `@services/*`, `@store/*`, `@app-types/*`, `@utils/*`, `@config/*`, `@constants/*`, `@app/*`, `@api/*`), not relative paths.

## Routing and auth guard

- `src/app/layout.tsx` is a client component with a client-side auth guard. On every path change it checks `authIntrospect()` → `getAuthUser()`.
  - Not logged in on a private route → `/login`.
  - Logged in on a public route or `/` → `/dashboard`.
- **Every route is private by default.** To make a page public, add its path to `PUBLIC_ROUTES` in `src/constants/routes.ts`.
- The `Header` only renders when authenticated. Pages render inside `<main className="flex-1 flex flex-col">`.
- Don't export anything except the default component from `layout.tsx`/`page.tsx`. Put shared constants in `src/constants`.

## Page template

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@store/index';
import Loader from '@components/ui/loader';
import { getExpenses } from '@services/api/expense';

const Page = () => {
  const [isLoading, setIsLoading] = useState(true);
  const expenses = useSelector((state: RootState) => state.expense.expenses);

  useEffect(() => {
    getExpenses().finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loader className="min-h-[50vh]" />;

  return <div className="p-4 md:p-6">{/* ... */}</div>;
};

export default Page;
```

Pages call service functions, read redux with `useSelector`, and keep UI-only state in `useState`. They never call `fetch` directly.

## Forms: Formik + Yup

- Schema in `src/app/validations/<feature>Validation.ts` (`export const xxxValidationSchema = Yup.object({...})`). Mirror backend validator rules so users see errors before submit.
- `useFormik<PayloadType>({ initialValues, validationSchema, onSubmit: async values => { await serviceFn(values); } })`
- Render with `<form onSubmit={formik.handleSubmit} noValidate>` and the shared `<Input formik={formik} name="..." label="..." startIcon={<Icon size={18} />} />`. It wires value/change/blur and shows `formik.errors[name]` when touched.
- Submit with `<Button type="submit" loading={formik.isSubmitting}>`.
- Server errors are toasted by the service (`handleErrorMessages`). Don't duplicate them in the page.

See `src/app/login/page.tsx` and `src/app/signup/page.tsx`.

## Components

- Arrow-function components, `const X: React.FC<Props> = (...) => {...}; export default X;`
- Props interfaces go in `src/types/ui.ts` (or `common.ts` for form-related) and get re-exported via `src/utils/interface.ts`.
- Icons: `lucide-react`. Notifications: `react-hot-toast` (`toast.success`/`toast.error`). The `<Toaster>` is already mounted in the layout.

## Styling

- Tailwind CSS v4 via `@import 'tailwindcss'` in `src/app/globals.css`. There's no tailwind.config. Theme tokens live in the `@theme` block: `--color-primary` (`bg-primary`, `text-primary`), `--color-primary-dark`, `--shadow-soft`.
- Add new brand colors as `@theme` tokens rather than hard-coding hex values across components.
- Animations available: `animate-slideFadeIn`, `animate-scalePop`.

## Formatting

Prettier: single quotes, semicolons, 2 spaces, `printWidth: 140`, `arrowParens: avoid`, trailing commas es5. Run `npm run prettier` before finishing.

## Mobile / PWA conventions

- The app is used on phones as an installed PWA. Design mobile-first: no horizontal scroll at 375px, touch targets of at least 44px, `active:scale-*` press feedback, and the `safe-top` / `safe-bottom` utilities (or `env(safe-area-inset-*)`) for anything pinned to screen edges.
- Animations live in `src/app/globals.css` as keyframes + `.animate-*` classes (`slideFadeIn`, `scalePop`, `callSlideUp`, `bubbleIn`, `answerBounce`, ripple/typing dots). Animate `transform`/`opacity` only, and keep the global `prefers-reduced-motion` rule working.
- Device APIs go through `src/utils/pwa.ts` and `src/utils/speech.ts`, always feature-detected and best-effort (vibration, wake lock, notifications, speech). Never let a missing API break a flow.
- Changing `public/sw.js`: bump `CACHE` when precached files change. Keep it plain JS, and keep push payload types in sync with `PushPayload` in the backend's `push_service.ts`.
- Deep links into the dashboard use query params (`?action=call`, `?call=<id>`), read once on mount and then removed with `history.replaceState`.

## App shell and new pages

- Signed-in pages render inside `AppShell` automatically (from `src/app/layout.tsx`). A new page = `src/app/<route>/page.tsx` + an entry in `NAV_ITEMS` (`src/constants/navigation.ts`) if it belongs in the tab bar/sidebar. Keep the phone tab bar at 4 items + the call button.
- Don't fetch shared data (settings, call status, today, history) in pages; the shell loads it into redux. Read it with `useSelector`.
- Page building blocks: `PageHeader` (title on desktop; phones show it in the app bar), `Panel` (white rounded section), `SettingsGroup` + `SettingsRow` (grouped lists), `Switch`, `ExpenseRow`, `StatTile`, `CategoryBreakdown`.
- Background is `bg-app`; cards are `bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60`. Inputs use `text-base md:text-sm` (16px on phones stops iOS zooming in).
