# Real-time SSE Updates & Infinite Scroll Pagination

We will implement Server-Sent Events (SSE) for automatic real-time dashboard updates and replace the current pagination on the Application History and Questions pages with dynamic infinite scroll pagination (loading skeleton + viewport detection).

## User Review Required

> [!NOTE]
> - We chose **SSE (Server-Sent Events)** rather than WebSockets since updates are unidirectional (server -> client). This is lightweight, runs over standard HTTP, and has automatic reconnection support.
> - The overview stats charts on the dashboard require the entire applications dataset to compute their values client-side. We will keep `api.applications()` returning the full list by default so the charts remain accurate, while adding optional pagination parameters (`limit`, `offset`, `search`) to load paginated lists dynamically in the infinite scroll pages.

## Proposed Changes

### Backend (FastAPI API Service)

We will modify [main.py](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/backend/services/api/main.py) to add the SSE endpoint and extend the pagination capabilities of list endpoints.

#### [MODIFY] [main.py](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/backend/services/api/main.py)
- Create a global `SSEBroadcaster` class to register clients (using `asyncio.Queue`) and broadcast events.
- Implement `/api/sse` endpoint returning a `StreamingResponse(..., media_type="text/event-stream")`.
- Call `broadcast_sync("application_created", ...)` inside `create_application`.
- Call `broadcast_sync("application_updated", ...)` inside `update_application`, `async_application_from_link`, etc.
- Call `broadcast_sync("application_deleted", ...)` inside `delete_application`.
- Add `limit`, `offset`, and `search` query parameters to `/api/applications` and `/api/question-cache` endpoints.

---

### Frontend (Next.js Application)

We will modify the frontend files to listen to SSE events and implement dynamic infinite scrolling with a skeleton loader.

#### [MODIFY] [api.ts](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/Apps/user/lib/api.ts)
- Update `api.applications` and `api.questionCache` signatures to accept optional `limit`, `offset`, and `search` query parameters.

#### [MODIFY] [ConsoleContext.tsx](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/Apps/user/components/ConsoleContext.tsx)
- Establish an `EventSource` connection to `/api/sse` in a `useEffect` on mount.
- Listen for `application_created`, `application_updated`, and `application_deleted` events to update the `applications` state array in real time.

#### [MODIFY] [applications/page.tsx](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/Apps/user/app/applications/page.tsx)
- Change pagination logic from client-side slicing to server-side offset-based infinite scroll.
- Add local state for loaded items, pagination status, search text, and status filters.
- Build an `IntersectionObserver`-based scroll detector.
- Render a table row skeleton loader when fetching more items.

#### [MODIFY] [questions/page.tsx](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/Apps/user/app/questions/page.tsx)
- Apply the same infinite scroll logic for saved answers using server-side pagination with search filtering.

## Verification Plan

### Automated Verification
- Compile and run syntax validation:
  `python3 -m py_compile backend/services/api/main.py`
  `npm run build` inside `Apps/user`

### Manual Verification
- Open the application console dashboard.
- Create or update an application via the API (e.g. running the bot) and watch the Dashboard and Applications list update instantly without page reloads or polling.
- Scroll down the Application History and Questions pages, see the skeleton loader, and confirm more items are loaded automatically.
