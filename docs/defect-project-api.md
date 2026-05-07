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
