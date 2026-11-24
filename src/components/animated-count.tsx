"use client";

import { useState } from "react";

export function AnimatedCount({ count }: { count: number }) {
  const [value, setValue] = useState({ current: count, previous: count });
  if (value.current !== count) setValue({ current: count, previous: value.current });

  return (
    <span className="animated-count">
      {value.previous !== count && (
        <span aria-hidden="true" className="count-old" key={`old-${value.previous}`}>{value.previous}</span>
      )}
      <span className={value.previous !== count ? "count-new" : undefined} key={count}>{count}</span>
    </span>
  );
}
