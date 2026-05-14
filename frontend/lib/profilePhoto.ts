const PROFILE_PHOTO_PREFIX = "itiw_profile_photo:";

export function getStoredProfilePhoto(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return "";
  return localStorage.getItem(`${PROFILE_PHOTO_PREFIX}${userId}`) || "";
}

export function setStoredProfilePhoto(userId: string | undefined | null, photoUrl: string) {
  if (typeof window === "undefined" || !userId) return;

  const key = `${PROFILE_PHOTO_PREFIX}${userId}`;
  const cleanValue = photoUrl.trim();

  if (!cleanValue) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, cleanValue);
}
