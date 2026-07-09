export function formatAccountHandle(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function toFullAccountHandle(
  value?: string | null,
  localHost?: string | null,
) {
  const trimmed = value?.trim().replace(/^@/, "");
  if (!trimmed) return "";
  if (trimmed.includes("@") || !localHost) return trimmed;
  return `${trimmed}@${localHost}`;
}
