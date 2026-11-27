# Browser Agent Extension: What's New

## What the extension is for

The extension is an assistant that works inside your Chrome browser. You tell it what you want in plain language, and it carries out the task on the website for you, step by step, the way a person would. Its main use is **filling in long online forms** (registrations, declarations, applications) from your own details, without retyping the same information on every site. It can also research a question on Google and bring back a sourced answer.

This document compares the first delivery with the current version. It covers what the extension could not handle before and what it does now.

---

## At a glance

| | First version | Current version |
|---|---|---|
| Understands plain-language instructions | Yes | Yes |
| Fills forms from your data | Yes, but you had to paste data into each task | Yes. Your details are saved once and reused |
| Multi-step forms (Step 1, Step 2, Next…) | Limited | Works through every step to the end |
| Fields that need you to search and pick from a list | Often got stuck | Finds the right entry and selects it |
| Date, time and slider fields | Could not be filled | Filled correctly |
| Recovers when something goes wrong | Usually stopped | Tries another approach before giving up |
| Submits forms | Not controlled | Only if you switch submission on (off by default) |
| Check that your data fits a website | No | Yes, a match score from 0 to 100% |
| Ready-made sample data per website | No | Yes, managed from an admin page |
| Maximum length of a job | 60 steps | 180 steps (long forms are no longer cut short) |
| Visibility into what the agent did | Basic | Detailed activity record for support |

---

## What was not handled before, and how it is handled now

### 1. Your data had to be supplied again and again
**Before:** You had to include your details in every task you typed.
**Now:** The side panel has a **My details** section. Paste or upload your details once. They are saved automatically and used every time you run the agent. If something is wrong with them, such as invalid format or too much data, the panel tells you straight away.

### 2. No way to know whether your data suits a website
**Before:** You only found out after the agent had tried and failed.
**Now:** The extension gives a **match score (0 to 100%)** showing how well your details fit the form on the current website. The bar is green for a good fit, amber for partial and red for a poor fit, so you can fix gaps before you start. The comparison looks at what the fields mean, not just how they are spelled. For example, "First name" and "Given name" count as the same field.

### 3. Sample data per website was not available
**Before:** There was no shared reference for what a given site's form expects.
**Now:** A **Settings** tab lists the sample data stored for each website. You can view it in a readable window or download it. It is the reference the match score uses.

### 4. No easy way for the team to manage forms
**Before:** Nothing equivalent.
**Now:** A new **admin page ("Form Sample Registry")** lets an administrator add, edit and organise sample forms (name, description, website and data). A **"Push to extension"** button sends a record straight into a user's extension, ready to use. Oversized or empty data is rejected automatically.

### 5. Long, multi-step forms
**Before:** The agent could lose its place or stop part-way through a wizard-style form.
**Now:** It works through each step in order, completes each section or sub-form with that section's own Save button, and only then moves on with Next. It does not stop merely because the fields on a step are already filled. It moves to the next step. Options such as "Same as Exporter" are switched on once and not toggled back by accident.

### 6. Fields where you must search and choose (ports, importers, codes, etc.)
**Before:** If a field wanted a code but you had only given a name, the agent frequently got stuck.
**Now:** It opens that field's search window, searches using the key words from your instructions, and selects the right result. It knows which field the search window belongs to, even when one window serves several fields (for example, several ports). It stays on the main path and does not wander into "Add new…" options unless you ask for them. If it has no value for a field, it skips that field and continues instead of failing the whole job.

### 7. Date, time and slider fields
**Before:** These could not be typed into, so such forms could not be completed.
**Now:** They are filled correctly, in the format the field expects. If a value is not accepted, the agent is told what format was expected.

### 8. Giving up too early
**Before:** One failed attempt could end the job.
**Now:** The agent is persistent. If an action is refused or has no effect, it tries a different route: scroll to the control, wait and look again, use another button, or take another path to the same result. If it believes it is finished but the page continues below, it scrolls down and checks again before stopping. It also retries automatically when the underlying AI service has a short-lived error.

### 9. Accidental submission
**Before:** No clear safeguard.
**Now:** An **"Allow agent to submit"** switch in the side panel is **off by default**. The agent fills the form but will not submit it unless you turn this on. When it is on, the agent confirms that the submission succeeded before finishing.

### 10. Pages that are hard to read
**Before:** Pop-ups and overlays could confuse the agent. Chrome's saved-entry suggestions could paste old values into fields.
**Now:** When a pop-up is open, the agent focuses on that pop-up only. Pop-ups that are still fading in are no longer mistaken for hidden. Chrome's saved-entry suggestions are switched off for the fields the agent fills. Off-screen buttons are scrolled into view before use.

### 11. Connection status
**Before:** The connection could look out of date.
**Now:** The popup and side panel update immediately when the extension connects or disconnects. A deliberate disconnect is respected even if Chrome restarts the extension in the background.

### 12. Long jobs
**Before:** Jobs were capped at 60 steps, which was too short for large forms.
**Now:** Up to **180 steps**.

### 13. Clearer reporting when something goes wrong
**Before:** A stopped job gave little explanation.
**Now:** Each run records what was tried, what it chose, how long each part took, and why it stopped. This makes problems much quicker to diagnose and fix.

---

## Operational improvements

- **Packaged for deployment.** The service now runs as a ready-to-deploy package, so setup is repeatable on any server.
- **Automated releases.** When approved changes are published, the new version is built and deployed to the server automatically, with sensitive information kept out of the deployment logs.
- **Independent service.** It no longer depends on the larger system it was originally built within.

## Testing tools included

- A **practice customs-declaration website** (4 steps, search windows, invoice lines, validation). It is a safe place to test the agent without touching a real site.
- Ready-made **sample data files** for testing, including a "Dubai Trade Detail Form" example.

---

## What has stayed the same

Secure pairing between the extension and the service, plain-language task running, Google research with sources, and the existing form-filling engine all work as before.

## Points for discussion

- The admin page currently works from a local address. A production address will need to be agreed and configured.
- The match score depends on sample data being stored for the exact website address.
- Automated checks have not been extended yet, so the practice site is currently the main way to test the new behaviour.
