import Link from "next/link";
import type { ReactNode } from "react";
import { pushNavigationFrame } from "@/components/navigation-history";

export type MastodonEmoji = {
  shortcode: string;
  staticUrl?: string;
  url: string;
};

export type MastodonMention = {
  acct: string;
  id: string;
  isLocal: boolean;
  url: string;
  username: string;
};

const TRAILING_PUNCTUATION = /[.,;:!?)\]}>，。！？、）】」』]+$/;
const LINK_PATTERN =
  /(https?:\/\/[^\s<>"']+)|@([a-zA-Z0-9_]+(?:@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)?)/g;

export function renderTextWithEmoji(
  text: string,
  emojis?: MastodonEmoji[] | null,
  mentions?: MastodonMention[] | null,
  onNavigate?: (href: string) => void,
): ReactNode {
  if (!text) {
    return text;
  }

  const byShortcode = new Map((emojis || []).map((emoji) => [emoji.shortcode, emoji]));
  const byAcct = new Map<string, MastodonMention>();
  const groupedByUsername = new Map<string, MastodonMention[]>();

  for (const mention of mentions || []) {
    if (!mention.username) continue;

    const usernameKey = mention.username.toLowerCase();
    const group = groupedByUsername.get(usernameKey) || [];
    group.push(mention);
    groupedByUsername.set(usernameKey, group);
    byAcct.set(mention.acct.toLowerCase(), mention);
  }

  // When two mentioned accounts share a username, the content can only tell
  // them apart by qualifying later occurrences as "@username@domain". Resolve
  // bare "@username" runs by the order they appear in the mentions array,
  // which mirrors the order they first appear in the text; clamp to the last
  // candidate so repeat mentions of the same account keep resolving once
  // every distinct account in the group has been matched.
  const usernamePosition = new Map<string, number>();

  function resolveMention(raw: string): MastodonMention | undefined {
    const atIndex = raw.indexOf("@");
    const usernameKey = (atIndex >= 0 ? raw.slice(0, atIndex) : raw).toLowerCase();
    const index = usernamePosition.get(usernameKey) ?? 0;
    usernamePosition.set(usernameKey, index + 1);

    if (atIndex >= 0) {
      const exact = byAcct.get(raw);
      if (exact) return exact;
    }

    const candidates = groupedByUsername.get(usernameKey);
    return candidates?.length
      ? candidates[Math.min(index, candidates.length - 1)]
      : undefined;
  }

  const nodes: ReactNode[] = [];
  let key = 0;

  function pushTextWithEmoji(segment: string) {
    if (byShortcode.size === 0) {
      nodes.push(segment);
      return;
    }

    const pattern = /:([a-zA-Z0-9_]+):/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(segment)) !== null) {
      const emoji = byShortcode.get(match[1]);

      if (!emoji) {
        continue;
      }

      if (match.index > lastIndex) {
        nodes.push(segment.slice(lastIndex, match.index));
      }

      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`:${match[1]}:`}
          className="mx-px inline-block size-[1.2em] -translate-y-[0.15em] align-middle"
          key={`emoji-${key++}-${match[1]}`}
          src={emoji.url}
        />,
      );
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < segment.length) {
      nodes.push(segment.slice(lastIndex));
    }
  }

  const linkPattern = new RegExp(LINK_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextWithEmoji(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      const trailingMatch = TRAILING_PUNCTUATION.exec(match[1]);
      const trailing = trailingMatch?.[0] || "";
      const href = trailing ? match[1].slice(0, -trailing.length) : match[1];

      nodes.push(
        <a
          className="font-semibold text-[#2563eb] underline decoration-current/30 underline-offset-4 transition hover:text-[#1d4ed8] [overflow-wrap:anywhere]"
          href={href}
          key={`link-${key++}`}
          rel="noreferrer"
          target="_blank"
        >
          {href}
        </a>,
      );

      if (trailing) {
        nodes.push(trailing);
      }
    } else {
      const mention = resolveMention(match[2].toLowerCase());

      if (mention?.isLocal) {
        const href = `/user/${encodeURIComponent(mention.id)}`;

        nodes.push(
          <Link
            className="font-semibold text-[#2563eb] hover:underline"
            href={href}
            key={`mention-${key++}`}
            onClick={(event) => {
              event.stopPropagation();
              onNavigate?.(href);
              pushNavigationFrame("detail", href);
            }}
          >
            {match[0]}
          </Link>,
        );
      } else if (mention?.url) {
        nodes.push(
          <a
            className="font-semibold text-[#2563eb] underline decoration-current/30 underline-offset-4 transition hover:text-[#1d4ed8]"
            href={mention.url}
            key={`mention-${key++}`}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {match[0]}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushTextWithEmoji(text.slice(lastIndex));
  }

  return nodes;
}

export function mapMastodonEmojis(value: unknown): MastodonEmoji[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const emojis = value
    .map((entry): MastodonEmoji | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const shortcode = typeof record.shortcode === "string" ? record.shortcode : "";
      const url = typeof record.url === "string" ? record.url : "";

      if (!shortcode || !url) {
        return null;
      }

      return {
        shortcode,
        staticUrl: typeof record.static_url === "string" ? record.static_url : undefined,
        url,
      };
    })
    .filter((entry): entry is MastodonEmoji => Boolean(entry));

  return emojis.length ? emojis : undefined;
}

export function mapMastodonMentions(
  value: unknown,
  instanceHost?: string,
): MastodonMention[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedInstanceHost = instanceHost?.toLowerCase() || "";

  const mentions = value
    .map((entry): MastodonMention | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const username = typeof record.username === "string" ? record.username : "";

      if (!id || !username) {
        return null;
      }

      const acct = typeof record.acct === "string" ? record.acct : username;
      const atIndex = acct.lastIndexOf("@");
      const acctHost = atIndex >= 0 ? acct.slice(atIndex + 1).toLowerCase() : "";

      return {
        acct,
        id,
        isLocal: !acctHost || Boolean(normalizedInstanceHost) && acctHost === normalizedInstanceHost,
        url: typeof record.url === "string" ? record.url : "",
        username,
      };
    })
    .filter((entry): entry is MastodonMention => Boolean(entry));

  return mentions.length ? mentions : undefined;
}
