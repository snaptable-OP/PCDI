# Defect File API reference

**Base URL**: `/api/defect-files`

All endpoints return a uniform envelope:

```json
{
  "code": 200,
  "data": { ... }
}
```

---

## Common response shape

### `DefectFileResponse`

| Field | Type | Description |
|------|------|-------------|
| `id` | UUID | Record ID |
| `isProcessed` | string | Processing state: `PROCESSING` / `SUCCESS` / `FAIL` |
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
| `createdAtHk` | string? | Created at (Hong Kong time, string) |
| `defectProjectId` | UUID? | Owning project ID |

---

## Endpoints

---

### 1. Get a single defect file

**`GET /{id}`**

Returns an existing record from the database by ID. Does not trigger any processing.

**Path parameters**

| Parameter | Type | Description |
|------|------|-------------|
| `id` | UUID | Defect file ID |

**Response**: `DefectFileResponse`

**Example**

```
GET /api/defect-files/3fa85f64-5717-4562-b3fc-2c963f66afa6
```

```json
{
  "code": 200,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "isProcessed": "SUCCESS",
    "sourceFileUrl": "https://bucket.s3.ap-east-1.amazonaws.com/source.xlsx",
    "sourceFileName": "source.xlsx",
    "sourceFileType": "EXCEL",
    "mergeFileUrl": "https://bucket.s3.ap-east-1.amazonaws.com/defect_merge_xxx.xlsx",
    "mergeFileName": "defect_merge_xxx.xlsx",
    "mergeFileSize": 20480,
    "defectProjectId": "abc12345-0000-0000-0000-000000000000",
    "createdAt": 1714800000.0,
    "createdAtHk": "2024-05-04 12:00:00"
  }
}
```

---

### 2. List defect files by project

**`GET /?projectId={projectId}`**

**Query parameters**

| Parameter | Type | Required | Description |
|------|------|------|------|
| `projectId` | UUID | Yes | Project ID |

**Response**: `List<DefectFileResponse>`

**Example**

```
GET /api/defect-files?projectId=abc12345-0000-0000-0000-000000000000
```

```json
{
  "code": 200,
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "isProcessed": "SUCCESS",
      "mergeFileUrl": "https://bucket.s3.ap-east-1.amazonaws.com/defect_merge_xxx.xlsx",
      ...
    }
  ]
}
```

---

### 3. Check processing status

**`GET /{id}/status`**

Poll processing progress for a defect file.

**Path parameters**

| Parameter | Type | Description |
|------|------|-------------|
| `id` | UUID | Defect file ID |

**Response**

| Field | Type | Description |
|------|------|-------------|
| `id` | UUID | Record ID |
| `isProcessed` | string | `PROCESSING` / `SUCCESS` / `FAIL` |
| `mergeFileUrl` | string? | Merged file URL after completion |
| `mergeFileName` | string? | Merged file name |
| `progressPercentage` | int? | Progress (0–99 while processing, 100 when complete, `null` on failure) |

**Example**

```
GET /api/defect-files/3fa85f64-5717-4562-b3fc-2c963f66afa6/status
```

```json
{
  "code": 200,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "isProcessed": "PROCESSING",
    "mergeFileUrl": null,
    "mergeFileName": null,
    "progressPercentage": 66
  }
}
```


### 6. Save Excel content

**`POST /saveExcelContent`**

Parses the Excel file and persists content rows to the database; returns header column names and row count. Does not call SnapTable.

**Body**

| Field | Type | Required | Description |
|------|------|------|------|
| `projectId` | UUID | Yes | Project ID |
| `fileUrl` | string | Yes | URL of the uploaded Excel file |
| `headerNum` | int | No (default `1`) | Row number of the header row (1-based) |

**Response**

| Field | Type | Description |
|------|------|-------------|
| `defectFileId` | UUID | New defect file ID for subsequent analysis calls |
| `headers` | `string[]` | Parsed header column names |
| `rowCount` | int | Number of data rows parsed |

**Example**

```json
// Request
{
  "projectId": "abc12345-0000-0000-0000-000000000000",
  "fileUrl": "https://bucket.s3.ap-east-1.amazonaws.com/1714800000_report.xlsx",
  "headerNum": 2
}

// Response
{
  "code": 200,
  "data": {
    "defectFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "headers": ["Item No", "Location", "QA Item Description", "Defect Type", "Status"],
    "rowCount": 120
  }
}
```

---

### 7. Analyze defect file (async)

**`POST /analyze`**

Triggers background async analysis: calls SnapTable to fill categories, response strategies, and reference lists; builds a merged Excel and uploads it to S3. Returns immediately; use `GET /{id}/status` to poll progress, then `GET /{id}` for `mergeFileUrl` when done.

**Body**

| Field | Type | Required | Description |
|------|------|------|------|
| `defectFileId` | UUID | Yes | ID returned by `/saveExcelContent` |
| `headersToMerge` | `string[]` | Yes | Original column names to concatenate into `defect_description` (from `headers` returned by `/saveExcelContent`) |

**Response**: `DefectFileResponse` (typically `isProcessed` is `PROCESSING` at this point)

**Example**

```json
// Request
{
  "defectFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "headersToMerge": ["QA Item Description", "Location"]
}

// Response
{
  "code": 200,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "isProcessed": "PROCESSING",
    "mergeFileUrl": null,
    ...
  }
}
```

---

### 8. Get a single defect file content row

**`GET /content/{id}`**

Returns detail for one `DefectFileContent` row, including analysis fields.

**Path parameters**

| Parameter | Type | Description |
|------|------|-------------|
| `id` | UUID | DefectFileContent row ID |

**Response**

| Field | Type | Description |
|------|------|-------------|
| `id` | UUID | Content row ID |
| `defectFileId` | UUID | Owning defect file ID |
| `itemId` | string | Item number |
| `location` | string | Location |
| `description` | string | Defect description |
| `descriptionImages` | `string[]` | Defect image URLs |
| `defectType` | string | Defect type |
| `response` | string | On-site response |
| `responseImages` | `string[]` | Response / acceptance image URLs |
| `status` | string | Status |
| `action` | string | Action taken |
| `comments` | string | Comments |
| `dateInspect` | double | Inspection date (Unix timestamp) |
| `categoryLevel1` | string | Category level 1 |
| `categoryLevel2` | string | Category level 2 |
| `defectCategory` | string | Defect category filled by SnapTable |
| `responseStrategy` | `string[]` | Response strategies filled by SnapTable |
| `refList` | `string[]` | Reference list filled by SnapTable |
| `mergeInfo` | string | Merge info |
| `isProcessed` | string? | Processing state |
| `userChosenResponseStrategy` | string | User-selected response strategy |
| `rowNumber` | string | Source row number (1-based, includes header in the count) |
| `createdAt` | double? | Created at (Unix timestamp) |
| `createdAtHk` | string? | Created at (Hong Kong time) |
| `updatedAt` | double? | Updated at (Unix timestamp) |

---

### 9. Paginated list of content rows for a defect file

**`GET /{id}/contents`**

Returns content rows for the given defect file with full analysis fields (including `userChosenResponseStrategy`, `rowNumber`).

**Path parameters**

| Parameter | Type | Description |
|------|------|-------------|
| `id` | UUID | Defect file ID |

**Query parameters**

| Parameter | Type | Required | Default | Description |
|------|------|------|--------|------|
| `page` | int | No | `0` | Page index (0-based) |
| `size` | int | No | `20` | Page size |

**Response**

| Field | Type | Description |
|------|------|-------------|
| `content` | `DefectFileContentResponse[]` | Rows on this page (same fields as section 8) |
| `totalElements` | long | Total row count |
| `totalPages` | int | Total pages |
| `currentPage` | int | Current page index (0-based) |
| `pageSize` | int | Page size |
| `hasNext` | boolean | Whether a next page exists |
| `hasPrevious` | boolean | Whether a previous page exists |

**Example**

```
GET /api/defect-files/3fa85f64-5717-4562-b3fc-2c963f66afa6/contents?page=0&size=20
```

```json
{
  "code": 200,
  "data": {
    "content": [
      {
        "id": "aaa00000-0000-0000-0000-000000000001",
        "defectFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "itemId": "D-001",
        "location": "B1F Carpark",
        "description": "Crack on wall",
        "defectType": "Structural",
        "responseStrategy": ["Repair", "Monitor"],
        "userChosenResponseStrategy": "Repair",
        ...
      }
    ],
    "totalElements": 120,
    "totalPages": 6,
    "currentPage": 0,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### 10. Batch update user-selected response strategy

**`PUT /content/user-chosen-response-strategy`**

Sets the user-selected response strategy for multiple rows (by `itemId`) under a defect file.

**Body**

| Field | Type | Required | Description |
|------|------|------|------|
| `defectFileId` | UUID | Yes | Owning defect file ID |
| `itemIds` | `string[]` | Yes | `itemId` values to update |
| `userChosenResponseStrategy` | string | Yes | User-selected response strategy |

**Response**: `null` (`data` is `null` on success)

**Example**

```json
// Request
{
  "defectFileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "itemIds": ["D-001", "D-002", "D-005"],
  "userChosenResponseStrategy": "Repair"
}

// Response
{
  "code": 200,
  "data": null
}
```

---

## Recommended flow

```
1. GET  /presigned-url?fileName=xxx.xlsx     → Get presigned upload URL
2. PUT  {uploadUrl} (browser uploads directly to S3)
3. POST /saveExcelContent                    → Save content; receive defectFileId + headers
4. POST /analyze                             → Start async analysis (defectFileId + headersToMerge)
5. GET  /{id}/status                         → Poll until progressPercentage = 100; obtain mergeFileUrl

To retrieve the same outputs later, use the same project. This endpoint lists every defect file under the project, each with its mergeFileUrl:
6. GET /?projectId={projectId}               → Pick a defect file and read its final mergeFileUrl
```
# Defect Project API

**Base URL**: `/api/defect-projects`

All endpoints return a unified envelope:

```json
{
  "code": 200,
  "data": { ... }
}
```

---

## Shared response shape

### `DefectProjectResponse`

| Field          | Type      | Description                                              |
|----------------|-----------|----------------------------------------------------------|
| `id`           | UUID      | Project ID                                               |
| `name`         | string    | Project name                                             |
| `code`         | string    | Project code                                             |
| `address`      | string?   | Project address                                          |
| `prompt`       | string    | Custom prompt                                            |
| `region`       | string    | Region                                                   |
| `createdAt`    | double?   | Created at (Unix timestamp)                              |
| `createdAtHk`  | string?   | Created at (Hong Kong time, string)                      |
| `isDeleted`    | boolean   | Whether the project is deleted                           |

---

## Endpoints

---

### 1. List all projects

**`GET /`**

Returns all Defect Projects that are not deleted.

**Response**: `List<DefectProjectResponse>`

**Example**

```
GET /api/defect-projects
```

```json
{
  "code": 200,
  "data": [
    {
      "id": "abc12345-0000-0000-0000-000000000000",
      "name": "Marina Bay Tower",
      "code": "MBT-2024",
      "address": "1 Marina Bay, Singapore",
      "prompt": "",
      "region": "Singapore",
      "createdAt": 1714800000.0,
      "createdAtHk": "2024-05-04 12:00:00",
      "isDeleted": false
    }
  ]
}
```

---

### 2. Create a project

**`POST /`**

**Body**

| Field     | Type     | Required | Default | Description   |
|-----------|----------|----------|---------|---------------|
| `name`    | string   | yes      | —       | Project name  |
| `code`    | string   | no       | `""`    | Project code  |
| `address` | string?  | no       | `null`  | Project address |
| `prompt`  | string   | no       | `""`    | Custom prompt |
| `region`  | string   | no       | `""`    | Region        |

**Response**: `DefectProjectResponse`

**Example**

```json
// Request
{
  "name": "Marina Bay Tower",
  "code": "MBT-2024",
  "address": "1 Marina Bay, Singapore",
  "region": "Singapore"
}

// Response
{
  "code": 200,
  "data": {
    "id": "abc12345-0000-0000-0000-000000000000",
    "name": "Marina Bay Tower",
    "code": "MBT-2024",
    "address": "1 Marina Bay, Singapore",
    "prompt": "",
    "region": "Singapore",
    "createdAt": 1714800000.0,
    "createdAtHk": "2024-05-04 12:00:00",
    "isDeleted": false
  }
}
```

---

### 3. Update a project

**`PUT /{id}`**

Only fields present in the request body are updated; omitted fields are left unchanged.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id`      | UUID | Project ID  |

**Body**

| Field     | Type     | Required | Description   |
|-----------|----------|----------|---------------|
| `name`    | string?  | no       | Project name  |
| `code`    | string?  | no       | Project code  |
| `address` | string?  | no       | Project address |
| `prompt`  | string?  | no       | Custom prompt |
| `region`  | string?  | no       | Region        |

**Response**: `DefectProjectResponse`

**Example**

```json
// Request
PUT /api/defect-projects/abc12345-0000-0000-0000-000000000000
{
  "prompt": "Focus on structural defects only."
}

// Response
{
  "code": 200,
  "data": {
    "id": "abc12345-0000-0000-0000-000000000000",
    "name": "Marina Bay Tower",
    "code": "MBT-2024",
    "prompt": "Focus on structural defects only.",
    ...
  }
}
```

---

### 4. Delete a project

**`DELETE /{id}`**

Soft delete: sets `isDeleted` to `true`, and deletes all Defect Files under the project together with their content rows.

**Path parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id`      | UUID | Project ID  |

**Response**: `null` (`data` is `null` on success)

**Example**

```
DELETE /api/defect-projects/abc12345-0000-0000-0000-000000000000
```

```json
{
  "code": 200,
  "data": null
}
```
