# Image Integration Testing Rules

- Always use base64-encoded images for all tests/requests.
- Accepted formats: JPEG, PNG, WEBP only. No SVG/BMP/HEIC.
- Do not use blank/solid-color images. Must contain real visual features (objects, edges, text, UI).
- If not PNG/JPEG/WEBP, transcode to PNG/JPEG before upload and update MIME.
- For animated images, extract first frame only.
- Resize oversized images to reasonable bounds.

Endpoint: POST /api/generate (auth required, cookie)
Body: { "image_base64": "<base64 no prefix>", "framework": "HTML/CSS", "styling": "Tailwind CSS", "prompt": "" }
Returns: { id, code, language, image_base64, framework, ... }
