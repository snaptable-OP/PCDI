# S3 CORS for knowledge-folder PDF uploads

The app uploads reference PDFs with:

1. `GET /api/defect-reference-files/presigned-url` (via this Next.js app)
2. **Browser `PUT`** to the presigned `uploadUrl` (direct to S3 bucket `billie-defect-reference-file`)
3. `POST /api/defect-reference-files/save` (metadata only)

If step 2 fails with **"Could not upload directly to storage"**, the bucket needs CORS.

## Example CORS configuration (AWS S3 console)

Bucket: **billie-defect-reference-file** (or whatever Billie uses for reference files).

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

Adjust origins to match your production and preview URLs.

## Fallback (no CORS)

Files **≤ 4MB** can use `POST /api/defect-reference-files/s3-put` (server PUT) when the UI detects a browser CORS/network failure. Larger files **require** bucket CORS or a backend change.
