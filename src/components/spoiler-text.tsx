"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  renderTextWithEmoji,
  type MastodonEmoji,
  type MastodonMention,
} from "@/lib/mastodon-emoji";

export function SpoilerText({
  emojis,
  mentions,
  onNavigate,
  text,
}: {
  emojis?: MastodonEmoji[] | null;
  mentions?: MastodonMention[] | null;
  onNavigate?: (href: string) => void;
  text: string;
}) {
  const parts = parseSpoilerText(text);

  if (parts.length === 0) {
    return null;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === "spoiler" ? (
          <Spoiler key={index}>
            {renderTextWithEmoji(part.text, emojis, mentions, onNavigate)}
          </Spoiler>
        ) : (
          <span key={index}>
            {renderTextWithEmoji(part.text, emojis, mentions, onNavigate)}
          </span>
        ),
      )}
    </>
  );
}

function Spoiler({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);
  const veilRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (hidden && veilRef.current) {
      buildVeil(veilRef.current);
    }
  }, [hidden]);

  return (
    <span
      aria-label={hidden ? "点击显示隐藏文字" : "隐藏文字已显示"}
      className="spoiler"
      data-hidden={String(hidden)}
      onClick={() => setHidden(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setHidden(false);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className="spoiler__text">{children}</span>
      <span aria-hidden="true" className="spoiler__veil" ref={veilRef} />
    </span>
  );
}

function parseSpoilerText(text: string) {
  const parts: Array<{ text: string; type: "normal" | "spoiler" }> = [];
  const regex = />!([^!]+)!</g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        type: "normal",
      });
    }

    parts.push({ text: match[1], type: "spoiler" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: "normal" });
  }

  return parts;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

function buildVeil(veil: HTMLElement) {
  veil.innerHTML = "";

  const parent = veil.parentElement;

  if (!parent) {
    return;
  }

  const rect = parent.getBoundingClientRect();
  const area = Math.max(1, rect.width * rect.height);
  const tileCount = Math.min(95, Math.max(34, Math.floor(area / 46)));
  const sparkCount = Math.min(38, Math.max(14, Math.floor(area / 130)));

  for (let i = 0; i < tileCount; i++) {
    const tile = document.createElement("i");
    tile.className = "spoiler-tile";
    tile.style.setProperty("--x", `${rand(0, 100)}%`);
    tile.style.setProperty("--y", `${rand(0, 100)}%`);
    tile.style.setProperty("--s", `${rand(4, 11)}px`);
    tile.style.setProperty("--a", rand(0.16, 0.56).toFixed(2));
    tile.style.setProperty("--scale", rand(0.7, 1.45).toFixed(2));
    tile.style.setProperty("--dx", `${rand(-10, 10)}px`);
    tile.style.setProperty("--dy", `${rand(-7, 7)}px`);
    tile.style.setProperty("--dur", `${rand(1.2, 3.6)}s`);
    tile.style.setProperty("--delay", `${rand(-3, 0)}s`);
    veil.appendChild(tile);
  }

  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement("i");
    spark.className = "spoiler-spark";
    spark.style.setProperty("--x", `${rand(0, 100)}%`);
    spark.style.setProperty("--y", `${rand(0, 100)}%`);
    spark.style.setProperty("--s", `${rand(2, 5)}px`);
    spark.style.setProperty("--dx", `${rand(-18, 18)}px`);
    spark.style.setProperty("--dy", `${rand(-12, 12)}px`);
    spark.style.setProperty("--dur", `${rand(2.4, 6)}s`);
    spark.style.setProperty("--blink", `${rand(0.45, 1.2)}s`);
    spark.style.setProperty("--delay", `${rand(-4, 0)}s`);
    veil.appendChild(spark);
  }
}
