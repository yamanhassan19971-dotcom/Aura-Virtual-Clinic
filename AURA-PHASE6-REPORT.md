# AURA Dental PMS — Phase 6 Report

Scope: make the existing system usable on a phone and an iPad in portrait, without changing how it looks or works on the clinic computer or an iPad in landscape. No data or permission changes.

## 1. What changed

- **App shell.** Below Tailwind's `lg` breakpoint (1024px: phones and iPad portrait) the sidebar becomes a drawer opened from a ☰ button in the top bar; it closes on navigation, Escape or a tap outside. The top bar is shorter and drops the role label and the sign-out text on phones. The page respects the iPhone notch and home bar (`viewport-fit=cover` + safe-area padding) and uses `100dvh`.
- **Modals** rise from the bottom edge at full width on phones, with a sticky title bar.
- **Form fields are 16px on phones**, so iPhone Safari no longer zooms in when a field is focused.
- **Diary.** Compact toolbar; the status counts become one swipeable row; the time axis stays pinned while swiping between doctors. Below `lg` an appointment opens as a bottom sheet (phone) or a side sheet (iPad portrait) instead of the hidden side panel. On touch screens moving an appointment needs a short press-and-hold (250ms), so a normal swipe scrolls instead of dragging a card.
- **Patient file.** The header keeps "Book appointment" and folds the other actions into a "More" menu on phones; the tabs are one swipeable row that keeps the current tab in view.
- **Dental chart.** Both arches scroll together on a phone and open centred on the midline; teeth are 40px below `lg` so all 32 fit an iPad in portrait without scrolling.
- **Lists.** Patients and the clinic-wide treatment plans become card lists on phones; settings tables scroll sideways inside their card.
- **Enquiries.** Below `lg` the four stages are a swipeable row (one per screen on a phone, two on iPad portrait) with stage chips to jump; on an enquiry page the actions and ready messages come before the handoff card.
- Page padding is 16px on phones (24px from `md`).

Phone-only UI that duplicates desktop UI (the diary sheet, the "More" menu, the patient card list, the stage chips) is mounted with `useMediaQuery` rather than hidden with CSS, so each control exists once on the page.

## 2. Tests

- Unit: 94, all passing (no logic changed).
- E2E: new Scenario 24 runs at 390×844 with touch (drawer, appointment sheet, patient "More" menu, no sideways page scroll). The full suite of the existing 29 passed except Scenario 16, which failed once and passed on rerun (the timing flake noted since Phase 2). After the last chart change, Scenarios 17-24 were rerun: 14/14 passed.

## 3. Open items

- Real-device check on the owner's iPhone and iPad once the system runs on the clinic laptop.
- 40px teeth on iPad portrait are slightly under Apple's 44px touch guideline; enlarge if the doctors find them fiddly.
