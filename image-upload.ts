/**
 * Hybrid image uploader — STRICT ROUND-ROBIN.
 *
 * Rotates uploads across hosts in a fixed, deterministic order:
 *
 *   1st image  →  Discord
 *   2nd image  →  UploadMe
 *   3rd image  →  Picser     (skipped if not configured → falls to Discord)
 *   4th image  →  Discord
 *   5th image  →  UploadMe
 *   6th image  →  Picser
 *   ...
 *
 * If the scheduled host fails, the others are tried as fallback.
 * The provider that actually served the image is reported back so the chat
 * UI can show "Hosted on Discord / UploadMe / Picser" straight from the
 * real backend response.
 *
 * Turso only ever stores the URL string — never image bytes.
 */

import { uploadImageFile as uploadToDiscord } from "./jscord-upload";
import { uploadImageToPicser, isPicserConfigured } from "./picser-upload";
import { uploadImageToUploadMe } from "./uploadme-upload";

export type Provider = "discord" | "uploadme" | "picser";

export type HybridUploadResult = {
  success: boolean;
  url: string;
  provider: Provider | null;
  providerLabel: string;
  raw: any;
};

const LABELS: Record<Provider, string> = {
  discord: "Discord",
  uploadme: "UploadMe",
  picser: "Picser",
};

/* ───────── round-robin counter (persists across uploads in this session) ───────── */
let uploadCounter = 0;

/** The fixed rotation order. */
const ROTATION: Provider[] = ["discord", "uploadme", "picser"];

/**
 * Get the ordered queue for this upload:
 *  - position 0  = the provider whose turn it is (from the counter)
 *  - positions 1+ = the remaining providers as fallback
 * Providers that aren't usable (e.g. Picser without creds) are skipped.
 */
function getQueue(): Provider[] {
  const idx = uploadCounter % ROTATION.length;
  uploadCounter++;

  // Build an ordered queue starting from the scheduled provider.
  const ordered: Provider[] = [];
  for (let i = 0; i < ROTATION.length; i++) {
    ordered.push(ROTATION[(idx + i) % ROTATION.length]);
  }

  // Remove Picser from the queue if it's not configured.
  return ordered.filter((p) => p !== "picser" || isPicserConfigured());
}

async function runProvider(
  provider: Provider,
  file: File | Blob,
): Promise<HybridUploadResult> {
  let r: { success: boolean; url: string; raw: any };
  if (provider === "picser") {
    r = await uploadImageToPicser(file);
  } else if (provider === "uploadme") {
    r = await uploadImageToUploadMe(file);
  } else {
    r = await uploadToDiscord(file);
  }
  return {
    success: r.success && !!r.url,
    url: r.url,
    provider: r.success && r.url ? provider : null,
    providerLabel: r.success && r.url ? LABELS[provider] : "",
    raw: r.raw,
  };
}

/**
 * Upload an image using strict round-robin with fallback.
 */
export async function uploadImageHybrid(
  file: File | Blob,
): Promise<HybridUploadResult> {
  const queue = getQueue();
  let lastRaw: any = null;

  for (let i = 0; i < queue.length; i++) {
    const provider = queue[i];
    const ordinal = i === 0 ? "(scheduled turn)" : "(fallback)";
    console.log(`[image-upload] ${ordinal} Trying: ${provider}`);

    const result = await runProvider(provider, file);
    if (result.success) {
      console.log(
        `[image-upload] ✅ Uploaded via ${result.providerLabel}: ${result.url}`,
      );
      return result;
    }
    console.warn(`[image-upload] ❌ ${provider} failed`);
    lastRaw = result.raw;
  }

  console.error("[image-upload] All providers failed");
  return {
    success: false,
    url: "",
    provider: null,
    providerLabel: "",
    raw: lastRaw,
  };
}
