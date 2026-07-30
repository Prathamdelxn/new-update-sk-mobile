# Sky-Lite: Final Pending Features Roadmap

## Audit basis

This roadmap reconciles four sources:

1. `Construction_Feature_Tracker.xlsx`
2. `Full Workflow from Vidyanand sir.docx`
3. `Sky-Lite_Final_Comparative_Analysis_and_Roadmap.md`
4. Modules 01–16 in `docs/lite/modules`

The master workflow establishes the central financial chain:

```text
BOQ / PO → Measurement → Work verification → Bill → Approval → Payment → Reconciliation
```

Sky-Lite already has a documented foundation for onboarding, RBAC, templates, projects, surveys, drawings, BOQ, budgets, schedules, DPR, materials, ledger, risk, snags, handover, and warranty support. The main gap is that physical progress, commercial evidence, approvals, and money do not yet form one controlled workflow.

## Status legend

| Status | Meaning |
| --- | --- |
| New | A net-new module or platform capability. |
| Upgrade | A current module provides a useful base, but the required workflow is absent. |
| Partial | The feature exists in a limited form but needs material enhancement. |
| Product decision | Requires an explicit business/architecture decision before development. |

## Priority 0 — financial control chain

These must be designed as one connected release. Building any one in isolation will recreate the current disconnect between progress and finance.

| ID | Pending feature | Status | Why it is required | Builds on |
| --- | --- | --- | --- | --- |
| FIN-01 | Digital Measurement Book (MB) | New | Capture measured quantities, drawings/photos, engineer verification, client signature, and measurement certificates. | BOQ, DPR, drawings, rooms |
| FIN-02 | BOQ/DPR/MB-to-value engine | Upgrade | Convert approved physical quantity or percentage into payable/billable value per BOQ line. Support quantity, percentage, and factory-stage progress methods. | BOQ, schedule, DPR, MB |
| FIN-03 | Running Account (RA) billing | New | Generate progressive bills from approved measurements; track current, cumulative, retention, deductions, tax, certified, paid, and balance. | FIN-01, FIN-02, PO/work orders |
| FIN-04 | Payment request checkpoint | New | Stop direct ledger payment logging. A request must show invoice, PO/work order, GRN/receipt, MB/progress evidence, and open snags before approval. | Ledger, material receipts, FIN-01–03 |
| FIN-05 | PO/work-order and vendor invoice reconciliation | New | Reconcile ordered, received, invoiced, approved, paid, and outstanding values at item level. | Vendor/procurement, materials, ledger |
| FIN-06 | Multi-level approval engine | New | Configurable L1/L2/L3 approval chains, remarks, delegation, audit trail, notifications, and escalation. Reuse it for payment, RA bill, PO, BOQ, budget, and material requests. | RBAC, notifications |
| FIN-07 | Cashflow and payment-aging reporting | Upgrade | Forecast inflow/outflow against plan, compare actuals, identify overdue receivables/payables, and expose pending liabilities. | FIN-03–05, budget, ledger |

## Priority 1 — vendor, subcontractor, and execution control

| ID | Pending feature | Status | Required scope | Builds on |
| --- | --- | --- | --- | --- |
| VEN-01 | Vendor and subcontractor directory | New | Onboarding, contacts, trade/category, documents, bank/tax details, compliance status, performance score, and project assignment. | RBAC, projects |
| VEN-02 | Purchase orders and work orders | Upgrade | Link vendor, BOQ items, agreed rates, scope, dates, terms, budget checks, attachments, and approval chain. Module 11 currently documents purchase/receipt records but not a complete vendor commercial workflow. | BOQ, materials, budget, VEN-01 |
| VEN-03 | Vendor billing and GRN reconciliation | New | Vendor bill submission, delivery/GRN validation, invoice matching, discrepancy/dispute status, and payment-request creation. | VEN-02, material receipts, FIN-04 |
| VEN-04 | Vendor/subcontractor performance | New | Quality, delay, cost variance, safety/compliance, issue resolution, and scorecard reporting. | Snags, schedule, VEN-01–03 |
| EXE-01 | Labour/manpower tracking | Upgrade | Daily workforce categories/counts, allocation to task/project, attendance, productivity, payroll/export-ready totals, and manpower S-curve. DPR has worker-count foundations but not this workforce workflow. | Attendance, DPR, schedule |
| EXE-02 | Equipment management (Module 17) | New | Owned/hired equipment, allocation, hours, fuel, maintenance, operator certification, transfer, downtime, insurance/agreement expiry, and billing disputes. | Projects, ledger, risk, geofencing |
| EXE-03 | Advanced Gantt dependencies and resource planning | Upgrade | Finish-to-start dependencies, critical path, baselines, slippage history, labour/equipment assignment, and capacity conflicts. | Schedule, EXE-01, EXE-02 |
| EXE-04 | Pre-execution readiness checklist | New | Automate design, BOQ, budget, vendor, permits, site-readiness, resource, and safety gates before work starts. | Project, survey, BOQ, schedule |

## Priority 2 — approvals, collaboration, and operational visibility

| ID | Pending feature | Status | Required scope | Builds on |
| --- | --- | --- | --- | --- |
| COL-01 | Unified cross-project inbox | New | One personal queue for approvals, comments, tasks, risks, payments, snags, reminders, and snooze/escalation. | Notifications, FIN-06 |
| COL-02 | Role-based notification rules | Upgrade | Event subscriptions, priority, push/email/in-app channels, digests, escalation, and preferences. Current notification/push support is event-specific. | Notifications, COL-01 |
| COL-03 | Cross-module comments and tasks | New | Comment/thread/attachment/task objects usable on BOQ, DPR, PO, payment, MB, risk, snag, and handover objects. | COL-01 |
| COL-04 | No-code workflow and custom-field configuration | New | Organization admin configures approval chains, terminology, custom fields, mandatory evidence, and statuses without code changes. | FIN-06, RBAC |
| COL-05 | Controlled external-organization collaboration | Product decision | Per-project external sharing grants for consultants/architects/vendors without breaking tenant isolation. | RBAC, project assignment |
| OPS-01 | Unified management dashboard | Upgrade | Cross-project tasks, approvals, cash exposure, schedule delay, risk, quality, and resource alerts. Existing dashboards are module/project oriented. | COL-01, FIN-07, EXE-03 |
| OPS-02 | Financial audit controls | Upgrade | Immutable approval/payment history, actor/time/evidence, export, segregation-of-duty rules, and exception reports. | FIN-04, FIN-06, ledger |

## Priority 3 — design and interior workflow

| ID | Pending feature | Status | Required scope | Builds on |
| --- | --- | --- | --- | --- |
| DES-01 | Mood boards and finish selection | New | Room-wise visual boards, swatches/options, client selection, versioning, sign-off, and evidence trail. | Rooms, documents, approvals |
| DES-02 | Client-facing design approval | Partial | Module 06 supports technical drawing review; extend it for client-facing design packages, choices, comments, formal approval/rejection, and revision history. | Drawings, DES-01, FIN-06 |
| DES-03 | Design-to-BOQ linkage | New | Link design/finish selections to BOQ items, quantities, rate assumptions, and revisions. | DES-01/02, BOQ |
| DES-04 | Assisted BOQ generation and value engineering | New | Generate a draft BOQ from approved design data, compare alternatives, and record approved cost-saving substitutions. Human review must remain mandatory. | DES-03, BOQ, budget |
| INT-01 | Furniture/OEM production stages | Upgrade | Expand FFE beyond planned/ordered/delivered/installed to cutting, assembly, finishing, quality check, dispatch, and delivery. | FFE/warranty, VEN-02 |
| INT-02 | Room readiness dashboard | New | Roll up room completion from installed BOQ value, FFE status, open snags, and task progress. | FIN-02, snags, FFE |
| INT-03 | Room-wise/phased handover | Upgrade | Partial handover certificate and readiness gate for rooms/areas while the overall project remains active. | Handover, INT-02 |
| INT-04 | As-built measurement re-verification | New | Gate custom/built-in furniture orders on verified final dimensions versus the design/survey dimensions. | Survey, DES-03, VEN-02 |

## Priority 4 — handover, certification, and post-handover

| ID | Pending feature | Status | Required scope | Builds on |
| --- | --- | --- | --- | --- |
| HND-01 | Test certificate and compliance register | New | Templates, certificate upload, expiry, review, status, and links to BOQ item/asset/room for electrical, fire, continuity, and other tests. | Documents, BOQ, handover |
| HND-02 | Asset-linked documentation | Upgrade | Tag warranties, manuals, certificates, invoices, and photos to an asset/FFE item rather than only to a project. | FFE/warranty, HND-01 |
| HND-03 | Warranty expiry alerts and lifecycle | Partial | Module 16 documents warranty claims/support. Add expiry reminders, service schedule, vendor/SLA linkage, and asset history. | FFE/warranty, notifications |
| HND-04 | AMC and service-ticket system | Upgrade | Annual maintenance contracts, recurring visits, service tickets, technician allocation, SLA, cost, and closure verification. | Warranty, VEN-01, ledger |
| HND-05 | Structured handover package | Upgrade | System/room/asset checklist, required documents, test certificates, warranty transfer, client acceptance, and archive package. | Handover, HND-01–04 |

## Priority 5 — intelligence and reporting

| ID | Pending feature | Status | Required scope | Builds on |
| --- | --- | --- | --- | --- |
| INTEL-01 | Cost-versus-actual variance | Upgrade | Compare BOQ/budget/PO/committed cost/actual cost/billed value/payment across project and BOQ item. | FIN-02–07, budget, ledger |
| INTEL-02 | Delay prediction and early-warning alerts | New | Detect schedule slippage from dependencies, DPR, resource shortfall, risk, and procurement status; alert with explainable reasons. | EXE-01–03, DPR, risk |
| INTEL-03 | Project profitability | Upgrade | Forecast and actual margin including vendor cost, labour, equipment, warranty/AMC cost, and receivables. | FIN-07, EXE-01/02, HND-04 |
| INTEL-04 | Auto-distributed DPR/reporting | Upgrade | Generate a verified daily/weekly report with progress, manpower, materials, photos, exceptions, and subscriber delivery. | DPR, EXE-01, COL-02 |

## Recommended release sequence

1. **Platform workflow foundation:** COL-01, FIN-06, COL-02, OPS-02.
2. **Commercial control v1:** VEN-01/02, FIN-04, VEN-03, FIN-05.
3. **Measurement and progressive billing:** FIN-01, FIN-02, FIN-03, FIN-07.
4. **Execution resources:** EXE-01, EXE-02, EXE-03, EXE-04.
5. **Interior and design differentiation:** DES-01–04, INT-01–04.
6. **Handover lifecycle:** HND-01–05.
7. **Intelligence:** INTEL-01–04, after reliable commercial and operational data exists.

## Items from the original tracker that are not entirely missing

| Original tracker item | Reconciled result |
| --- | --- |
| Warranty tracking | Module 16 documents warranty claims, support work orders, repair costs, and FFE. Treat it as **partial**: add expiry alerts, asset document linkage, and AMC. |
| Test certificates | Not represented as a structured certificate/compliance workflow; remains **new**. |
| Client approval workflow | Technical drawing approval exists in Module 06; client-facing visual design/finish approval remains **partial/pending**. |
| BOQ revisions | Module 07 documents scope revision/history. Keep revision tracking as an existing baseline; build design-to-BOQ linkage and assisted generation separately. |
| Labour tracking | DPR documents a worker-count base. Dedicated allocation, productivity, payroll, and reporting remain **pending**. |
| PO / material receipt records | Modules 11 and 12 document material purchases, receipts, vendor names, invoices, and ledger links. Full vendor commercial lifecycle, work orders, approval, GRN matching, and payment control remain **pending**. |

## What not to build before the financial chain

Do not prioritize AI agents, AR/3D walkthroughs, a broad CRM pipeline, or live FX conversion before FIN-01 through FIN-07 are operating. They need clean measurement, commercial, approval, and actual-cost data to become useful.
