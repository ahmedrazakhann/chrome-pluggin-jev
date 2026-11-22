---
name: frontend-api-layer
description: How the expense-calling-frontend talks to the backend — BFF proxy routes in src/app/api, the server-side httpClient, and client service functions in src/services/api. Use whenever adding or changing an API call, a Next.js route handler, or anything that touches the session cookie.
---

# Frontend API layer

The browser **never** calls the AdonisJS backend directly. Every call goes through three layers:

```
page / component
  → src/services/api/<feature>.ts      (client: fetch('/api/...'), toasts, formatting, redux dispatch)
    → src/app/api/<route>/route.ts     (Next.js BFF route, runs on the server)
      → src/services/http-client.ts    (httpClient / backendFetch → `${config.backendUrl}/api/...`)
```

Why: the backend session token lives in an **httpOnly `session_token` cookie** on the Next.js origin. Only server code can read it, so only BFF routes can attach it to backend requests.

## 1. Server: `src/services/http-client.ts` (server-only)

- `httpClient(endpoint, options)` returns parsed JSON and **throws `Error(message)` on non-2xx**. Use it for normal routes.
- `backendFetch(endpoint, options)` returns the raw `Response`. Use it only when you need headers or the backend's exact status/error body (login/signup use it to read `Set-Cookie`).
- Both forward the session as `Cookie: access_token=<token>`. The backend's `injectTokenFromCookie` middleware turns that into a Bearer token. Don't send an `Authorization` header yourself.
- Never import `http-client.ts` from a `'use client'` file. It uses `next/headers`.
- The backend's content-type middleware returns **415** for a POST/PUT/PATCH without a JSON or multipart body, and for any request that sends `Content-Type` without a body. `backendFetch` only adds `Content-Type: application/json` when you pass a body, so body-less POSTs must send `body: JSON.stringify({})`. Pass `FormData` as the body for uploads and the multipart boundary is set for you.
- For downloads, stream `res.body` through with its `Content-Type`/`Content-Disposition` headers (see `src/app/api/expenses/export/route.ts`). For backend status codes the UI must see (409, 422), use `backendFetch` plus `forwardJson` from `src/app/api/proxy.ts`.

## 2. BFF route: `src/app/api/<kebab-name>/route.ts`

Thin proxy: read input, call the backend, return JSON. Keep business logic out of it. Template:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { httpClient } from '@services/http-client';

export async function GET() {
  try {
    const response = await httpClient('/api/expenses', { method: 'GET' });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ status: false, message: error.message || 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const response = await httpClient('/api/expenses', { method: 'POST', body: JSON.stringify(body) });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

Dynamic segment: `src/app/api/expenses/[id]/route.ts`. In Next 16 `params` is a Promise:

```ts
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  ...
}
```

To pass the backend's field-level validation errors to the form (instead of a generic 500), use `backendFetch` plus `errorResponse` from `src/app/api/session.ts`. See `src/app/api/login/route.ts`.

Shared server helpers for routes live in `src/app/api/session.ts`. Only files named `route.ts` become endpoints.

## 3. Client service: `src/services/api/<feature>.ts`

One file per feature. Exported async functions that:

1. `fetch('/api/<route>')` (relative URL, same origin, so the cookie is sent automatically)
2. check `response.ok` / `data.status`
3. on error: `handleErrorMessages(data?.errors ?? data?.message)` (toasts each message) and return `false`/`null`
4. on success: optionally `toast.success(...)`, format the data with a local `xxxFormatter`, `dispatch(...)` into redux if it's shared state, return the typed result
5. wrap everything in `try/catch` → `handleLogMessages(error)` and return `null`/`false`

```ts
import toast from 'react-hot-toast';
import { dispatch } from '@store/index';
import { setExpenses } from '@store/slices/expenseSlice';
import { handleErrorMessages, handleLogMessages } from '@utils/helpers';
import { Expense } from '@app-types/expense';

const expenseFormatter = (data: any): Expense => ({
  id: data.id,
  title: data.title || '',
  amount: Number(data.amount) || 0,
});

export const getExpenses = async (): Promise<Expense[] | null> => {
  try {
    const response = await fetch('/api/expenses');
    const data = await response.json();
    if (!response.ok || !data.status) {
      handleErrorMessages(data?.errors ?? data?.message);
      return null;
    }
    const expenses = (data.data || []).map(expenseFormatter);
    dispatch(setExpenses(expenses));
    return expenses;
  } catch (error: any) {
    handleLogMessages(error);
    return null;
  }
};
```

Rules:

- Services use the store's exported `dispatch` directly (`import { dispatch } from '@store/index'`). They don't take dispatch as a parameter.
- Services never throw to the page. They return `null`/`false` and the page decides what to do.
- Map backend shapes to frontend types in a formatter. Pages never see raw backend JSON.

## Backend contract (expense-calling-backend, AdonisJS)

- Success: `{ status: true, message, data }`
- Error (non-2xx): `{ title, status, message, errors: [{ field, code, message }] }`
- Auth endpoints: `POST /api/login`, `POST /api/register` (`fullName`, `email`, `password`), `GET /api/me`, `POST /api/logout`
- The backend sets an `access_token` cookie on login/register (no token in the body). `getBackendToken()` in `src/app/api/session.ts` copies it into our `session_token` cookie.

Check the backend's `start/routes/*.ts` and validators before writing a new route so the endpoint path and payload match.

## Env

- `NEXT_PUBLIC_BACKEND_URL` is read through `config.backendUrl` (`src/config/config.ts`). Always go through `config`, never `process.env` in feature code. `NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing them.
