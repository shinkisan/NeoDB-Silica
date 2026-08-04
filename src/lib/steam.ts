type SteamExternalResource = {
  url?: string;
};

const STEAM_APP_ID_PATTERN = /^\d{1,12}$/;

export function getSteamAppId(
  resources: SteamExternalResource[] | null | undefined,
) {
  for (const resource of resources || []) {
    const appId = parseSteamAppId(resource.url);

    if (appId) {
      return appId;
    }
  }

  return null;
}

function parseSteamAppId(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      (url.hostname !== "store.steampowered.com" &&
        url.hostname !== "store.steamcommunity.com")
    ) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const appIndex = segments.indexOf("app");
    const appId = appIndex >= 0 ? segments[appIndex + 1] : null;

    return appId && STEAM_APP_ID_PATTERN.test(appId) ? appId : null;
  } catch {
    return null;
  }
}
