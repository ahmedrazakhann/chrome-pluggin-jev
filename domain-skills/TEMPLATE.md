---
schema: twenty-domain-skill/v1
name: replace-with-domain-skill-name
description: Replace with when this website-specific guidance applies.
version: "1"
domains:
  - portal.example.com
frame_policy:
  strategy: top
  allow_all_frames: false
  expected_matches: 1
  targets:
    - origin: https://portal.example.com
      label: main-page
  on_mismatch: needs_review
---

# Website workflow

## Page identity

- Describe the page title, heading, or other stable evidence that confirms the
  expected workflow is open.
- Stop with `needs_review` when the expected page cannot be confirmed.

## Frame guidance

- Use only the frames selected by `frame_policy.targets`.
- `strategy: top` means scan only the top document.
- `strategy: exact` means scan only frames matching a declared target rule.
- Keep `allow_all_frames: false` unless this website genuinely requires scanning
  an unknown set of frames.
- Treat zero matches or a count different from `expected_matches` as a changed
  website. Do not broaden the scan automatically.

## Record-to-field guidance

Document only mappings that are specific to this website. Jev should choose
among observed fields or options when labels differ; it must not invent values.

| Record path | Website field | Control | Guidance |
| --- | --- | --- | --- |
| `example_path` | Example label | text/select/custom | Domain-specific rule |

## Interaction guidance

- Describe permitted lookup, dropdown, modal, or multi-step interactions.
- Name the observable result that verifies each interaction.
- Preserve occupied, disabled, read-only, hidden, and protected fields.
- Never infer permission to upload, navigate, save, submit, authenticate, or pay.

## Verification

- Rescan the same selected frame after every write.
- Verify the retained value or selected option from fresh page state.
- Stop with `needs_review` when the field disappears, the frame changes, or the
  website rejects or resets the value.

## Stop conditions

- List website-specific states that require human review.
- Never widen frame scope or continue to another workflow step after a mismatch.
