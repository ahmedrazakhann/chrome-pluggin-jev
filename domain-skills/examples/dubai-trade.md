---
schema: twenty-domain-skill/v1
name: dubai-trade-declaration
description: Fill the visible Dubai Trade customs declaration header without progressing or submitting the workflow.
version: "3"
status: draft
last_verified: "2026-09-23"
domains:
  - eservices.dubaitrade.ae
  - mirsal2new.dubaitrade.ae
frame_policy:
  strategy: exact
  allow_all_frames: false
  expected_matches: 1
  targets:
    - origin: https://mirsal2new.dubaitrade.ae
      path_prefix: /m2decext/declaration/
      label: declaration-form
  on_mismatch: needs_review
party_lookup:
  enabled: true
---

# Dubai Trade customs declaration

## Scope

Fill only the visible declaration-header fields on the current General
Information step. Importer and Exporter search-and-select are allowed as
defined below. Do not advance, save, submit, authenticate, pay, or upload a
file.

Use deterministic frame selection, field reads, writes, and verification first.
Use Jev only to choose between supplied record values and fields or options
actually observed on the page. Use Jev only when the deterministic route
reports an unsupported control or failed interaction, and preserve every stop
condition in this file.

## Confirm the page

Proceed only when all of the following are true:

- The selected document origin is `https://mirsal2new.dubaitrade.ae`.
- Its path starts with `/m2decext/declaration/`.
- The document title is `Customs Declaration`.
- Exactly one selected frame contains the declaration form.
- The visible workflow is the General Information step.

The parent portal may use `https://eservices.dubaitrade.ae`. Never broaden the
scan to every frame when the declaration frame is missing or duplicated.

## Input contract

Values such as `[Please Select]`, `[Select Declaration Type]`, an empty string,
`null`, `unknown`, or a symbolic file value such as `pdf` mean "not supplied".
Do not select or type them.

Prefer these record paths:

| Record path | Expected value |
| --- | --- |
| `declaration_category` | An intended regime such as `Import` |
| `declaration_type` | A real observed Declaration Type option label or value |
| `reference_no` | A non-empty client declaration reference |
| `exporter_code` | An actual Dubai Trade exporter code, not a company name |
| `importer_code` | An actual Dubai Trade importer code, not a company name |
| `notify_party_code` | An actual party code |
| `cargo_handler_code` | An actual cargo-handler code |
| `agent_code` | An actual agent code |
| `trade_type` | `E-Commerce` or `Non E-Commerce` when applicable |
| `importing_cw_fz_code` | An actual importing CW/FZ code |
| `exporting_cw_fz_code` | An actual exporting CW/FZ code |
| `invoice.available` | Boolean or explicit observed availability option |
| `invoice.number` | Invoice number revealed by the chosen workflow |
| `awb_bol.available` | Boolean or explicit observed availability option |
| `awb_bol.number` | AWB/BOL number revealed by the chosen workflow |
| `documents.packing_list_available` | Boolean or explicit observed availability option |
| `documents.certificate_of_origin_available` | Boolean or explicit observed availability option |

`importer` and `exporter` may be a company name or an object with `name` and
optional `code`. These values are lookup queries, never direct Code-field text.
Other legacy paths such as `notify_party`, `cargo_handler`, and `agent` remain
ambiguous and must not be copied into Code fields.

## Observed field map

The `name` attributes below are stronger identifiers than surrounding layout or
generated field IDs. Always confirm the visible label and current control state.

| Record path | Visible field | Observed `name` | Control |
| --- | --- | --- | --- |
| `declaration_category` | Regime Type | `value(regimeTypeId)` | native select |
| `declaration_type` | Declaration Type | `value(decTypeId)` | native select |
| `reference_no` | Client's Dec. Ref. No. | `value(clientDeclartionRefNo)` | text |
| `exporter_code` | Exporter's Code | `value(exporterCode)` | text plus lookup |
| `importer_code` | Importer's Code | `value(importerCode)` | text plus lookup |
| `notify_party_code` | Notify Party Code | `value(notifyPartyCode)` | text plus lookup |
| `cargo_handler_code` | Cargo Handler's Code | `value(cargoHandlerCode)` | text plus lookup |
| `agent_code` | Agent's Code | `value(agentCode)` | text plus lookup |
| `trade_type` | Trade Type | `value(tradeTypeId)` | native select |
| `importing_cw_fz_code` | Importing CW/FZ | `value(importerCwfzCode)` | text plus lookup |
| `exporting_cw_fz_code` | Exporting CW/FZ | `value(exporterCwfzCode)` | text plus lookup |
| `invoice.available` | Invoice availability | `value(invoiceAvailabilityId)` | native select |
| `awb_bol.available` | AWB/BOL availability | `value(awbAvailabilityId)` | native select |
| `documents.packing_list_available` | Packing List availability | `value(packingListAvailabilityId)` | native select |
| `documents.certificate_of_origin_available` | Certificate of Origin availability | `value(certificateAvailabilityId)` | native select |

Invoice-number and AWB/BOL-number inputs were not present in the initial live
snapshot. Address them only after they appear in a fresh scan. Never invent a
selector from this document.

## Placeholder semantics

Dubai Trade native selects can use the underlying value `0` for an unselected
placeholder. Treat the control as empty when the selected option label is
bracketed or clearly says Select or Please Select, even when `select.value` is
non-empty. Preserve a real selected option.

Observed Regime Type options included Import, Export, Transit, Temporary
Admission, and Transfer. Declaration Type options depend on Regime Type. Always
use the current observed option list rather than relying on a copied catalog.

## Staged workflow

1. Scan the exact declaration frame and classify placeholder selects as empty.
2. Preserve every real occupied value. Never overwrite Customs Broker or any
   prefilled code.
3. Map and fill only supplied prerequisite selects: Regime Type, Declaration
   Type, and Trade Type. Select only a currently observed option.
4. Wait for the page to settle, then rescan the same frame. Dynamic fields and
   option lists may change after each prerequisite selection.
5. Fill directly addressable, visible, empty text fields with exact supplied
   values.
6. For each document-availability control, require an explicit availability
   value. A filename, extension, or word such as `pdf` is not availability.
7. Rescan after every write that changes the page. Fill invoice or AWB/BOL
   details only if their inputs subsequently appear and match supplied data.
8. Run only the importer/exporter lookup described below. Stop before any other
   lookup, file chooser, navigation, save, or submission action.

## Lookup controls

For Import, use only the empty Importer's Code field and its adjacent Search
button. For Export, use only the empty Exporter's Code field and its adjacent
Search button. Confirm Regime Type agrees with the supplied
`declaration_category`. Do not infer Import/Export from a party name alone.

Open the portal lookup iframe, enter the supplied party name in its Name search
field, and use Search. Read the result rows' actual Code, Name, Business Type,
and Facility. Select an exact code/name match first. Jev may choose only among
observed rows and may decline. Require high confidence; stop if ambiguous or
absent. Click only the selected row's Select button, then verify its code
appears in the original Code field. Never create a new party.

Other party and CW/FZ lookup controls remain unsupported:

- Preserve occupied lookup-backed fields.
- Do not click their search icons or Add Overseas Customer.
- Do not type names into code fields.
- Return `needs_review` for a requested code that cannot be validated by an
  ordinary retained-value write.

## Verification

After each permitted write:

- Confirm the frame `documentId` has not changed unexpectedly.
- Rescan the same selected frame.
- Confirm text values remain after settling.
- Confirm native selects retain the intended non-placeholder option.
- Confirm no validation error or unexpected page transition appeared.

Report which fields were filled, preserved, skipped, or stopped for review.

## Stop conditions

Return `needs_review` without broadening permissions when:

- The exact declaration frame count is not one.
- Page identity cannot be confirmed.
- A required value is missing or is only a placeholder.
- A company name is supplied for an unsupported Code field.
- A requested option is not present in the freshly observed option list.
- An unsupported lookup, modal, upload, Next, Save, Submit, payment, login, or
  authentication action would be required.
- A field disappears, becomes disabled, is rejected, or resets after writing.
- The page advances or the frame document changes unexpectedly.
