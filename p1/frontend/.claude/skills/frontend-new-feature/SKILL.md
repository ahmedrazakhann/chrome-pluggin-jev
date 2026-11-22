---
name: frontend-new-feature
description: Step-by-step checklist for adding a new feature/page to expense-calling-frontend end to end (types → BFF route → client service → redux slice → validation → page → verify). Use when the user asks to build a new screen, module, CRUD flow, or integrate a new backend endpoint in the frontend.
---

# Adding a feature to expense-calling-frontend

Follow these steps in order. Details for each layer are in the sibling skills:

- `frontend-api-layer`: BFF routes, httpClient, services, backend contract
- `frontend-redux-state`: slices and store
- `frontend-ui-pages-forms`: pages, forms, components, routing, styling

Running example: an "expenses" list + create form.

## Checklist

1. **Confirm the backend endpoint.** Read `../expense-calling-backend/start/routes/*.ts`, the controller, and the validator to get the exact path, method, payload, and response `data` shape.
2. **Types**: `src/types/expense.ts` (`Expense`, `CreateExpensePayload`). Add `export * from '@app-types/expense';` to `src/utils/interface.ts`.
3. **BFF route**: `src/app/api/expenses/route.ts` (GET/POST), plus `src/app/api/expenses/[id]/route.ts` if needed. Proxy with `httpClient('/api/expenses', ...)`.
4. **Service**: `src/services/api/expense.ts` with `getExpenses`, `createExpense`, etc. It calls `fetch('/api/expenses')`, formats with an `expenseFormatter`, toasts errors through `handleErrorMessages`, dispatches into redux, and returns typed data or `null`/`false`.
5. **State** (only if shared across pages): `src/store/slices/expenseSlice.ts`, registered in `src/store/index.ts`.
6. **Validation** (forms): `src/app/validations/expenseValidation.ts`, mirroring the backend validator.
7. **Page**: `src/app/expenses/page.tsx` (`'use client'`). It's private by default. Add it to `PUBLIC_ROUTES` in `src/constants/routes.ts` only if it must be reachable logged-out. Reuse `Input`, `Button`, `Loader`.
8. **Navigation**: if the feature needs a link, add it to `src/components/layout/header.tsx` (keep it minimal).
9. **Config**: new env vars go in `.env.example` and are exposed through `src/config/config.ts`.
10. **Verify** from `expense-calling-frontend/`:
    ```bash
    npm run typecheck && npm run lint && npm run prettier:check && npm run build
    ```
    Then run `npm run dev` with the backend up and click through the flow.

## Don'ts

- Don't call the backend URL from client code, and don't read `session_token` in the browser (it's httpOnly).
- Don't put `fetch` calls in pages/components. Go through a service.
- Don't add async thunks or RTK Query. Services + plain slice setters is the pattern.
- Don't add new UI or state libraries without asking. Stack: Next 16 App Router, React 19, Redux Toolkit, Formik + Yup, Tailwind v4, lucide-react, react-hot-toast.
- Don't use relative imports across top-level folders. Use the `@` aliases.
