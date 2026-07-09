const DEFAULT_NEODB_INSTANCE = "https://neodb.social";

export function getConfiguredNeodbInstance() {
  return normalizeNeodbInstance(
    process.env.NEODB_DEFAULT_INSTANCE || DEFAULT_NEODB_INSTANCE,
  );
}

export function getConfiguredNeodbAuthInstance() {
  return normalizeNeodbInstance(
    process.env.NEODB_AUTH_INSTANCE ||
      process.env.NEODB_DEFAULT_INSTANCE ||
      DEFAULT_NEODB_INSTANCE,
  );
}

export function getConfiguredNeodbHostname() {
  return new URL(getConfiguredNeodbInstance()).hostname;
}

export function normalizeNeodbInstance(value: string) {
  const instance = value.trim() || DEFAULT_NEODB_INSTANCE;
  const withProtocol = /^https?:\/\//.test(instance)
    ? instance
    : `${getDefaultProtocol(instance)}://${instance}`;

  return new URL(withProtocol).origin;
}

function getDefaultProtocol(value: string) {
  const host = value.split("/")[0].split(":")[0];

  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
    ? "http"
    : "https";
}
