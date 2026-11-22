---
name: frontend-redux-state
description: How global state works in expense-calling-frontend — Redux Toolkit slices in src/store/slices, registering reducers, reading with useSelector, and writing from services via the exported dispatch. Use when adding shared state, a new slice, or deciding between redux and local component state.
---

# Redux state pattern

Store: `src/store/index.ts`. Slices: `src/store/slices/<name>Slice.ts`. Redux Toolkit + react-redux. `<Provider>` is mounted in `src/app/layout.tsx`.

## When to use redux vs local state

- **Redux**: data shared across pages or reused after navigation (the logged-in user, fetched entity lists, cross-page UI flags).
- **`useState`**: page-only UI (loading spinners, modal open, form-local values). Forms use Formik, not redux.

## Adding a slice

1. Create `src/store/slices/expenseSlice.ts`:

```ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Expense } from '@app-types/expense';

interface ExpenseState {
  expenses: Expense[];
  selectedExpense: Expense | null;
}

const initialState: ExpenseState = {
  expenses: [],
  selectedExpense: null,
};

export const expenseSlice = createSlice({
  name: 'expense',
  initialState,
  reducers: {
    setExpenses: (state, action: PayloadAction<Expense[]>) => {
      state.expenses = action.payload;
    },
    setSelectedExpense: (state, action: PayloadAction<Expense | null>) => {
      state.selectedExpense = action.payload;
    },
  },
});

export const { setExpenses, setSelectedExpense } = expenseSlice.actions;

export default expenseSlice.reducer;
```

2. Register it in `src/store/index.ts`:

```ts
import expenseReducer from '@store/slices/expenseSlice';
...
reducer: {
  auth: authReducer,
  expense: expenseReducer,
},
```

## Conventions

- State shape is an `interface XxxState` plus a typed `initialState`. Always type actions with `PayloadAction<T>`.
- Reducers are plain setters/updaters (`setX`, `updateX`, `toggleX`). No async thunks. Async work lives in `src/services/api/*` and dispatches the result.
- Writing: services call `dispatch(setExpenses(...))` using `import { dispatch } from '@store/index'`. Components that must dispatch use `useDispatch<AppDispatch>()`.
- Reading: `const expenses = useSelector((state: RootState) => state.expense.expenses);`
- Types for slice data live in `src/types/<feature>.ts` (alias `@app-types/*`).

## Auth state

`state.auth.authDetails: UserData | null` is the source of truth for "logged in". It's set by `getAuthUser()` in `src/services/api/auth.ts`. The root layout's auth guard reacts to it to redirect between `/login` and `/dashboard`. On logout, `setAuthDetails(null)` runs and the page fully reloads to `/login`.
