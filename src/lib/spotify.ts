type SpotifyExternalResource = {
  url?: string;
};

const SPOTIFY_ALBUM_ID_PATTERN = /^[A-Za-z0-9]{10,32}$/;

export function getSpotifyAlbumEmbedUrl(
  resources: SpotifyExternalResource[] | null | undefined,
) {
  for (const resource of resources || []) {
    const albumId = getSpotifyAlbumId(resource.url);

    if (albumId) {
      return `https://open.spotify.com/embed/album/${albumId}`;
    }
  }

  return null;
}

function getSpotifyAlbumId(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("spotify:album:")) {
    const albumId = value.slice("spotify:album:".length);
    return SPOTIFY_ALBUM_ID_PATTERN.test(albumId) ? albumId : null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const albumIndex = segments.indexOf("album");
    const albumId = albumIndex >= 0 ? segments[albumIndex + 1] : null;

    return albumId && SPOTIFY_ALBUM_ID_PATTERN.test(albumId) ? albumId : null;
  } catch {
    return null;
  }
}
