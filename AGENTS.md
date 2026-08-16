# Heritage Family Artifacts - Project Rules

## Core Principles
- **Polished & Professional**: Every UI element must reflect a high-end, bespoke heritage service.
- **Intentional Design**: Use serif typography (Cormorant Garamond) for headings and body, with gold accents (#c5a059) on dark earth backgrounds (#1a110a).

## Navigation & View Logic
- **Single-Page-at-a-Time**: The application must only show one main view at a time (Introduction, Process, Library, Commission, Questionnaire).
- **Navigation Sync**: The top navigation bar must accurately reflect and control the active view.
- **Modal Placement**: All global modals (Artifact Preview, Enquiry Modal) must be placed at the top level of the `App` component to ensure visibility across all views.

## Component Specifics
- **Artifact Library**: Artifact cards must be interactive `<div>` elements (not nested buttons) to avoid hydration errors.
- **Enquiry System**: The "Enquire" button must be available in both the Library view and the Process view glimpses. It triggers a global modal that sends details to tomknsn@gmail.com.
- **Questionnaire**: Labels must be descriptive (e.g., "Paternal Grandfather") and avoid cryptic abbreviations.

## Printing
- **View-Specific Printing**: Print styles must ensure only the currently active view is printed, with clean page breaks and no "leaking" of hidden sections.
