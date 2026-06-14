/**
 * Browser-side uploader for UploadMe (https://uploadme.me/page/api/).
 *
 * UploadMe is a Chevereto-style image host. It only needs an API key (a public
 * one is provided by the service), so it works with zero per-user setup — making
 * it a great second zero-config provider alongside Discord.
 *
 * Endpoint:  POST https://uploadme.me/api/1/upload
 * Fields:    key=<api key>, source=<file>, format=json
 *
 * As always, Turso never stores image bytes — only the returned URL.
 */

const UPLOADME_URL = "https://uploadme.me/api/1/upload";

// Public API key published in UploadMe's own API docs example.
// Users can override it with localStorage.setItem('uploadme_api_key', '...').
const DEFAULT_UPLOADME_KEY = "cb5997837f6df0a90464b65899fbc7d5";

export type UploadMeResult = {
  success: boolean;
  url: string;
  raw: any;
};

function getKey(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const custom = localStorage.getItem("uploadme_api_key");
      if (custom) return custom;
    }
  } catch { /* ignore */ }
  return DEFAULT_UPLOADME_KEY;
}

/** Extract the served image URL from a Chevereto-style response. */
function pickUploadMeUrl(data: any): string {
  if (!data) return "";
  if (typeof data === "string") {
    return data.startsWith("https://") ? data.trim() : "";
  }
  const img = data.image || {};
  return (
    img.url ||
    img.display_url ||
    (img.image && img.image.url) ||
    (img.thumb && img.thumb.url) ||
    data.url ||
    ""
  );
}

/**
 * Upload a File / Blob to UploadMe. Returns `{ success, url }`.
 */
export async function uploadImageToUploadMe(file: File | Blob, filename?: string): Promise<UploadMeResult> {
  const ext = (file.type || "image/jpeg").split("/")[1] || "jpg";
  const safeName =
    filename ||
    (file instanceof File && file.name) ||
    `nudgel-img-${Date.now()}.${ext}`;

  const form = new FormData();
  form.append("key", getKey());
  form.append("source", file, safeName);
  form.append("format", "json");

  try {
    const res = await fetch(UPLOADME_URL, {
      method: "POST",
      body: form,
    });

    const text = await res.text().catch(() => "");
    console.log("[uploadme-upload] Status:", res.status, "Body:", text.slice(0, 500));

    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    const url = pickUploadMeUrl(raw);
    if (url) {
      console.log("[uploadme-upload] URL extracted:", url);
      return { success: true, url, raw };
    }

    console.warn("[uploadme-upload] Could not extract URL. Raw:", raw);
    return { success: false, url: "", raw };
  } catch (err) {
    console.error("[uploadme-upload] Upload error:", err);
    return { success: false, url: "", raw: { error: String(err) } };
  }
}
