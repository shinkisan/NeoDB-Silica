const NOTIFICATION_LAST_SEEN_KEY = "bielu:v1:notifications:last-seen-id";

export function readLastSeenNotificationId() {
  if (typeof window === "undefined") return "";

  try {
    return localStorage.getItem(NOTIFICATION_LAST_SEEN_KEY) || "";
  } catch {
    return "";
  }
}

export function writeLastSeenNotificationId(id: string) {
  if (typeof window === "undefined" || !id) return;

  try {
    localStorage.setItem(NOTIFICATION_LAST_SEEN_KEY, id);
  } catch {
    // The red dot is only a local hint; ignore unavailable storage.
  }
}
