# S3 CORS for live/historical Excel uploads

Excel files upload with:

1. `POST /api/upload-xlsx/presign` (metadata only — no file through Vercel)
2. **Browser `PUT`** to the presigned `uploadUrl` (direct to `AWS_S3_BUCKET`, e.g. `billie-defect-analysis`)
3. `POST /api/upload-xlsx/complete` (mint presigned GET URL for the analysis server)
4. `POST /api/save-excel-content` with `fileUrl`

Large files (e.g. 23MB) **must** use step 2 in the browser. Vercel returns `FUNCTION_PAYLOAD_TOO_LARGE` if the `.xlsx` is sent to `/api/upload-xlsx`.

## Example CORS (S3 console → bucket → Permissions → CORS)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "https://pcdi-ui.vercel.app",
      "https://*.vercel.app",
      "http://127.0.0.1:3333",
      "http://localhost:3333"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

IAM for `AWS_ACCESS_KEY_ID` in Vercel must allow `s3:PutObject` and `s3:GetObject` on this bucket.
