# Employee Engagement Feature Tracker

## Scope

This tracker covers the requested employee enhancements:

1. Employee photograph support in profile.
2. Assignment classification (`Client Billable`, `Bench`, `Support`).
3. Client engagement capture (client, location, manager, director, project, work notes, assignment date).
4. Performance context capture for appraisal use.
5. Auditable history of engagement transitions, including bench moves.

## Status Summary

| Task | Status | Notes |
|---|---|---|
| Add assignment classification field | Done | Added to official info model and UI flow. |
| Capture client engagement details | Done | Added in employee form and detail view engagement tab. |
| Capture engagement transition note and performance summary | Done | Transition modal enforces transition note for bench moves. |
| Record engagement history for audit | Done | `employee_engagement_history` stores previous engagement snapshots with metadata. |
| Add employee photo field and rendering | Done | `photo_url` added to personal info with form input, upload option, and avatar/photo display. |
| Persist photos to local storage with DB path URL | Done | Backend now converts image data URLs to local files and stores `/uploads/...` path. |
| Add migration utility for legacy data URL photos | Done | Added script with dry-run and apply mode to migrate old `data:image/...` records to local file paths. |
| Add dedicated multipart photo upload endpoint | Done | Implemented `POST /employees/:id/photo` to upload and store local employee photos. |
| Add automated tests for employee feature flows | Done | Added API-level test suite for local photo storage, validation, and upload endpoint flows. |
| Add backfill utility for assignment type | Done | Added script to fill missing assignment type with `Bench` for legacy records. |
| Enforce backend validation for photo and engagement payload | Done | API now validates photo format/size and required engagement fields for non-bench assignment. |
| Create implementation tracker document | Done | This document. |

## Completed Implementation Items

- Database schema updates:
  - `employee_personal_info.photo_url`
  - engagement fields on `employee_official_info`
  - `employee_engagement_history` table
- Provider updates (Postgres + SQLite):
  - Runtime schema ensure for new columns/tables
  - Create/update/select mappings for photo and engagement fields
  - Engagement transition history recording and retrieval
- Frontend updates:
  - Assignment + engagement UI and transition workflows
  - Engagement tab with history timeline
  - Photo URL and file-upload option (data URL), preview, remove action
  - Photo/avatar rendering in employee list and detail view
- API updates:
  - Server-side payload validation for assignment-specific required fields
  - Server-side photo validation (`/uploads/...` path, `http/https` URL, or data URL up to 2MB)

## Pending Follow-Up Tasks

| Task | Priority | Owner | Notes |
|---|---|---|---|
| Run photo data URL migration script in target environments | Medium | Dev + Ops | Run dry-run first, then `--apply` only where legacy `data:image/...` values exist. |
| Run assignment-type backfill script in target environments | Medium | Dev + Ops | Run dry-run first, then execute apply mode and attach before/after counts for audit trail. |
| UAT checklist and sign-off | High | Product + HR | Validate end-to-end real workflows and reporting expectations. |

## Photo Storage Decision

Decision agreed: employee photos will be stored in local filesystem storage, and DB will keep the local URL/path.

Recommended implementation details:

- Save files under a controlled server directory such as `backend/uploads/employee_photos/`.
- Store a relative path in DB (example: `/uploads/employee_photos/<employeeId>/<filename>.webp`).
- Serve files via backend static route (do not expose arbitrary filesystem paths).
- Keep size/type validation (`image/*`, max 2MB) at upload endpoint.

Note on scalability:

- This is a good approach for single-server deployments.
- For multi-server or container autoscaling, object storage (S3/MinIO/GCS) is a stronger long-term option.

## Actionable Task Backlog

| ID | Task | Status | Acceptance Criteria |
|---|---|---|---|
| EMP-101 | Add backend static file serving for uploaded photos | Done | Stored photo path is retrievable through backend URL and path traversal is blocked. |
| EMP-102 | Update employee create/update flow to persist local photo path URLs | Done | Data URL input is converted to local file and DB stores `/uploads/employee_photos/...` path. |
| EMP-103 | Update photo URL validation to accept local upload paths | Done | API and UI accept `/uploads/employee_photos/...` in addition to http URLs. |
| EMP-104 | Add migration utility for existing data URL photos to local files (if any) | Done | Script `backend/scripts/migrate_employee_photo_data_urls.js` supports dry-run and apply execution. |
| EMP-105 | Add optional dedicated multipart upload API (`POST /employees/:id/photo`) | Done | Upload endpoint saves validated file and returns path, reducing JSON payload size. |
| EMP-106 | Add automated API/provider tests for photo + engagement transitions | Done | `backend/test_employee_feature_flows.test.js` covers photo conversion, replace/remove, upload endpoint, and validation. |
| EMP-107 | Backfill assignment type for legacy employee records | Done (Script Ready) | Script exists (`backend/scripts/backfill_employee_assignment_type.js`); execution in target env pending ops runbook. |
| EMP-108 | UAT script and sign-off checklist | In Progress | UAT checklist added; business test execution/sign-off still pending. |

## Verification Notes

- Backend syntax checks:
  - `node --check backend/src/providers/postgres.js`
  - `node --check backend/src/providers/sqlite.js`
  - `node --check backend/src/index.js`
  - `node --check backend/scripts/migrate_employee_photo_data_urls.js`
- Backend automated tests:
  - `npm run test:employee-features`
- Migration utility dry-run:
  - `npm run migrate:photo-data-urls -- --limit=1`
- Assignment backfill dry-run:
  - `npm run backfill:assignment-type:dry-run`
- Frontend production build:
  - `npm run build` (passes; existing bundle-size warnings remain)
