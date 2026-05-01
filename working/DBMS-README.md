# Matsya AI - Database Management System (DBMS) Architecture

This document provides an **immensely detailed and comprehensive overview** of the entire Matsya AI database organization. It breaks down how the MySQL database operates, how tables are interconnected, which specific backend/agent functions interact with each table, and how the core data workflows (like offline syncing and conversational memory) are executed.

---

## 1. High-Level Architecture

The Matsya AI ecosystem relies on a central **MySQL relational database**. This database acts as the single source of truth for three primary consumers:
1. **Node.js Serverless Backend** (`backend/`): Provides REST API endpoints for the React Native mobile app and the Next.js web dashboard. It handles image analysis tracking, group syncing, user profiles, and analytics.
2. **Python LangGraph Agent** (`agent/`): An advanced conversational AI service that directly interacts with the database to maintain conversational threads, extract personalized long-term memory, and serve Telegram bot subscribers.
3. **Frontend Clients** (`mobile/` & `frontend/`): Consume the data via the Node.js backend.

The database relies heavily on the **`JSON` column data type** to store complex, schema-less data (like ML inference results and multi-fish weight estimates) while maintaining strict relational integrity (Foreign Keys) for core associations like User-to-Group or Conversation-to-Message ownership.

---

## 2. Table-by-Table Deep Dive

Below is the exhaustive breakdown of every table, its columns, its purpose, and the exact files in the codebase that read from or write to it.

### 2.1. `users`
**Purpose**: The core identity table. It stores user metadata, preferences, and public profile configurations. It maps 1:1 with AWS Cognito identities (`userId`).

**Schema Highlights**:
- `userId` (VARCHAR, Primary Key)
- `preferences` (JSON): Stores app settings (e.g., `{ "language": "en", "offlineSync": true, "units": "kg" }`).
- `publicProfileEnabled`, `publicProfileSlug`: Controls the public fisherman portfolio visibility.

**Connected Backend Functions**:
- `backend/src/functions/getUserProfile.js` (READ)
- `backend/src/functions/updateUserProfile.js` (UPDATE)
- `backend/src/functions/getPublicProfile.js` (READ by slug)
- `backend/src/functions/deleteUserAccount.js` (DELETE - cascades to all other tables)
- `backend/src/functions/exportUserData.js` (READ - fetches all user data for CSV export)

---

### 2.2. `groups` (Modern Multi-Image Analysis)
**Purpose**: The central hub for all modern fish scanning. It supports batch processing (multiple images per scan) and serves as the destination for offline synchronized sessions.

**Schema Highlights**:
- `groupId` (VARCHAR, Primary Key)
- `userId` (VARCHAR, Foreign Key to `users`)
- `s3Keys` (JSON): An array of S3 object keys representing the uploaded original images.
- `analysisResult` (JSON): The master output from the ML models. Contains bounding boxes, species classifications, disease detections, and aggregate statistics for the entire group.
- `weightEstimates` (JSON): A dictionary mapping a global fish index (e.g., `fish_0`, `fish_1`) to the user's manually confirmed weight and market value estimations.
- `latitude` / `longitude` (DECIMAL): Geolocation of the catch for the heatmap.

**Connected Backend Functions**:
- `backend/src/functions/createGroupPresignedUrls.js` (INSERT - creates pending group)
- `backend/src/functions/analyzeGroup.js` (UPDATE - triggers ML API and saves `analysisResult`)
- `backend/src/functions/getGroups.js` (READ - fetches paginated history)
- `backend/src/functions/getGroupDetails.js` (READ - fetches full details + parses JSONs)
- `backend/src/functions/saveWeightEstimate.js` (UPDATE - modifies `weightEstimates` and recalculates `analysisResult.aggregateStats`)
- `backend/src/functions/syncOfflineSession.js` (INSERT/UPDATE - handles batch commits from offline mobile scans)
- `backend/src/functions/getAnalytics.js` (READ - aggregates weight, catches, and earnings for dashboard charts)
- `backend/src/utils/groupsDb.js` (Core CRUD wrapper utility for this table)

---

### 2.3. `images` (Legacy Single-Image Analysis)
**Purpose**: Maintained for backward compatibility. Previously, the app only supported 1 image per scan. This table stores those historical records.

**Schema Highlights**:
- `imageId` (VARCHAR, Primary Key)
- `analysisResult` (JSON)
- `weightEstimates` (JSON)

**Connected Backend Functions**:
- `backend/src/functions/analyzeImage.js` (Legacy API)
- `backend/src/functions/getImages.js` (Legacy API)
- `backend/src/utils/groupHistory.js` (READ - dynamically queries `images`, transforms them on-the-fly into `groups` format, and merges them with `groups` table queries so the frontend receives a unified, seamless history feed).

---

### 2.4. Conversational AI Stack (`conversations`, `messages`, `memory`)
**Purpose**: Powers the LangGraph AI Assistant. Unlike the legacy `chats` table (which was a flat list of messages), this modern stack supports distinct chat threads, tool-call tracking, and personalized long-term memory.

**Tables & Connections**:
1. **`conversations`**:
   - `conversationId` (PK), `userId` (FK).
   - Stores `title` and `summary` (generated by the LLM).
2. **`messages`**:
   - `messageId` (PK), `conversationId` (FK).
   - `role` ('user' or 'assistant').
   - `toolCalls` (JSON): Stores function calls the AI made (e.g., fetching weather, getting market prices).
3. **`memory`**:
   - `userId` (PK).
   - `facts` (TEXT): The AI continuously extracts and updates a list of facts about the user (e.g., "User fishes in Mumbai", "Prefers catching Pomfret") to personalize future answers.

**Connected Backend Functions**:
- This stack is almost exclusively managed by the **Python Agent**:
  - `agent/src/routes/conversations.py` (CRUD for threads and messages)
  - `agent/src/memory/manager.py` (Reads/Writes to `memory` and `conversations`)
- The Node.js backend acts only as a proxy (e.g., `backend/src/functions/getChatHistory.js` forwards requests to the Python agent if `IS_AGENT_CONFIGURED` is true).

---

### 2.5. Ecosystem Modules (`telegram_subs`, `fish_knowledge`)
**Purpose**: Infrastructure for offline alerts and RAG (Retrieval-Augmented Generation).

1. **`telegram_subs`**:
   - Stores users who have opted into Telegram alerts.
   - Connected to `agent/src/telegram/bot.py` and `agent/src/telegram/notifier.py` which push extreme weather warnings to `telegramChatId`.
2. **`fish_knowledge`**:
   - Stores chunked markdown/PDF documents regarding fish regulations, diseases, and species data.
   - While `agent/chroma_db` handles the vector embeddings for semantic search, this MySQL table acts as the permanent source of truth.
   - Connected to `agent/seed_rag.py` (INSERT) and `agent/rag_retriever.py` (READ).

---

## 3. Extremely Detailed Data Workflows

To truly understand how these tables connect in practice, here is a deep dive into the two most complex workflows in the codebase:

### Workflow A: The Offline Sync & Weight Estimation Pipeline
When a fisherman uses the app out at sea without internet, the data goes through a highly complex synchronization dance once the network is restored:

1. **Local Storage**: The mobile app runs on-device YOLO models and stores the detections in the phone's `AsyncStorage` (managed by `mobile/lib/local-history.ts`).
2. **Background Sync Trigger**: Upon regaining internet, `SyncService` triggers `syncLocalHistory()`.
3. **Phase 1: Prepare (`POST /sync/offline-session/prepare`)**:
   - Calls `backend/src/functions/syncOfflineSession.js`.
   - The backend generates a random `groupId` and returns presigned AWS S3 URLs.
4. **Phase 2: S3 Upload**: Mobile PUTs the raw images, cropped fish images, and GradCAM heatmaps directly into the S3 bucket.
5. **Phase 3: Commit (`POST /sync/offline-session/commit`)**:
   - Calls `syncOfflineSession.js` again.
   - The backend builds a massive JSON object representing the `analysisResult` and executes an `INSERT INTO groups` (or `images`), permanently saving the offline scan to the cloud.
6. **Phase 4: Weight Adjustments (`POST /weight-estimates`)**:
   - Because the AI cannot accurately guess weight offline (without real-world dimensions), the app defaults the offline weights to `0`.
   - If the user manually scaled the fish while offline, `local-history.ts` immediately fires requests to `backend/src/functions/saveWeightEstimate.js`.
   - The backend finds the `groups` record, locates the correct fish using `fishIndex` (a globally incremented index across all images in the group), and updates the `weightEstimates` JSON column. 
   - **Crucially**, it then recalculates the `totalEstimatedWeight` and `totalEstimatedValue` inside `analysisResult.aggregateStats` to reflect the new manual data, ensuring the dashboard charts remain perfectly accurate.

### Workflow B: Unified History & Map Merging
Because the system transitioned from single-image scans (`images` table) to batch scans (`groups` table), the UI requires a seamless feed of both.

1. **The Request**: Mobile/Web calls `GET /groups` (`backend/src/functions/getGroups.js`).
2. **Concurrent DB Execution**: The backend delegates to `backend/src/utils/groupHistory.js`, which fires `Promise.allSettled` to query BOTH the `images` table and the `groups` table simultaneously.
3. **On-the-Fly Transformation**: `groupsDb.js` runs `transformLegacyToGroup()`, converting the old flat `images` schema into the nested `groups` JSON schema in real-time in the server's RAM.
4. **Sorting and Delivery**: The backend merges the lists, sorts them by `createdAt`, and generates fresh S3 presigned URLs for thumbnails before returning the unified payload to the frontend.

---

## 4. Referential Integrity & Cascade Deletions

The database heavily utilizes `ON DELETE CASCADE` to prevent orphaned data:
* If a row in `users` is deleted via `deleteUserAccount.js`:
  * All associated `images` are wiped.
  * All associated `groups` are wiped.
  * All associated `conversations` are wiped, which in turn cascades to wipe all `messages`.
  * All associated `memory` facts are wiped.
* **Note**: S3 objects (images/crops) are not automatically deleted by MySQL cascades. A separate cleanup lambda or lifecycle rule is required to purge orphaned S3 bucket contents.

## Summary
The Matsya AI database is designed to handle sparse, unpredictable data (via `JSON` columns for dynamic ML outputs) while relying heavily on strict relational constraints for user ownership and agent conversation state. The abstraction layers (like `groupsDb.js` and `groupHistory.js`) successfully hide the legacy technical debt of single-image scans, presenting a clean, unified API to both the Next.js and React Native frontends.