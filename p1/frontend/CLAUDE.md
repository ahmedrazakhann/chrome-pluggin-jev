# customs-declaration-frontend

Next.js 16 (App Router) + React 19 sandbox of a multi-step customs declaration form, used as a realistic target for the browser-automation plugin in this repository. It is public (no sign-in) and has no backend: everything runs in the browser and nothing is sent anywhere.

`/` (`src/app/page.tsx`) holds the whole declaration: one Formik instance for steps 1, 2 and 4, invoices in local state for step 3, and the stepper. Formik validates against the schema of the step on screen (`validationSchema` reads a ref set from the current step). Next validates only that step's fields (`validateFields` in `src/utils/form.ts`).

Steps (components in `src/components/declaration/`):

1. `generalInformationStep.tsx`: declaration header, parties (exporter/importer/notify party/cargo handler/agent lookups, Add Overseas Customer and Personal Customer popups), required documents.
2. `shippingDetailsStep.tsx`: carrier, scheduled date (DD-MM-YYYY), MAWB/BOL (11 digits for air), port lookups (discharge must be in the UAE), weights with units (gross >= net), cargo type, importer summary.
3. `invoiceDetailsStep.tsx`: invoice table, `invoiceForm.tsx` (Save / Save & Add Line Item), `lineItemModal.tsx` (HS code lookup), and a pipe-delimited `.txt` upload parsed by `parseInvoiceUpload`. Every invoice needs line items that add up to its value.
4. `paymentDetailsStep.tsx`: duty (HS-code rate on each item's share of the invoice CIF, in AED), fixed fees, payment mode/reference, undertaking checkbox.

Then `submissionResult.tsx` shows a generated declaration number.

## Where things live

- `src/constants/declarationData.ts`: all reference data (dropdown options, parties, carriers, ports, HS codes, currencies with AED rates, fees, regex patterns, upload sample). Add listings here, not in components.
- `src/app/validations/declarationValidation.ts`: Yup schemas per step and per popup form.
- `src/utils/declaration.ts`: lookups (`findParty`, `findPort`, ...), date helpers, CIF/duty maths, upload parser.
- `src/components/ui/`: portal-styled controls (`FieldRow`, `FormInput`, `FormSelect`, `UnitSelect`, `DateInput`, `LookupInput`, `Modal`, `SearchModal`, `SectionCard`, `PortalButton`). `Modal` portals to `document.body` and keeps a stack, so nested popups (HS search inside line items) close one at a time.
- `src/components/declaration/lookups/`: the search popups built on `SearchModal`.
- Types: `src/types/declaration.ts` (domain) and `src/types/ui.ts` (component props).
- Colours are `@theme` tokens in `src/app/globals.css` (`portal-navy`, `portal-red`, `portal-orange`, `portal-ink`, `portal-line`, `portal-label`, `portal-page`).

Keep fields automation-friendly: every control has an `id` equal to its Formik name and a `<label htmlFor>`, popups use `role="dialog"`, and search result buttons are labelled `Select <code>`.

## Commands

- `npm run dev`: dev server (from the repo root the preview config runs it on port 3005)
- `npm run typecheck` / `npm run lint` / `npm run prettier:check` / `npm run build`: run all four before finishing a change

## Skills

`.claude/skills/frontend-ui-pages-forms` still applies (Formik + Yup, Tailwind v4, path aliases, Prettier). The api-layer, redux and new-feature skills describe the expense app this was copied from; there is no BFF, redux store or auth here.
