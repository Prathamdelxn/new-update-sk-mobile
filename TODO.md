# CRM Modules Implementation Task List

- `[x]` **Phase 1: BOQ Builder**
  - `[x]` Create `BoqBuilderModal.jsx` in `app/components/crm`
  - `[x]` Add "Create BOQ" / "Edit" triggers in `app/crm-lead/[id].jsx`
  - `[x]` Test BOQ creation and backend sync
- `[x]` **Phase 2: Site Survey & Measurements**
  - `[x]` Create `LogSiteVisitModal.jsx` with detailed measurement fields
  - `[x]` Add trigger in `app/crm-lead/[id].jsx` (Site tab)
  - `[x]` Test Site Visit data logging
- `[x]` **Phase 3: Requirement Gathering**
  - `[x]` Create `LogRequirementsModal.jsx` with room-by-room functional/aesthetic fields
  - `[x]` Add trigger in `app/crm-lead/[id].jsx` (Requirements tab)
  - `[x]` Test Requirement data logging
- `[x]` **Phase 4: Designs & Drawings**
  - `[x]` Create `UploadDesignModal.jsx` with categorization tags
  - `[x]` Add trigger in `app/crm-lead/[id].jsx` (Designs tab)
  - `[x]` Test Design file logging
- `[x]` **Phase 5: Lost Leads Workflow**
  - `[x]` Analyze Web implementation for backend alignment
  - `[x]` Create `MarkLostModal.jsx` with reason capture
  - `[x]` Add "Mark Lost" trigger to the top header in `[id].jsx`

## Upcoming Features / Future Roadmap
- `[ ]` **Web CRM Parity: Strict Stage Validation**
  - `[ ]` Implement Frontend UI Tab Locking on Web (`InteriorLeadDetails.tsx`) to prevent stage-skipping (New -> Site Visit -> Requirements -> Drawing -> BOQ).
  - `[ ]` Add Backend API validation to reject non-sequential status updates.
