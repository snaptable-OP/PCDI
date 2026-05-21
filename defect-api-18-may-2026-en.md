# Defect API Documentation

All endpoints return a unified envelope:

```json
{
  "code": 200,
  "data": { ... }
}
```

---

# Part 1 — Defect Project

**Base URL**: `/api/defect-projects`

## Response shapes

### `DefectProjectResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Project ID |
| `name` | string | Project name |
| `code` | string | Project code |
| `address` | string? | Address |
| `prompt` | string | Prompt |
| `region` | string | Region |
| `assetType` | string | Asset type |
| `floorLevels` | string | Floor levels |
| `location` | string | Location |
| `structureType` | string | Structure type |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `isDeleted` | boolean | Whether deleted |

### `DefectProjectDetailResponse`

Extends `DefectProjectResponse` with:

| Field | Type | Description |
|-------|------|-------------|
| `knowledgeFolders` | `DefectKnowledgeProjectWithAgentsResponse[]` | All Knowledge Folders under this project and their Agents |

#### `DefectKnowledgeProjectWithAgentsResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Knowledge Folder ID |
| `knowledgeId` | UUID | Linked Knowledge ID |
| `projectId` | UUID | Owning Defect Project ID |
| `displayName` | string | Display name |
| `description` | string? | Description |
| `status` | string? | `PROCESSING` / `SUCCESS` / `FAIL` |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `updatedAt` | double? | Updated at (Unix timestamp) |
| `agents` | `DefectAgentResponse[]` | All Agents under this Folder |

---

## Endpoints

### 1. List all projects

**`GET /api/defect-projects`**

Returns all non-deleted projects.

**Response**: `List<DefectProjectResponse>`

---

### 2. Get a single project (detail)

**`GET /api/defect-projects/{id}`**

Returns project detail, including all Knowledge Folders under the project and each Folder’s Agent list.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Project ID |

**Response**: `DefectProjectDetailResponse`

**Example**

```json
{
  "code": 200,
  "data": {
    "id": "abc12345-0000-0000-0000-000000000000",
    "name": "Tower A",
    "code": "TA-001",
    "isDeleted": false,
    "knowledgeFolders": [
      {
        "id": "folder-uuid",
        "knowledgeId": "knowledge-uuid",
        "projectId": "abc12345-0000-0000-0000-000000000000",
        "displayName": "Tower A Knowledge",
        "status": "SUCCESS",
        "agents": [
          {
            "id": "agent-uuid",
            "defectKnowledgeProjectId": "folder-uuid",
            "userChosenResponseStrategy": "Repair",
            "prompt": "You are a defect expert...",
            "createdAt": 1714800000.0,
            "updatedAt": 0.0
          }
        ]
      }
    ]
  }
}
```

---

### 3. Create project

**`POST /api/defect-projects`**

**Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | — | Project name (unique) |
| `code` | string | no | `""` | Project code |
| `address` | string? | no | `null` | Address |
| `prompt` | string | no | `""` | Prompt |
| `region` | string | no | `""` | Region |
| `assetType` | string | no | `""` | Asset type |
| `floorLevels` | string | no | `""` | Floor levels |
| `location` | string | no | `""` | Location |
| `structureType` | string | no | `""` | Structure type |

**Response**: `DefectProjectResponse`

---

### 4. Update project

**`PUT /api/defect-projects/{id}`**

Send only fields to update; omitted fields are not overwritten.

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string? | no | Project name |
| `code` | string? | no | Project code |
| `address` | string? | no | Address |
| `prompt` | string? | no | Prompt |
| `region` | string? | no | Region |
| `assetType` | string? | no | Asset type |
| `floorLevels` | string? | no | Floor levels |
| `location` | string? | no | Location |
| `structureType` | string? | no | Structure type |

**Response**: `DefectProjectResponse`

---

### 5. Delete project

**`DELETE /api/defect-projects/{id}`**

Also deletes all Defect Files under the project and their content rows.

**Response**: `null`

---

# Part 2 — Defect File

**Base URL**: `/api/defect-files`

## Response shapes

### `DefectFileResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Record ID |
| `isProcessed` | string? | `PROCESSING` / `SUCCESS` / `FAIL` |
| `sourceFileUrl` | string? | Original file URL |
| `sourceFileName` | string? | Original file name |
| `sourceFileType` | string? | File type (e.g. `EXCEL`) |
| `sourceFileSize` | int? | Original file size (bytes) |
| `mergeFileUrl` | string? | Merged result file URL |
| `mergeFileName` | string? | Merged result file name |
| `mergeFileSize` | int? | Merged result file size (bytes) |
| `finishFileUrl` | string? | Final file URL |
| `finishFileName` | string? | Final file name |
| `finishFileSize` | int? | Final file size (bytes) |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `defectProjectId` | UUID? | Owning project ID |

---

## Endpoints

### 1. Get a single Defect File

**`GET /api/defect-files/{id}`**

**Response**: `DefectFileResponse`

---

### 2. List by project

**`GET /api/defect-files?projectId={projectId}`**

**Response**: `List<DefectFileResponse>`

---

### 3. Get processing status

**`GET /api/defect-files/{id}/status`**

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Record ID |
| `isProcessed` | string? | `PROCESSING` / `SUCCESS` / `FAIL` |
| `mergeFileUrl` | string? | Merge file URL when complete |
| `mergeFileName` | string? | Merge file name |
| `progressPercentage` | int? | Progress (0–99 while processing, 100 when done, `null` on failure) |

---

### 4. Presigned upload URL

**`GET /api/defect-files/presigned-url?fileName={fileName}`**

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `uploadUrl` | string | S3 presigned PUT URL; client uploads with PUT directly |
| `fileUrl` | string | Final access URL after upload |

---

### 5. Upload file

**`POST /api/defect-files/upload`** (`multipart/form-data`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | File | Excel file |

**Response**: `string` — S3 URL of the file

---

### 6. Save Excel content

**`POST /api/defect-files/saveExcelContent`**

Parses the Excel file and persists content rows to the database. Does not call SnapTable.

**Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `projectId` | UUID | yes | — | Project ID |
| `fileUrl` | string | yes | — | URL of the uploaded Excel file |
| `headerNum` | int | no | `1` | Header row number (1-based) |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `defectFileId` | UUID | New Defect File ID |
| `headers` | `string[]` | Parsed header column names |
| `rowCount` | int | Number of data rows |

---

### 7. Analyze Defect File (async)

**`POST /api/defect-files/analyze`**

Starts background async analysis (SnapTable fills categories, response strategies, reference lists; generates merged Excel). Returns immediately — poll with `GET /{id}/status`.

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defectFileId` | UUID | yes | ID returned by `/saveExcelContent` |
| `headersToMerge` | `string[]` | yes | Column names to concatenate into `defect_description` |

**Response**: `DefectFileResponse` (`isProcessed` = `PROCESSING`)

---

### 8. Get a single content row

**`GET /api/defect-files/content/{id}`**

**Response**: `DefectFileContentResponse` (includes `itemId`, `location`, `description`, `defectCategory`, `responseStrategy`, `refList`, `userChosenResponseStrategy`, `generatedResponse`, and related fields)

---

### 9. Paginated content rows

**`GET /api/defect-files/{id}/contents?page={page}&size={size}`**

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `content` | `DefectFileContentResponse[]` | Rows on this page |
| `totalElements` | long | Total row count |
| `totalPages` | int | Total pages |
| `currentPage` | int | Current page index (0-based) |
| `pageSize` | int | Page size |
| `hasNext` | boolean | Whether a next page exists |
| `hasPrevious` | boolean | Whether a previous page exists |

---

### 10. Batch update user-chosen response strategy

**`PUT /api/defect-files/content/user-chosen-response-strategy`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defectFileId` | UUID | yes | Owning Defect File ID |
| `itemIds` | `string[]` | yes | `itemId` values to update |
| `userChosenResponseStrategy` | string | yes | User-selected response strategy |

**Response**: `null`

---

### 11. Batch update generated response

**`PUT /api/defect-files/content/generated-response`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defectFileId` | UUID | yes | Owning Defect File ID |
| `itemIds` | `string[]` | yes | `itemId` values to update |
| `generatedResponse` | string | yes | Generated response text |

**Response**: `null`

---

### 12. Delete Defect File

**`DELETE /api/defect-files/{id}`**

Also deletes all content rows under this Defect File.

**Response**: `null`

---

### 13. Classification result

**`GET /api/defect-files/classification-result?projectId={projectId}`**

Calls the SnapTable classification API and returns the raw SnapTable response.

**Response**: Raw SnapTable payload

---

### 14. Generate response (knowledge-backed)

**`POST /api/defect-files/generate-response`**

Generates a draft defect response using the knowledge index for a Knowledge Folder (`knowledgeId`). Used for live analysis “Generate response” and response-agent testing. Reference PDFs in that folder should be indexed first (`GET /api/defect-reference-files/{id}/check-memory` → `status: "ready"`).

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Main question or defect text to answer |
| `knowledgeId` | UUID | yes | Knowledge ID from the linked Knowledge Folder (`DefectKnowledgeProjectResponse.knowledgeId`) |
| `messages` | `string[]` | yes | Conversation / context messages (often includes `query` and strategy hints) |

**Request example**

```json
{
  "query": "What are the fire egress requirements?",
  "knowledgeId": "your-knowledge-uuid",
  "messages": ["What are the fire egress requirements?"]
}
```

**Response**

The envelope may nest `result` more than once. The UI reads the innermost object that contains `answer` and `context_list`.

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the outer call succeeded |
| `message` | string | Status message (e.g. `"success"`) |
| `result` | object | Wrapper; may contain another `result` with the payload below |

**Inner payload** (under `result.result` or equivalent)

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | Generated response text |
| `reference_ids` | `int[]` | Reference indices cited in the answer |
| `context_list` | array | Retrieved knowledge snippets (see below) |
| `success` | boolean? | Inner success flag |
| `message` | string? | Inner message (e.g. `"succeed"`) |
| `time_cost` | number? | Processing time (seconds) |

**`context_list` item**

| Field | Type | Description |
|-------|------|-------------|
| `context` | string | Excerpt text from the source document |
| `file_id` | UUID | Reference file ID |
| `page_no` | int | Page number in the PDF |
| `score` | number | Relevance score |
| `reference_id` | int | Citation index in this response |

**Response example**

```json
{
  "result": {
    "result": {
      "answer": "The fire egress requirements are...",
      "reference_ids": [1, 2, 3],
      "context_list": [
        {
          "context": "Travel distance to a point of choice must not exceed 30m...",
          "file_id": "2583955c-e38d-4f74-851e-a053e6e57e21",
          "page_no": 75,
          "score": 0.58,
          "reference_id": 1
        }
      ],
      "success": true,
      "message": "succeed",
      "time_cost": 10.73
    },
    "success": true,
    "message": "success"
  }
}
```

> **Note**: Large requests or cold indexes may take several minutes. Clients should use a long timeout when proxying this endpoint.

---

## Recommended flow

```
1. POST /api/defect-projects                         → Create project; obtain projectId
2. GET  /api/defect-files/presigned-url?fileName=... → Get S3 presigned upload URL
3. PUT  {uploadUrl}                                   → Client uploads directly to S3
4. POST /api/defect-files/saveExcelContent           → Parse Excel; obtain defectFileId + headers
5. POST /api/defect-files/analyze                    → Start async analysis
6. GET  /api/defect-files/{id}/status                → Poll until progressPercentage = 100
7. GET  /api/defect-files/{id}                       → Read final mergeFileUrl
```

**Knowledge-backed draft response** (live analysis / response agents):

```
1. POST /api/defect-knowledge-projects              → Create Knowledge Folder; note knowledgeId
2. POST /api/defect-reference-files/save            → Upload reference PDFs
3. GET  /api/defect-reference-files/{id}/check-memory → Poll until status="ready"
4. POST /api/defect-agents                           → Save agent (strategy + prompt) linked to folder
5. POST /api/defect-files/generate-response          → query + knowledgeId + messages → answer
```

---

# Part 3 — Defect Knowledge Project (Knowledge Folder)

**Base URL**: `/api/defect-knowledge-projects`

> A Knowledge Folder belongs to one Defect Project and may contain multiple Reference Files and multiple Agents.

## Response shapes

### `DefectKnowledgeProjectResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Knowledge Folder ID |
| `knowledgeId` | UUID | Linked Knowledge ID |
| `projectId` | UUID | Owning Defect Project ID |
| `displayName` | string | Display name |
| `description` | string? | Description |
| `status` | string? | `PROCESSING` / `SUCCESS` / `FAIL` |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `updatedAt` | double? | Updated at (Unix timestamp) |

---

## Endpoints

### 1. Create

**`POST /api/defect-knowledge-projects`**

**Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `knowledgeId` | UUID | yes | — | Linked Knowledge ID |
| `projectId` | UUID | yes | — | Owning Defect Project ID |
| `displayName` | string | no | `""` | Display name |
| `description` | string? | no | `null` | Description |
| `status` | string? | no | `null` | Processing status |

**Response**: `DefectKnowledgeProjectResponse`

---

### 2. Get by ID

**`GET /api/defect-knowledge-projects/{id}`**

**Response**: `DefectKnowledgeProjectResponse`

---

### 3. List by project

**`GET /api/defect-knowledge-projects/by-project/{projectId}`**

**Response**: `List<DefectKnowledgeProjectResponse>`

---

### 4. List by knowledge

**`GET /api/defect-knowledge-projects/by-knowledge/{knowledgeId}`**

**Response**: `List<DefectKnowledgeProjectResponse>`

---

### 5. Update

**`PUT /api/defect-knowledge-projects/{id}`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `displayName` | string? | no | Display name |
| `description` | string? | no | Description |
| `status` | string? | no | Processing status |

**Response**: `DefectKnowledgeProjectResponse`

---

### 6. Delete

**`DELETE /api/defect-knowledge-projects/{id}`**

**Response**: `null`

---

# Part 4 — Defect Reference File

**Base URL**: `/api/defect-reference-files`

> Reference files for a Knowledge Folder — fully separate from Defect Files (inspection reports). One Knowledge Folder may contain multiple Reference Files.

## Response shapes

### `DefectReferenceFileResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Reference File ID |
| `defectKnowledgeProjectId` | UUID? | Owning Knowledge Folder ID |
| `isProcessed` | string? | `PROCESSING` / `SUCCESS` / `FAIL` |
| `sourceFileUrl` | string? | Original file URL |
| `sourceFileName` | string? | Original file name |
| `sourceFileType` | string? | File type |
| `sourceFileSize` | int? | Original file size (bytes) |
| `mergeFileUrl` | string? | Azure SAS URL returned by AI `POST /upload/memory` (for upload) |
| `mergeFileName` | string? | Merge file name |
| `mergeFileSize` | int? | Merge file size (bytes) |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |

---

## Endpoints

### 1. Presigned upload URL

**`GET /api/defect-reference-files/presigned-url?fileName={fileName}`**

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `uploadUrl` | string | S3 presigned PUT URL; client uploads with PUT directly |
| `fileUrl` | string | Final access URL after upload |

---

### 2. Upload file

**`POST /api/defect-reference-files/upload`** (`multipart/form-data`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | File | Reference file |

**Response**: `string` — S3 URL of the file

---

### 3. Batch save Reference Files

**`POST /api/defect-reference-files/save`**

After save completes, the backend asynchronously calls AI `POST /upload/memory` for each file, obtains an Azure SAS URL, and stores it in `mergeFileUrl`.

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defectKnowledgeProjectId` | UUID | yes | Owning Knowledge Folder ID |
| `files` | `SaveReferenceFileItem[]` | yes | File list |

**`SaveReferenceFileItem`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceFileUrl` | string | yes | File URL (S3 or other accessible address) |
| `sourceFileName` | string? | no | File name |
| `sourceFileType` | string? | no | File type (e.g. `PDF`, `EXCEL`) |
| `sourceFileSize` | int? | no | File size (bytes) |

**Response**: `List<DefectReferenceFileResponse>`

**Example**

```json
// Request
{
  "defectKnowledgeProjectId": "folder-uuid",
  "files": [
    {
      "sourceFileUrl": "https://bucket.s3.amazonaws.com/spec.pdf",
      "sourceFileName": "spec.pdf",
      "sourceFileType": "PDF",
      "sourceFileSize": 204800
    }
  ]
}

// Response
{
  "code": 200,
  "data": [
    {
      "id": "ref-file-uuid-1",
      "defectKnowledgeProjectId": "folder-uuid",
      "isProcessed": null,
      "sourceFileUrl": "https://bucket.s3.amazonaws.com/spec.pdf",
      "sourceFileName": "spec.pdf",
      "mergeFileUrl": null
    }
  ]
}
```

> **Note**: `mergeFileUrl` is not populated immediately in this response; it is filled asynchronously in the background. Poll indexing status with `GET /{id}/check-memory`.

---

### 4. Check AI indexing status

**`GET /api/defect-reference-files/{id}/check-memory`**

Calls AI `GET /check/memory?file_id={id}`. If the response has `status: "ready"`, the DB record’s `isProcessed` is updated to `SUCCESS`.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Reference File ID |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `file_id` | string | File ID |
| `status` | string | `not_found` (indexing) / `ready` (complete) |
| `chunk_count` | int | Number of indexed chunks |
| `chunks` | array | Chunk detail list |

**Examples**

```json
// Indexing in progress
{ "code": 200, "data": { "file_id": "ref-file-uuid-1", "status": "not_found", "chunk_count": 0, "chunks": [] } }

// Complete (DB isProcessed updated to SUCCESS)
{ "code": 200, "data": { "file_id": "ref-file-uuid-1", "status": "ready", "chunk_count": 24, "chunks": [...] } }
```

---

### 5. Get by ID

**`GET /api/defect-reference-files/{id}`**

**Response**: `DefectReferenceFileResponse`

---

### 6. List by Knowledge Folder

**`GET /api/defect-reference-files/by-knowledge-project/{knowledgeProjectId}`**

**Response**: `List<DefectReferenceFileResponse>`

---

### 7. Create single file

**`POST /api/defect-reference-files`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `defectKnowledgeProjectId` | UUID? | no | Owning Knowledge Folder ID |
| `sourceFileUrl` | string | yes | File URL |
| `sourceFileName` | string? | no | File name |
| `sourceFileType` | string? | no | File type |
| `sourceFileSize` | int? | no | File size (bytes) |

**Response**: `DefectReferenceFileResponse`

---

### 8. Update

**`PUT /api/defect-reference-files/{id}`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mergeFileUrl` | string? | no | Azure SAS URL or final file URL |
| `mergeFileName` | string? | no | File name |
| `mergeFileSize` | int? | no | File size (bytes) |
| `isProcessed` | string? | no | `PROCESSING` / `SUCCESS` / `FAIL` |

**Response**: `DefectReferenceFileResponse`

---

### 9. Delete

**`DELETE /api/defect-reference-files/{id}`**

**Response**: `null`

---

## Reference File recommended flow

```
1. GET  /api/defect-reference-files/presigned-url?fileName=...  → Get S3 presigned upload URL
2. PUT  {uploadUrl}                                              → Client uploads directly to S3
3. POST /api/defect-reference-files/save                        → Batch save; backend calls AI /upload/memory
4. GET  /api/defect-reference-files/{id}/check-memory           → Poll until status="ready"
```

---

# Part 5 — Defect Agent

**Base URL**: `/api/defect-agents`

> An Agent belongs to one Knowledge Folder.

## Response shapes

### `DefectAgentResponse`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Agent ID |
| `defectKnowledgeProjectId` | UUID? | Owning Knowledge Folder ID |
| `userChosenResponseStrategy` | string | User-selected response strategy |
| `prompt` | string | Agent prompt |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `updatedAt` | double? | Updated at (Unix timestamp) |

---

## Endpoints

### 1. Create (save Agent)

**`POST /api/defect-agents`**

**Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `defectKnowledgeProjectId` | UUID | yes | — | Owning Knowledge Folder ID |
| `userChosenResponseStrategy` | string | no | `""` | User-selected response strategy |
| `prompt` | string | no | `""` | Agent prompt |

**Response**: `DefectAgentResponse`

**Example**

```json
// Request
{
  "defectKnowledgeProjectId": "folder-uuid",
  "userChosenResponseStrategy": "Repair and monitor",
  "prompt": "You are a building defect expert..."
}

// Response
{
  "code": 200,
  "data": {
    "id": "agent-uuid",
    "defectKnowledgeProjectId": "folder-uuid",
    "userChosenResponseStrategy": "Repair and monitor",
    "prompt": "You are a building defect expert...",
    "createdAt": 1714800000.0,
    "createdAtHk": "2024-05-04 12:00:00",
    "updatedAt": 0.0
  }
}
```

---

### 2. Get by ID

**`GET /api/defect-agents/{id}`**

**Response**: `DefectAgentResponse`

---

### 3. List by Knowledge Folder

**`GET /api/defect-agents/by-knowledge-project/{knowledgeProjectId}`**

**Response**: `List<DefectAgentResponse>`

---

### 4. Update

**`PUT /api/defect-agents/{id}`**

**Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userChosenResponseStrategy` | string? | no | User-selected response strategy |
| `prompt` | string? | no | Agent prompt |

**Response**: `DefectAgentResponse`

---

### 5. Delete

**`DELETE /api/defect-agents/{id}`**

**Response**: `null`
