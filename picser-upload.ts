/**
 * Browser-side uploader for Picser (https://picser.pages.dev/api-docs).
 *
 * Picser uploads an image into a GitHub repository and serves it back through
 * the jsDelivr CDN, returning permanent commit-pinned URLs.
 *
 * Unlike jscord-storage, Picser requires GitHub credentials (a personal access
 * token, owner and repo). These are read from localStorage so they never have
 * to be hard-coded:
 *
 *   localStorage.setItem('picser_github_token', 'ghp_xxx')
 *   localStorage.setItem('picser_github_owner', 'your-username')
 *   localStorage.setItem('picser_github_repo',  'your-image-repo')
 *   localStorage.setItem('picser_github_branch','main')      // optional
 *   localStorage.setItem('picser_folder',       'uploads')   // optional
 *
 * As with Discord, Turso NEVER stores image bytes — only the resulting URL.
 */

const PICSER_UPLOAD_URL = "https://picser.pages.dev/api/public-upload";

export type PicserConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  folder: string;
};

export type PicserUploadResult = {
  success: boolean;
  url: string;
  raw: any;
};

/** Read Picser GitHub credentials from localStorage (browser only). */
export function getPicserConfig(): PicserConfig | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const token = localStorage.getItem("picser_github_token") || "";
    const owner = localStorage.getItem("picser_github_owner") || "";
    const repo = localStorage.getItem("picser_github_repo") || "";
    const branch = localStorage.getItem("picser_github_branch") || "main";
    const folder = localStorage.getItem("picser_folder") || "uploads";
    if (!token || !owner || !repo) return null;
    return { token, owner, repo, branch, folder };
  } catch {
    return null;
  }
}

/** True when valid Picser credentials are present. */
export function isPicserConfigured(): boolean {
  return getPicserConfig() !== null;
}

/** Pull the best (permanent, CDN) URL from a Picser response. */
function pickPicserUrl(data: any): string {
  if (!data || typeof data !== "object") return "";
  const urls = data.urls || {};
  // Prefer the permanent, commit-pinned jsDelivr CDN URL.
  return (
    urls.jsdelivr_commit ||
    urls.jsdelivr ||
    data.url ||
    urls.raw_commit ||
    urls.raw ||
    ""
  );
}

/**
 * Upload a File / Blob to Picser. Returns `{ success, url }`.
 * Caller should verify `isPicserConfigured()` first; if creds are missing this
 * resolves with `success: false`.
 */
export async function uploadImageToPicser(file: File | Blob, filename?: string): Promise<PicserUploadResult> {
  const config = getPicserConfig();
  if (!config) {
    return { success: false, url: "", raw: { error: "Picser not configured" } };
  }

  const ext = (file.type || "image/jpeg").split("/")[1] || "jpg";
  const safeName =
    filename ||
    (file instanceof File && file.name) ||
    `nudgel-img-${Date.now()}.${ext}`;

  const form = new FormData();
  form.append("file", file, safeName);
  form.append("github_token", config.token);
  form.append("github_owner", config.owner);
  form.append("github_repo", config.repo);
  form.append("github_branch", config.branch);
  form.append("folder", config.folder);

  try {
    const res = await fetch(PICSER_UPLOAD_URL, {
      method: "POST",
      body: form,
    });

    const text = await res.text().catch(() => "");
    console.log("[picser-upload] Status:", res.status, "Body:", text.slice(0, 500));

    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }

    const url = pickPicserUrl(raw);
    if (url) {
      console.log("[picser-upload] URL extracted:", url);
      return { success: true, url, raw };
    }

    console.warn("[picser-upload] Could not extract URL. Raw:", raw);
    return { success: false, url: "", raw };
  } catch (err) {
    console.error("[picser-upload] Upload error:", err);
    return { success: false, url: "", raw: { error: String(err) } };
  }
}
