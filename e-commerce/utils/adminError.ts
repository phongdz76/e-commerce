import axios from "axios";

export function getAdminErrorMessage(error: unknown, fallback: string) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (status === 403) {
    return "You do not have permission to perform this action.";
  }
  if (status === 409) {
    return "This record has changed. Your input has been kept. Reload the latest version before saving.";
  }
  if (status === 429) {
    return "Too many requests. Please wait before trying again.";
  }
  return fallback;
}
