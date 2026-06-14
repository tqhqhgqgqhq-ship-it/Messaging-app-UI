/**
 * Browser-side uploader for jscord-storage
 * (https://github.com/animemoeus/jscord-storage).
 *
 * The npm package itself relies on Node's `fs` module, so it cannot run in the
 * browser. Instead we call the same HTTP endpoint that the library uses under
 * the hood: https://discord-storage.animemoe.us/api/upload-from-file/
 *
 * Images are stored on Discord via this service. Turso is NEVER used to hold
 * image binary data — only the resulting URL string is persisted (as the
 * existing message `text` column) so that the chat UI can render it.
 */

const UPLOAD_URL = "https://discord-storage-serverless.animemoe.us/";

export type JscordUploadResult = {
  success: boolean;
  url: string;
  raw: any;
};

/**
 * Deep search for a valid Discord CDN URL inside a mixed JSON response.
 * Handles all known jscord-storage / Discord API response shapes.
 */
function pickUrl(data: any, depth = 0): string {
  if (!data || depth > 6) return "";

  // Primitive: direct URL string
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (
      trimmed.startsWith("https://cdn.discordapp.com/") ||
      trimmed.startsWith("https://media.discordapp.net/") ||
      trimmed.startsWith("https://images-ext-") ||
      trimmed.startsWith("https://discord.com/") ||
      trimmed.startsWith("https://cdn.discord.com/")
    ) {
      return trimmed;
    }
    return "";
  }

  // Array: check each element
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = pickUrl(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  // Plain object: check common URL field names at this level
  const candidates = [
    "url", "cdn_url", "cdnUrl", "image_url", "imageUrl",
    "proxy_url", "proxyUrl", "src", "link", "href",
    "file", "file_url", "fileUrl", "download_url", "downloadUrl",
    "content_url", "contentUrl",
  ];
  for (const key of candidates) {
    if (data[key] && typeof data[key] === "string") {
      const val: string = data[key];
      if (val.startsWith("https://")) return val;
    }
  }

  // Recurse into known container keys
  const containers = ["data", "result", "upload", "file", "attachment", "attachments", "response", "body", "res", "value"];
  for (const key of containers) {
    if (data[key] != null) {
      const found = pickUrl(data[key], depth + 1);
      if (found) return found;
    }
  }

  // Iterate all own properties (last resort for nested structures)
  if (typeof data === "object") {
    for (const key of Object.keys(data)) {
      if (key === "constructor" || key === "prototype") continue;
      const found = pickUrl(data[key], depth + 1);
      if (found) return found;
    }
  }

  return "";
}

/**
 * Upload a File / Blob from the browser to jscord-storage.
 * Returns `{ success, url }` mirroring the npm package's response shape.
 */
export async function uploadImageFile(
  file: File | Blob,
  _filename?: string,
  onProgress?: (pct: number) => void,
): Promise<JscordUploadResult> {
  // Backward-compat: if (file, callback) was passed, swap args.
  if (typeof _filename === "function" && onProgress === undefined) {
    onProgress = _filename as unknown as (pct: number) => void;
    _filename = undefined;
  }
  const form = new FormData();
  const ext = (file.type || "image/jpeg").split("/")[1] || "jpg";
  const safeName =
    (file instanceof File && file.name) ||
    `nudgel-img-${Date.now()}.${ext}`;
  form.append("file", file, safeName);

  try {
    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      body: form,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      redirect: "follow",
    });
    console.log("[jscord-upload] Final URL after redirects:", res.url);

    // Read as text first so we can handle both JSON and plain-text responses
    const text = await res.text().catch(() => "");
    console.log("[jscord-upload] Status:", res.status, "Body:", text.slice(0, 500));

    let raw: any;
    // Try parsing as JSON; fall back to raw text
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    // If raw is still a string, check if it's a direct URL
    if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (
        trimmed.startsWith("https://cdn.discordapp.com/") ||
        trimmed.startsWith("https://media.discordapp.net/") ||
        trimmed.startsWith("https://images-ext-")
      ) {
        console.log("[jscord-upload] Direct URL found in body:", trimmed);
        return { success: true, url: trimmed, raw };
      }
    }

    const url = pickUrl(raw);
    if (url) {
      console.log("[jscord-upload] URL extracted:", url);
      return { success: true, url, raw };
    }

    console.warn("[jscord-upload] Could not extract URL. Full raw:", JSON.stringify(raw).slice(0, 300));
    return { success: false, url: "", raw };
  } catch (err) {
    console.error("[jscord-upload] Upload error:", err);
    return { success: false, url: "", raw: { error: String(err) } };
  }
}

/* ============================ MESSAGE ENCODING ============================
 * Images travel through the existing messaging pipeline (Turso `messages.text`).
 * We tag image messages with a small marker so the renderer can tell them apart
 * from normal text without any schema changes.
 *
 *   Plain text          ->  "Hello there"
 *   Image (legacy)       ->  "[img]https://cdn.discordapp.com/..."
 *   Image (with host)    ->  "[img]discord::https://cdn.discordapp.com/..."
 *
 * The optional "<provider>::" prefix lets the chat UI show which backend served
 * the image (Discord / Picser / UploadMe) — reported straight from the upload
 * response, surviving the Turso round-trip.
 */

export const IMAGE_PREFIX = "[img]";
const PROVIDER_SEP = "::";

export function encodeImageMessage(url: string, provider?: string): string {
  if (provider) return `${IMAGE_PREFIX}${provider}${PROVIDER_SEP}${url}`;
  return `${IMAGE_PREFIX}${url}`;
}

export function isImageMessage(text: string): boolean {
  return typeof text === "string" && text.startsWith(IMAGE_PREFIX);
}

export function decodeImageMessage(text: string): string {
  if (!isImageMessage(text)) return "";
  const body = text.slice(IMAGE_PREFIX.length);
  const sepIdx = body.indexOf(PROVIDER_SEP);
  // Only treat as "provider::url" when the part before "::" is NOT a URL scheme.
  if (sepIdx > 0) {
    const head = body.slice(0, sepIdx);
    if (!head.includes("/") && !head.startsWith("http")) {
      return body.slice(sepIdx + PROVIDER_SEP.length);
    }
  }
  return body;
}

/** Returns the provider label embedded in an image message, or "" if none. */
export function decodeImageProvider(text: string): string {
  if (!isImageMessage(text)) return "";
  const body = text.slice(IMAGE_PREFIX.length);
  const sepIdx = body.indexOf(PROVIDER_SEP);
  if (sepIdx > 0) {
    const head = body.slice(0, sepIdx);
    if (!head.includes("/") && !head.startsWith("http")) {
      return head;
    }
  }
  return "";
}
