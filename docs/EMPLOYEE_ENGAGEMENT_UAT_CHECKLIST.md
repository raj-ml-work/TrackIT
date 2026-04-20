# Employee Engagement UAT Checklist

## Scope

Validate the end-to-end employee enhancements:

- Photograph capture and display
- Assignment classification
- Client engagement details
- Transition note/performance capture
- Audit/history behavior

## Preconditions

1. Backend is running with API configured (`VITE_API_URL` set in frontend runtime).
2. At least one test location and department exist.
3. A user with permission to create/update employees is logged in.

## Test Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| UAT-01 | Create employee on Bench with photo upload | Create employee, upload photo in step 2, set assignment type `Bench`, save | Employee created successfully; photo visible in list/detail; no client fields required |
| UAT-02 | Create employee as Client Billable | Create employee with assignment type `Client Billable`, provide client/location/manager/project/assignment date | Employee created successfully; engagement details visible in engagement tab |
| UAT-03 | Assignment validation for non-bench | Try save with `Client Billable` but missing client name/project/assignment date | API/UI blocks save with clear validation error |
| UAT-04 | Photo URL validation | Enter invalid photo URL and save | Save blocked with validation message |
| UAT-05 | Change engagement to another client | Use `Change Engagement` action and submit transition note | Employee official info updates; engagement history entry created with previous snapshot |
| UAT-06 | Move employee to bench | Use `Move To Bench`, provide mandatory transition note | Employee assignment becomes `Bench`; previous client snapshot appears in history |
| UAT-07 | Performance summary capture | During transition, add performance summary | Performance summary stored and visible in history entry |
| UAT-08 | Photo replacement | Edit employee and upload new photo | New photo appears; previous photo is no longer served from local uploads |
| UAT-09 | Photo removal | Edit employee and clear photo, save | Photo removed from profile displays and previous local photo file cleaned up |
| UAT-10 | Employee deletion cleanup | Delete employee having local uploaded photo | Employee removed; local photo file is deleted |
| UAT-11 | Legacy backfill script | Run `npm run backfill:assignment-type:dry-run`, then `npm run backfill:assignment-type` | Missing/blank assignment types updated to `Bench`; script reports counts |
| UAT-12 | Legacy photo migration script | Run `npm run migrate:photo-data-urls` (dry-run), then `npm run migrate:photo-data-urls:apply` if needed | Legacy `data:image/...` photo entries are converted to `/uploads/employee_photos/...` paths without data loss |

## Sign-Off

| Role | Name | Date | Result | Notes |
|---|---|---|---|---|
| Product Owner |  |  |  |  |
| HR/Operations |  |  |  |  |
| Engineering |  |  |  |  |
