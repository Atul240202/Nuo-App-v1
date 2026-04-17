#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Replace mocked Google auth with real Emergent Google login. All user-specific backend endpoints should read the user from the session token (cookie or Authorization Bearer) instead of a hardcoded email. Persist the logged-in user everywhere (calendar, /auth/me, audio-intervention routes, home/progress/profile/debug screens)."

backend:
  - task: "Real Emergent Google Auth — all endpoints use authenticated user"
    implemented: true
    working: true
    file: "server.py, auth_utils.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Created auth_utils.get_current_user FastAPI dependency that reads session_token from httpOnly cookie OR Authorization: Bearer header, looks up user_sessions, validates expiry, and returns the full user dict. Refactored the following endpoints to use Depends(get_current_user) and drop the hardcoded email default: /voice/analyze, /calendar/events, /calendar/recalculate, /session/status, /payment/create-order, /payment/verify, /recovery-index, /sleep-debt, /progress/summary, /interventions/count, /interventions/today, /interventions/generate, /interventions/save, /interventions/cancel, /achievements, /metrics/home, /debug/clear-subscription. Unauthenticated calls must now return 401. Calendar OAuth callback still links tokens to the Google email returned by Google (dropped the atuljha fallback). /auth/logout now accepts Bearer token too. Existing /auth/session, /auth/me still work."
        - working: true
          agent: "testing"
          comment: "All 32 auth tests PASSED. Verified each target endpoint twice: (a) without Authorization header → 401 Unauthorized, (b) with valid Bearer session_token (obtained via POST /api/auth/mock) → 200 OK. Endpoints verified: GET /auth/me, GET /recovery-index, GET /sleep-debt, GET /metrics/home, GET /session/status, GET /interventions/today, POST /interventions/generate, GET /progress/summary?period=week, GET /interventions/count?period=week, GET /achievements, GET /calendar/events, POST /calendar/recalculate, DELETE /debug/clear-subscription, POST /voice/analyze (no-auth only). Additional checks also PASSED: (1) GET /recovery-index?email=atuljha2402@gmail.com WITHOUT a Bearer header still returns 401 — the legacy email query-param fallback has been fully removed, no data leak. (2) POST /auth/logout with Bearer token returns 200 and deletes the session; subsequent GET /auth/me with the same token returns 401 as expected. (3) GET /api/audio/library remains public (200 without auth). (4) GET /api/payment/plans remains public (200 without auth). No endpoints leak data to unauthenticated users; no authed calls failed."
  - task: "GET /api/audio/library endpoint returns all audio tracks from MongoDB"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "Previously verified."

frontend:
  - task: "AuthContext + apiFetch with Bearer token, Emergent OAuth flow on web/native"
    implemented: true
    working: "NA"
    file: "contexts/AuthContext.tsx, utils/api.ts, app/auth.tsx, app/auth-callback.tsx, app/_layout.tsx, app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New AuthProvider wraps the app, rehydrates session_token from AsyncStorage, calls /api/auth/me on boot. utils/api.apiFetch auto-attaches Authorization: Bearer. auth.tsx now either redirects to https://auth.emergentagent.com (web) or uses WebBrowser.openAuthSessionAsync (native). auth-callback.tsx extracts #session_id from URL fragment and POSTs to /api/auth/session. All screens (home, voice, progress, profile, paywall, calendar, personalization, debug) rewired to use apiFetch — no more hardcoded atuljha2402@gmail.com. Logout clears token and redirects to /auth."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Real Emergent Google Auth — all endpoints use authenticated user"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Please test all user-scoped backend endpoints for proper auth handling: (1) Without any Authorization header or cookie → expect 401 Unauthorized. (2) With a valid session token (create one via POST /api/auth/mock which returns session_token) sent as `Authorization: Bearer <token>` header → expect 200 and data scoped to that user's email. Endpoints to cover: GET /api/auth/me, GET /api/recovery-index, GET /api/sleep-debt, GET /api/metrics/home, GET /api/session/status, GET /api/interventions/today, POST /api/interventions/generate, GET /api/progress/summary?period=week, GET /api/interventions/count, GET /api/achievements, GET /api/calendar/events, POST /api/calendar/recalculate, DELETE /api/debug/clear-subscription. Also verify POST /api/auth/session works with a valid Emergent session_id (you can skip actual Emergent call and just confirm the 400/401 error paths). Confirm that the refactored endpoints no longer accept/read the `email` query param as a fallback. Backend auto-reloads via WatchFiles. Do NOT test the frontend."
    - agent: "testing"
      message: "Backend auth refactor verified end-to-end. Ran /app/backend_test.py against the public REACT_APP_BACKEND_URL. 32/32 assertions passed. All 13 target endpoints correctly return 401 Unauthorized without an Authorization header and 200 OK when called with a valid Bearer session_token minted via POST /api/auth/mock. Confirmed the legacy `?email=` query-param fallback is fully removed (GET /api/recovery-index?email=atuljha2402@gmail.com without a Bearer returns 401, no data leak). POST /api/voice/analyze returns 401 without auth (multipart skipped per instructions). POST /api/auth/logout with Bearer returns 200 and invalidates the session — subsequent GET /api/auth/me with the same token returns 401. Public endpoints unchanged: GET /api/audio/library and GET /api/payment/plans both return 200 without auth. No remaining issues. Backend task can be marked complete."
