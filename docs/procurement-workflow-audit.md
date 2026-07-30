# Procurement Workflow Audit — Sky-Lite

Date: 2026-07-15

## Purpose
This document compares the attached "Material Procurement Workflow" image with the current Sky-Lite mobile app codebase and highlights pending items, gaps, and recommended next steps.

## Quick Summary
- The mobile app implements a near-complete materials workflow: requests, approvals, purchases (PO-like records), receipts, stock updates, and consumption logs.
- The frontend expects backend endpoints under `EXPO_PUBLIC_API_BASE_URL` (environment). The API server is not present in this workspace.

## Mapping (Image → Implementation)

- Site Engineer Raises Material Request
  - Implemented: Material request creation UI and bulk request modal. See [app/project/[id]/material.jsx](app/project/[id]/material.jsx#L280-L340).

- Office Team Receives Requests
  - Implemented: Requests listing and detail UI with admin action controls.

- Review / Approve / Reject
  - Implemented: Approve/Reject transitions for requests, receipts and purchases (status PATCH calls).

- Generate Purchase Order
  - Implemented: Purchase records with PO number field, unit prices, totals and PDF invoice generation + Cloudinary upload.

- Supplier Receives PO
  - Partially implemented: purchase records store vendor/PO details, but no automated PO distribution (email/SMS/vendor portal).

- Supplier Delivers / Material Received (GRN)
  - Implemented: Material receipts with challan/invoice fields and verification workflow.

- Material Consumption & Tracking
  - Implemented: Usage logs, inventory balance, and history view.

## Observed Frontend API Endpoints
- `/projects/:projectId/material-requests`
- `/projects/:projectId/material-receipts`
- `/projects/:projectId/material-usage`
- `/projects/:projectId/material-purchase`
- `/projects/:projectId/materials` and global `/materials`

These are referenced in the frontend: see [app/project/[id]/material.jsx](app/project/[id]/material.jsx#L300-L480) and `.env`.

## Gaps & Pending Items

- Backend verification: server-side routes, validation, duplicate-checks, and role enforcement are unknown (backend not in workspace).
- Supplier/Vendor management screen and CRUD: localized strings exist, but UI and endpoints for vendor directory were not found.
- PO distribution/notifications: no built-in email/SMS or vendor portal for sending POs.
- Granular approval rules: budget checks, multi-level approvals, or partial fulfillment flows are not present in the frontend.
- Docs comparison: the external MD files at `C:\Users\Dell\Desktop\docs\lite\modules` were not reviewed — they must be added to the workspace.

## Pending Checklist (what I can do next)

1. Inspect backend repo `c:\2026\v2\sky-lite-api` (if you add it) to verify routes, controllers and DB models.
2. Import the docs folder `C:\Users\Dell\Desktop\docs\lite\modules` into the workspace and compare specification vs implementation.
3. Add vendor management UI and backend endpoints (if desired).
4. Add PO distribution (email/SMS) or vendor portal workflow.
5. Add server-side validation and stricter approval policies if required.

## Recommended Immediate Actions for You

1. Copy or add the backend repo `c:\2026\v2\sky-lite-api` into the workspace so I can audit APIs.
2. Copy the docs folder `C:\Users\Dell\Desktop\docs\lite\modules` into `docs/lite/modules` in this workspace (or upload it).
3. Tell me which of the gaps you want prioritized (vendor CRUD, PO distribution, multi-level approvals).

---
File created: `docs/procurement-workflow-audit.md`
