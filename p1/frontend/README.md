# Customs Declaration Sandbox — Frontend

Public, four-step customs declaration form (General Information, Shipping Details, Invoice Details, Payment Details) with search popups, invoice line items, a `.txt` invoice upload and full validation. No sign-in and no backend: nothing is sent anywhere.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

All listings (parties, carriers, ports, HS codes, currencies, fees) are in `src/constants/declarationData.ts`.

## Scripts

| Script                   | Purpose          |
| ------------------------ | ---------------- |
| `npm run dev`            | Dev server       |
| `npm run build`          | Production build |
| `npm run typecheck`      | TypeScript check |
| `npm run lint`           | ESLint           |
| `npm run prettier:check` | Formatting check |

See `CLAUDE.md` for how the code is organised.
