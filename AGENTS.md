# AGENTS.md

## Scope

These instructions apply to the entire `galfar-backend` repository.

This repository is the Node.js API for the Galfar Integrated Web Application. The related React repository is normally located at `D:\galfar-frontend`.

## Stack and Commands

- Node.js using ES modules.
- Express 5 REST API.
- PostgreSQL through `pg` is the active application database.
- JWT authentication.
- Nodemailer for workflow notifications.
- Node cron for scheduled email and SLA jobs.
- `mongoose` remains installed and the legacy README mentions MongoDB, but active models issue PostgreSQL SQL through `Config/db.js`; do not introduce MongoDB persistence without an explicit architecture change.

Use these commands from the repository root:

```powershell
npm.cmd start
node --test test/*.test.js
```

There is no configured lint script. Follow the surrounding code style and run focused tests plus a server import/startup check when practical.

## Project Structure

- `server.js`: Express setup, middleware order, route mounting, and cron startup.
- `Routes`: endpoint definitions and route-level authorization.
- `Controllers`: request validation and workflow orchestration.
- `Models`: persistence and data-access logic.
- `Middlewares`: shared Express error handling.
- `Utils`: JWT, permissions, authorization, and shared mappings.
- `EmailAlerts`: module-specific email recipient and message processing.
- `helpers`: workflow/status and email-template helpers.
- `cron`: scheduled email and SLA work.
- `migrations`: database migrations.
- `test`: Node test-runner tests.

## Runtime Architecture

`server.js` creates the Express app, enables JSON parsing and allow-listed CORS, mounts route families, installs not-found/error middleware, starts the listener, and then starts the monthly summary and SLA cron schedules.

The normal request path is:

```text
Frontend API wrapper
  -> Express route
  -> JWT/statement permission middleware
  -> controller validation and workflow authorization
  -> model SQL query/transaction
  -> JSON response
  -> optional separate email-notification request
```

Workflow updates and emails are separate HTTP operations. A successful database update remains successful if the later email request fails.

### Route authentication

- `/users` is mounted without a global JWT middleware because login/registration/reset validation must be public; protect sensitive child routes individually when adding them.
- `/emailnotify` has public password-reset routes first, then applies `verifyToken` to workflow email routes.
- `/receipts`, `/particulars`, `/department`, `/logistics`, `/brstatement`, `/filenote`, `/projects`, `/analytics`, `/flreq`, `/announcements`, and `/api/sharepoint` are mounted behind `verifyToken` in `server.js`.
- CORS permits no-origin requests and origins matching `PROD_URL` or `DEV_URL`.

### Environment variables

Document names only; never commit values:

- Server/security: `PORT`, `JWT_SECRET`, `NODE_ENV`, `ENVIRONMENT`.
- URLs/CORS/email links: `DEV_URL`, `PROD_URL`.
- PostgreSQL: `PGUSER`, `PGHOST`, `PGDATABASE`, `PGPASSWORD`, `PGPORT`.
- SMTP: `EMAIL_USER`, `EMAIL_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`.
- Azure receipt storage: `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY`, `STORAGE_CONTAINER_NAME`.
- SharePoint: `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`, `SHAREPOINT_HOSTNAME`, `SHAREPOINT_SITE_PATH`, `SHAREPOINT_ALLOWED_LISTS`.
- Workflow/SLA: `SPECIAL_PROJECTS`, `THRESHOLDHOURS`, `NEARING_THRESHOLDHOURS`.

## Mounted API Map

| Prefix | Main responsibility | Authentication |
| --- | --- | --- |
| `/users` | Login, registration, user permissions, document-read state, email validation | Mixed/public at mount |
| `/receipts` | Hiring/Asset receipts, approvals, counts, upload, delete/withdraw | JWT |
| `/particulars` | Department template CRUD | JWT |
| `/emailnotify` | Password reset and module email dispatch | Reset routes public; workflow route JWT |
| `/department` | Department creation | JWT |
| `/logistics` | Logistics statement CRUD, counts, approval history | JWT |
| `/brstatement` | Buy vs Rent CRUD, counts, workflow updates, deletion | JWT |
| `/filenote` | FN/IOC CRUD, categories, document numbers, IOC updates | JWT |
| `/projects` | Project data and project CM/PM mapping | JWT |
| `/analytics` | Consolidated approval analytics | JWT |
| `/flreq` | Fleet Request creation, listing, detail, document IDs, workflow | JWT + `fl_req` access |
| `/announcements` | Announcement creation and retrieval | JWT |
| `/api/sharepoint` | SharePoint list items, list totals, and user profile photos | JWT |

## Module Details

### Users and permissions

- `userController` creates/authenticates users, validates email, and records document/changelog reads.
- Password hashes and reset-token fields must never be returned. `buildSafeUserInfo` removes sensitive fields and attaches resolved statement permission.
- `userPermissions` currently resolves `fl_req` permissions. Multiple `view` and `edit` records combine to `manage`.
- JWT payload/user reconstruction must continue to include the fields required by authorization: roles, project codes, department codes, admin flag, and permission.

### Hiring/Asset receipts

- `ReceiptRoutes` supports create/list/detail/update/status/approval, approver details, upload, hard/soft delete, totals, and initiator withdrawal.
- Receipt persistence is split between request/form records and approver detail/history records.
- Azure Blob environment variables are used by upload handling.
- Plant approval email is processed by `ProcessHireEmail`.

### Logistics comparative statements

- `LogisticsRoutes` supports create, all IDs, filtered lists, totals, detail, workflow updates, value updates, soft delete, and approver history.
- Standard progression is initiator -> incharge -> PM -> GM -> FM -> CEO; configured special projects insert PD after PM.
- Approval comments are stored in role-specific fields. Preserve field mapping when changing roles.
- Email is processed by `ProcessLogisticsEmail`.

### Buy vs Rent

- `BuyRentRoutes` supports create/list/count/detail, statement-value updates, workflow updates, and soft delete.
- Normal progression is initiator -> HOD -> FM -> GM -> CEO, with category-dependent transition behavior.
- Statuses used by queries and dashboards include `created`, `pending for <role>`, `review`, `rejected`, `reverted`, and `approved`.
- Approved emails can include generated document/attachment information through `ProcessBvrEmail`.

### File Note / IOC

- `FileNoteRoutes` supports create, list, document number generation, categories, detail, workflow update, IOC/demob update, soft delete, and category creation.
- File Note and IOC flows vary by category. General flows use HOD/SFM or GM/CEO paths; Demob/FWA flows use CM/PM/PD/GM combinations.
- Project-specific rules must remain aligned with frontend `roles_helper.js` and `statusfinder.js`.
- Email dispatch selects `ProcessFnEmail` when `dept=plant`, `type` is not `fr`, and both type/category are supplied.

### Analytics and announcements

- `/analytics/approvals` consolidates pending, submitted, created, rejected, approved, and nearing-SLA data across modules.
- Role/status matching in `Models/approvalData.js` affects the Home analytics cards and pending dashboard.
- Announcements use `GeneralRoutes`, `Controllers/Announcements.js`, and `Models/Announcement.js`.

### SharePoint

- `/api/sharepoint/items` returns one page of an allowed SharePoint list; pagination uses the signed `nextCursor` returned by the service.
- `/api/sharepoint/count` returns the overall list count from Microsoft Graph beta `itemCount`; it ignores viewer OData filters and is a metadata snapshot, not a transactional count. It uses the existing server-side Graph client-secret authentication and Graph permissions. The Graph beta endpoint may change.
- `/api/sharepoint/user-photo/:email` returns a Microsoft Graph profile photo for the supplied email.
- All SharePoint endpoints require JWT authentication. List, field, and indexed filter allowlists are configured through SharePoint environment variables.

### Scheduled work

- `cron/emailCron.js` runs daily at 06:00 UTC, but sends monthly summaries only on day 1.
- `cron/pendingSLACron.js` runs at 05:00 and 11:00 UTC, corresponding to 09:00 and 15:00 UAE time.
- The SLA controller call is currently commented out; do not describe SLA email delivery as active without rechecking the code.
- Cron errors must not terminate normal API request handling. Avoid starting duplicate schedules in tests or multiple-process deployments without coordination.

## Implementation Conventions

- Preserve existing user changes and avoid unrelated refactors.
- Keep route handlers thin; place business and persistence logic in controllers/models and reusable authorization logic in `Utils`.
- Use ES-module imports with explicit `.js` extensions.
- Forward errors to the shared error middleware or use the established controller error pattern.
- Validate identifiers, request bodies, roles, access levels, and status transitions at the API boundary.
- Never trust frontend permission checks. Every protected operation must be authorized by backend middleware or controller logic.
- Do not log or commit passwords, tokens, database connection strings, SMTP credentials, storage keys, or complete environment values.
- Do not modify `.env` unless the user explicitly requests it.
- Avoid destructive database operations or migrations without explicit confirmation and a recovery plan.

## User Working Preferences

These are established preferences from prior implementation discussions. Follow them unless the user explicitly requests different behavior:

- Inspect a comparable working module before implementing new workflow behavior and reuse the established contract where it fits.
- Keep workflow persistence and email delivery separate. The database update is the primary operation; email is secondary and occurs only after persistence succeeds.
- Email latency or failure must not cause the frontend to keep showing a workflow action as processing after the database update has completed.
- Send/resubmit and intermediate approval notifications to the next approval level. Send rejection and review notifications back to the initiator.
- Return the newly persisted status and record fields needed by the frontend and email request; do not force the frontend to guess the server's final workflow state.
- Use action-specific, human-readable results while preserving stable machine action names such as `send-for-approval`, `approve`, `reject`, and `review`.
- Centralize repeated authorization, workflow-transition, and recipient-selection logic rather than duplicating role checks across controllers.
- Keep server-side validation authoritative even when the frontend already disables an action.
- Preserve existing module behavior and user changes outside the requested scope.
- Make the smallest cohesive change, add focused verification, and report unrelated legacy problems separately.

## Change Reporting Standard

For every implementation, provide a professional handoff that is understandable without reading the full conversation. Include all of the following:

1. **Outcome**: State clearly what was implemented or corrected.
2. **Files changed**: List every file created, modified, renamed, or deleted. Use clickable absolute file links when available and briefly state the responsibility of each change.
3. **Impact**: Explain effects on endpoints, request/response contracts, authentication, authorization, workflow status, persistence, recipient selection, scheduled jobs, and the frontend when applicable.
4. **Justification**: Explain why the implementation belongs in the selected controller, model, middleware, utility, or email processor and why the chosen behavior is safe.
5. **Technical explanation**: Summarize the request path and data/status transition when it is not obvious.
6. **Verification**: Report the exact tests or startup/static checks performed and whether they passed. Clearly separate pre-existing failures from regressions caused by the change.
7. **Risks and limitations**: Call out untested database behavior, SMTP/external-service dependency, migration requirements, concurrency concerns, compatibility assumptions, or follow-up work.

Keep the report proportional to the change. Use concise prose for small changes and structured sections for workflow, security, database, email, or cross-repository changes. Never claim runtime, database, or email delivery verification when only code inspection or tests with mocks were performed.

## Authentication and Authorization

- Routes mounted behind `verifyToken` require a valid bearer token.
- Public route decisions in `server.js` are security-sensitive; do not change them casually.
- Statement permissions use `requireStatementAccess` and access levels such as `view`, `edit`, and `manage`.
- Fleet Request endpoints use the `fl_req` statement role and the authorization helpers in `Utils/fleetRequestAuthorization.js` and `Utils/userPermissions.js`.
- Apply least privilege: reading, editing, approving, and managing are distinct capabilities.

## Fleet Request Workflow

The standard approval flow is:

```text
Initiator -> CM -> PM -> HOD -> GM -> Approved
```

Special projects include PD between PM and HOD. Use the existing project and approval-flow helpers as the source of truth.

Expected actions and outcomes:

- `create`: persist a new request with `created` status.
- `send-for-approval`: validate the initiator and move to the first pending approver.
- `approve`: validate the current approver and advance exactly one level.
- `reject`: save rejection details and notify the initiator.
- `review`: return the request to the initiator with required comments.
- `recall`: allow an edit-capable initiator to withdraw a pending request into `recalled`; do not send email.
- GM is the final approver; GM approval changes the status to `approved`.

Do not allow clients to skip approval levels by supplying an arbitrary next status. Validate the requested action against the stored request, authenticated user, project flow, and current status.

### Fleet Request endpoints

| Method/path | Purpose | Additional rules |
| --- | --- | --- |
| `POST /flreq` | Create request | `fl_req` edit/manage, project access, non-empty item array |
| `GET /flreq/fetchdocid/:project` | Generate/fetch next document ID | Edit/manage and project access |
| `GET /flreq/fetchdocsdata` | Paginated/filterable dashboard data | `module` required; projects required unless elevated role |
| `GET /flreq/:id` | Fetch detail | Project access; draft/review hidden from approval-only users |
| `PUT /flreq/:id` | Update or workflow action | Server authorizes action and computes next status |

### Fleet Request permissions

- `view`: may view permitted submitted requests and perform approval actions only when the user's role matches the current pending role.
- `edit`: may create, update, and send/resubmit editable requests.
- `manage`: combines view and edit.
- HOD, GM, and CEO bypass project assignment restrictions for listing/access; other users are limited by `pr_code`.
- Only `created`, `review`, and `recalled` requests are editable by the initiator.
- Recall is accepted only while the stored status starts with `pending for ` and requires edit/manage access.
- An existing request cannot be moved to another project.
- Reject and review require comments.
- Updates use the stored current status as `expectedStatus` to protect against stale/concurrent transitions; preserve this optimistic concurrency check.

### Fleet Request persistence

- `InsertFleetRequest` creates the header and item rows, assigning `created` regardless of a client-supplied status.
- `UpdateFleetRequest` updates allowed header fields, items, status, approval history, sent-for-approval state, and soft-delete state.
- Listing filters distinguish editable drafts/reviews from submitted requests and role-specific pending queues.
- Document IDs are project-based; generation must remain safe under concurrent creation.
- Fleet Request items persist required `adnoc_fitments` as `yes` or `no` and `tpi` as `Normal` or `CP - 19`; creation and item updates reject missing or invalid selections.
- `Utils/fleetRequestValidateItems.js` is the shared boundary for Fleet Request item validation and canonicalization. It accepts snake_case or camelCase ADNOC-fitment input, validates TPI case-insensitively, and persists canonical TPI labels (`Normal`, `CP - 19`). Do not bypass it in create/update controllers.
- TPI accepts only the canonical labels `Normal` and `CP - 19`; do not add aliases unless both clients and stored-data compatibility are handled explicitly.

## Email Notifications

- Email processing is module-specific under `EmailAlerts`.
- Fleet Request email logic is in `EmailAlerts/ProcessFREmail.js` and is reached through the `/emailnotify/:id` flow with `type=fr`.
- Send/resubmit and intermediate approval should notify the next approver.
- Reject and review should notify the initiator.
- A final approval should use the established completion-recipient behavior.
- Workflow persistence is the primary operation. Email errors should be observable and reported without rolling back or misreporting an already successful workflow update unless transactional delivery is explicitly introduced.
- Keep recipient selection on the server; never accept arbitrary recipient addresses from the frontend.

### Email dispatcher selection

`POST /emailnotify/:cs_id` dispatches according to query parameters:

| Query | Processor |
| --- | --- |
| `dept=logistics` | `ProcessLogisticsEmail` |
| `dept=buyvsrent` | `ProcessBvrEmail` |
| `dept=plant` with no type/category | `ProcessHireEmail` |
| `dept=plant&type=<fn/ioc>&category=<category>` | `ProcessFnEmail` |
| `dept=plant&type=fr` | `ProcessFREmail` |

Password-reset request, token verification, and password update are separate public routes under `/emailnotify` before the JWT middleware.

### Fleet Request recipient rules

`ProcessFREmail` treats the persisted status as authoritative:

- `pending for <role>` -> that role is the primary recipient.
- After PM approval, a separate intimation email is sent to department `inith` users stating whether the request is now in the HOD queue or, for special projects, the PD queue. The normal next-approver email remains unchanged.
- `review`, `rejected`, or `approved` -> `initfr` users for the project are primary recipients.
- Final approved email additionally CCs project CM/PM and department HOD/GM recipients, deduplicated against primary recipients.
- Role lookup uses project and department constraints through user-model helpers.
- HTML-escape document fields before interpolation.
- Approved attachments are included only when an exported attachment is provided.

The email link must match a real frontend route. The current frontend detail route is `/fleetrequest/:id`; verify generated email URLs whenever route names change.

## Data and Status Conventions

- IDs may arrive as strings from route params; normalize deliberately before numeric comparisons.
- Roles and statuses should be trimmed and lowercased for comparison, while persisted/display strings retain established values.
- Common terminal statuses are `approved` and `rejected`; `review` returns work to an initiator; `reverted` is used by legacy modules.
- Pending statuses use the exact shape `pending for <lowercase-role>`.
- Soft-delete flags are used by several modules. Do not replace a soft delete with a physical delete without explicit scope and recovery requirements.
- Models use parameterized PostgreSQL queries. Never interpolate request values into SQL fragments; whitelist any dynamic column/order/filter fragments.

## Error and Response Contract

- Validation errors should return 400.
- Authentication failures should return 401.
- Authorization/project-access failures should return 403.
- Missing records should return 404.
- Invalid/stale workflow transitions should return 409 when appropriate.
- Unexpected failures should return 500 without exposing secrets or raw database configuration.
- Frontend callers commonly read `error.response.data.error`, so preserve an `error` string for workflow/API failures unless both sides are updated together.
- Successful create calls normally return the saved record and use 201; successful reads/updates use 200.

## Known Constraints and Caveats

- The backend `package.json` only defines `npm start`; the legacy README's `npm run dev` instruction is stale.
- The legacy README identifies MongoDB, but current data models use PostgreSQL.
- `server.js` starts cron jobs when the server starts, so importing/starting the whole server in tests can create side effects.
- Email delivery uses Office 365 SMTP and happens synchronously within the email endpoint.
- Frontend and backend maintain separate special-project environment lists; keep them aligned.
- Some legacy modules calculate transitions in both frontend and backend. Backend validation must remain authoritative.
- Existing status casing and names are inconsistent across legacy modules; avoid broad normalization migrations without data review.

## Database Schema Map

The repository currently has no checked-in migration files despite having a `migrations/` directory. The following map is inferred from active model queries and must be verified against the target PostgreSQL database before a schema change:

| Table | Responsibility/relationships |
| --- | --- |
| `users` | Accounts, roles, departments, projects, password/reset data, document-read state |
| `statement_role_permissions` | Per-user/module access records such as `fl_req` with `view`, `edit`, or `manage` |
| `departments` | Department reference data |
| `project_users` | Project-to-user/role mappings, including CM/PM lookup |
| `particulars` | Reusable templates keyed by department |
| `receipts` | Hiring/Asset request headers and workflow state |
| `tabledata` | Hiring/Asset request line/table data linked to receipts |
| `approverdetails` | Receipt approval history/status/comments linked by request ID |
| `log_statements` | Logistics statement headers, values, status, comments, and approver info |
| `forwarder_records` | Logistics forwarder/vendor rows linked to statements |
| `buy_rent_statements` | Buy vs Rent document data, status, files, and approver history |
| `file_note` | File Note/IOC content, category/type, project, status, files, and approver info |
| `fn_ioc_categories` | File Note/IOC category reference data |
| `document_id` | FN/IOC document-number tracking |
| `fleet_request` | Fleet Request header, document ID, project, dates, status, and approver info |
| `fleet_request_items` | Equipment line items linked to a Fleet Request |
| `doc_id_fl_req` | Project-based Fleet Request document-number tracking |
| `announcements` | Home-page announcement content |
| `statement_email_trigger_log` | SLA/reminder email trigger history and audit information |

- Preserve foreign-key relationships and transactional boundaries between header/item/history tables.
- Add timestamp, actor, and status-history behavior deliberately; approval audit data must not be silently discarded.
- Use soft-delete fields where the module already depends on historical visibility.
- Create a reviewed migration for every schema change. Include forward change, data backfill if needed, compatibility sequence, and rollback/recovery notes.
- Never run an unreviewed migration against production. Back up or otherwise establish recovery before destructive or irreversible data changes.

## Testing Strategy

- Use Node's built-in test runner for existing and new focused tests.
- Authorization tests must cover unauthenticated, missing permission, wrong project, wrong approval role, allowed role, and manage access.
- Workflow tests must cover every valid transition, invalid action, stale status/concurrency conflict, required comments, and final approval.
- API contract tests should verify status codes and the response fields consumed by the frontend.
- Email tests should mock SMTP and recipient lookups; cover next approver, review/reject to initiator, final approval/CC deduplication, missing recipient, and SMTP failure.
- Model tests affecting SQL should use an isolated test database or transaction rollback. Never point automated tests at production data.
- Cron tests should invoke the underlying work directly with time/config controlled; do not rely on waiting for real schedules.

## Logging, Privacy, and Observability

- Log operational context such as module, record ID, action, and safe error summary; never log passwords, JWTs, reset tokens, SMTP/storage secrets, or raw connection strings.
- Avoid logging complete request bodies because documents, comments, files, emails, and project data may be sensitive.
- Return safe client errors while retaining enough server-side context to diagnose failures.
- Workflow and authorization failures should be distinguishable from infrastructure, database, storage, and email failures.
- Email failures need observable server logs but must not rewrite the result of an already committed workflow update.
- Preserve or improve approval audit information whenever changing workflow persistence.

## API Compatibility and Concurrency

- Treat paths, methods, query parameters, action names, statuses, and response shapes as a contract with `D:\galfar-frontend`.
- Coordinate breaking changes across both repositories. Use a compatibility period or versioned endpoint when clients cannot deploy simultaneously.
- Workflow status must be computed and authorized by the server; ignore or reject arbitrary client attempts to skip levels.
- Preserve `expectedStatus`/equivalent checks so two approvers cannot advance the same stale request independently.
- Document-number allocation and header/item writes should be transactional and concurrency-safe.
- Make retry behavior idempotent where practical. A repeated network request must not create duplicate requests, duplicate approval history, or multiple document numbers.
- Email endpoints may be retried separately; consider an idempotency/audit mechanism before introducing automatic retries.

## Deployment

- Pushes to `main` and manual dispatch trigger `.github/workflows/main_aznuaegecbackend.yml`.
- CI uses Node 22, runs `npm install`, then any configured build/test scripts, uploads the repository artifact, and deploys it to the Azure Web App `aznuaegecbackend` Production slot.
- The package currently has no build or test script, so the workflow's `--if-present` steps do not run the existing Node test files automatically. Add explicit scripts before treating CI as a test gate.
- Production configuration is supplied by Azure/GitHub secrets and app settings; never commit those values.
- Before deployment, run focused tests and a local startup/import check with non-production services.
- Schema changes require a documented migration order compatible with both old and new application versions.
- Rollback normally means reverting and redeploying the application artifact. If a migration is not backward-compatible, application rollback alone is insufficient; follow the migration recovery plan.
- Starting the deployed app also starts cron schedules. Account for multiple instances and deployment slot behavior to avoid duplicate jobs.

## Documentation Maintenance

Update this file in the same change whenever any of these change materially:

- Routes, authentication middleware, permissions, or role normalization.
- Workflow actions, approval order, statuses, or concurrency rules.
- Tables, relationships, migrations, or soft-delete/audit behavior.
- API request/response contracts used by the frontend.
- Email dispatcher selection, trigger timing, recipients, or attachments.
- Environment-variable names, cron schedules, or deployment workflow.
- Test commands, CI gates, or known limitations.

Use dedicated `docs/` files for detailed schemas, runbooks, incident notes, or feature specifications if those documents become too large for repository-wide agent instructions.

## Definition of Done

A backend change is complete when all applicable items are satisfied:

1. The requested behavior is implemented at the correct route/controller/model/utility layer.
2. Input validation, authentication, authorization, project access, and invalid transitions are handled.
3. Database writes are parameterized and preserve transaction, concurrency, audit, and soft-delete requirements.
4. Response status codes and payloads remain compatible with the frontend or both repositories are updated together.
5. Focused tests cover the changed success and failure paths and pass.
6. Email behavior is tested with mocks when changed; real delivery is not claimed unless explicitly verified in an authorized environment.
7. Migration and rollback instructions exist for schema/data changes.
8. Security/privacy logging rules are respected and no secret values are added.
9. Durable behavior and deployment requirements are documented.
10. The final handoff follows the Change Reporting Standard above.

## Frontend Contract

Before changing an endpoint, inspect its caller in `D:\galfar-frontend\src\APIs\api.js` and the relevant page/component. Keep these aligned:

- Route path and HTTP method.
- Bearer-token requirements.
- Request field names and types.
- Response shapes used by UI state.
- Exact action and status strings.
- Permission and role normalization.
- Email payload fields and recipient behavior.

If an API contract must change, update backend tests and the frontend caller in the same task when both repositories are in scope.

## Verification

For every change:

1. Run the closest focused test with Node's test runner.
2. Add or update tests for authorization and status-transition changes.
3. Check both allowed and denied roles.
4. Check malformed input, missing records, duplicate submission, and invalid transition behavior.
5. For email changes, verify next-approver, rejection/review-to-initiator, and final-approval cases without exposing real recipient data.
6. Report any pre-existing failures separately from regressions caused by the change.
