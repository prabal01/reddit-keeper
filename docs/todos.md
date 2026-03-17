# Future Tasks & Pricing Strategy

## 💳 Payment & Plan Strategy (Draft)
The goal is to move from "Unlimited" stubs to a sustainable "Credit/Usage" model to protect against Serper (Discovery) and Gemini (Analysis) costs.

### Tier 1: Free Exploration ($0)
*   **Discovery Searches**: 3 (Total)
*   **Deep-Dive Blueprints**: 1 (Total)
*   **Saved Threads**: 5
*   **Thread Depth**: 50 comments max

### Tier 2: Founding Access ($19 One-Time)
*   **Discovery Searches**: 30
*   **Deep-Dive Blueprints**: 10
*   **Saved Threads**: Unlimited (or cap at 500)
*   **Thread Depth**: 5,000 comments max
*   **Feature Access**: Switching Trigger Detection, Ranked Build Priorities, Feature Gap Analysis.

### Tier 3: Standard (Future - $39+/mo)
*   **Discovery Searches**: 50/month
*   **Deep-Dive Blueprints**: 20/month
*   **Features**: Team collaboration, Ongoing competitive tracking, Multi-platform support.

---

## 🛠️ Implementation TODOs
- [ ] **Usage Tracking**: Add `discoveryCount` and `analysisCount` to Firestore `UserDoc`.
- [x] **Debugging Reddit Sync Failures**
    - [x] Standardize headers and User-Agent in `reddit.service.ts`
    - [x] Add detailed error logging for non-OK status codes
    - [x] Fix `ups` property lint error in `types.ts`
- [x] **Stabilize UI and Auth Contexts**
    - [x] Memoize `AuthContext` and `FolderContext` to prevent infinite re-renders
    - [x] Fix Hook Order violation in `AppContent` (Web/src/App.tsx)
    - [x] Refactor `FolderDetail.tsx` to use Backend API instead of direct Firestore listeners
    - [x] Fix `getFolderThreads` interface mismatch
    - [x] Add polling for "processing" status in `FolderDetail`
- [ ] **Gatekeeping Middleware**: Create a `checkLimits` middleware that compares current counts against `plan_configs`.
- [ ] **Razorpay Integration**:
    - [ ] Create `src/server/payments.ts`.
    - [ ] Order creation logic for $19.
    - [ ] Webhook for `order.paid`.
- [ ] **Frontend Update**: Sync `PricingPage.tsx` with the $0 / $19 model.




- I want to have a discovery history in the side so that I can see my previous results.