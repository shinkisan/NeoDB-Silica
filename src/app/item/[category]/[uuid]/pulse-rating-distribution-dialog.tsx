"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/use-t";

type PulseRatingDistributionDialogProps = {
  count?: number | null;
  distribution?: number[] | null;
  onClose: () => void;
  value: number | null;
};

export default function PulseRatingDistributionDialog({
  count,
  distribution,
  onClose,
  value,
}: PulseRatingDistributionDialogProps) {
  const t = useT();
  const [seed, setSeed] = useState(20260526);
  const data = useMemo(() => normalizePulseDistribution(distribution), [distribution]);
  const lines = useMemo(() => createPulseScanLines(data, seed), [data, seed]);
  const formattedCount =
    typeof count === "number" && count > 0
      ? new Intl.NumberFormat().format(count)
      : null;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[#050608]/45 px-5 backdrop-blur-sm">
      <section
        aria-modal="true"
        className="review-editor-enter relative w-full max-w-[354px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#14171b]/95 p-[17px] text-[#f4f7fa] shadow-2xl shadow-black/50 backdrop-blur-2xl"
        role="dialog"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,.12)_0.55px,transparent_0.55px)] [background-size:4px_4px] [mask-image:radial-gradient(circle,black_8%,transparent_77%)]"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-[0.02em] text-[#f4f7fa]">
                {t("detail.ratingDistribution.title")}
              </h2>
              <p className="mt-1 text-[11px] font-semibold text-[#e0e7ee]/55">
                {formattedCount
                  ? t("detail.ratingDistribution.count").replace(
                      "{count}",
                      formattedCount,
                    )
                  : t("detail.ratingDistribution.noCount")}
              </p>
            </div>
            <button
              aria-label={t("detail.ratingDistribution.close")}
              className="-mr-1 -mt-1 grid size-9 cursor-pointer place-items-center rounded-full text-[#f2f5f8]/85 transition hover:bg-white/10 active:scale-95"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="my-3 flex items-baseline gap-1.5">
            <strong className="text-[38px] font-semibold leading-none tracking-[-0.055em] text-[#f8f8f5]">
              {value?.toFixed(1)}
            </strong>
            <span className="text-[15px] font-medium text-[#e0e7ee]/55">/10</span>
          </div>

          <div className="h-[clamp(236px,calc((100vw_-_58px)_*_0.82),264px)] w-full overflow-hidden bg-[#050505]">
            <svg
              aria-label={t("detail.ratingDistribution.title")}
              className="block size-full"
              role="img"
              viewBox="0 0 360 286"
            >
              <PulseChartAxes data={data} />
              <g>
                {lines.map((line) => (
                  <g key={line.key}>
                    <path d={line.fillPath} fill="#050505" stroke="none" />
                    <path
                      d={line.path}
                      fill="none"
                      stroke="rgba(248,248,245,.96)"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.48"
                    />
                  </g>
                ))}
              </g>
            </svg>
          </div>

          <footer className="mt-3 flex justify-end">
            <button
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-[#e6ebf0]/60 transition hover:bg-white/10 active:scale-95"
              onClick={() => setSeed((current) => current + 1)}
              type="button"
            >
              重绘
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

type PulseDataPoint = {
  label: string;
  percent: number;
};

type PulseSource = {
  centerX: number;
  centerY: number;
  amplitude: number;
  spreadLeft: number;
  spreadRight: number;
  fieldY: number;
  needleX: number;
  needleScale: number;
  crestX: number;
  crestScale: number;
  crestWidth: number;
  lean: number;
  notch: number;
  identity: number;
};

const pulsePlot = {
  bottom: 222,
  height: 200,
  left: 46,
  right: 318,
  top: 22,
  width: 272,
};

const pulseDataCount = 10;
const pulseLineCount = 38;

function normalizePulseDistribution(distribution?: number[] | null): PulseDataPoint[] {
  const values = Array.isArray(distribution) ? distribution.slice(0, 5) : [];
  return [1, 2, 3, 4, 5].map((stars) => ({
    label: `${(stars - 1) * 2}-${stars * 2}`,
    percent: Math.max(0, Math.min(100, Number(values[stars - 1]) || 0)),
  }));
}

function PulseChartAxes({ data }: { data: PulseDataPoint[] }) {
  const slotWidth = pulsePlot.width / data.length;

  return (
    <g>
      {[0, 20, 40, 60, 80, 100].map((tick) => {
        const y = percentToPulseY(tick);

        return (
          <g key={tick}>
            <line
              stroke="rgba(248,248,245,.17)"
              strokeDasharray="2 4"
              strokeWidth="1"
              x1={pulsePlot.left}
              x2={pulsePlot.right}
              y1={y}
              y2={y}
            />
            <text
              dominantBaseline="middle"
              fill="rgba(248,248,245,.78)"
              fontFamily="Inter, PingFang SC, sans-serif"
              fontSize="9.6"
              fontWeight="600"
              textAnchor="end"
              x={pulsePlot.left - 8}
              y={y}
            >
              {tick}%
            </text>
          </g>
        );
      })}
      {Array.from({ length: data.length + 1 }, (_, slot) => {
        const x = pulsePlot.left + slot * slotWidth;

        return (
          <line
            key={slot}
            stroke="rgba(248,248,245,.12)"
            strokeDasharray="2 4"
            strokeWidth="1"
            x1={x}
            x2={x}
            y1={pulsePlot.top}
            y2={pulsePlot.bottom}
          />
        );
      })}
      {data.map((item, slot) => (
        <text
          fill="rgba(248,248,245,.80)"
          fontFamily="Inter, PingFang SC, sans-serif"
          fontSize="9.6"
          fontWeight="600"
          key={item.label}
          textAnchor="middle"
          x={pulsePlot.left + (slot + 0.5) * slotWidth}
          y={pulsePlot.bottom + 15}
        >
          {item.label}
        </text>
      ))}
    </g>
  );
}

function createPulseScanLines(data: PulseDataPoint[], seed: number) {
  const sources = createPulseSources(allocatePulses(data), seededRandom(seed), data.length);
  const lineGap = pulsePlot.height / (pulseLineCount - 1);

  return Array.from({ length: pulseLineCount }, (_, lineIndex) => {
    const baseline = pulseBaselineAt(lineIndex, lineGap);
    const steps = 290;
    let path = `M ${pulsePlot.left} ${baseline.toFixed(2)}`;

    for (let step = 1; step < steps; step += 1) {
      const x = pulsePlot.left + (step / steps) * pulsePlot.width;
      let lift = 0;

      sources.forEach((source) => {
        const influence = gaussian(baseline, source.centerY, source.fieldY);
        if (influence > 0.0025) {
          lift += asymmetricPeak(x, source, influence, lineIndex);
        }
      });

      if (lift > 0.04) {
        lift *=
          1 +
          Math.sin(x * 1.34 + lineIndex * 0.71) * 0.02 +
          Math.sin(x * 3.16 - lineIndex * 0.31) * 0.009;
      }

      path += ` L ${x.toFixed(2)} ${(baseline - softLimitLift(lift, baseline)).toFixed(2)}`;
    }

    path += ` L ${pulsePlot.right} ${baseline.toFixed(2)}`;

    const coverY = baseline + lineGap + 1.55;
    return {
      fillPath: `${path} L ${pulsePlot.right} ${coverY.toFixed(2)} L ${pulsePlot.left} ${coverY.toFixed(2)} Z`,
      key: `${lineIndex}-${seed}`,
      path,
    };
  });
}

function allocatePulses(data: PulseDataPoint[]) {
  const total = data.reduce((sum, item) => sum + item.percent, 0);
  const allocated = data.map((item, index) => {
    const exact = total > 0 ? (item.percent / total) * pulseDataCount : 0;
    const pulses = Math.floor(exact);
    return {
      ...item,
      index,
      pulses,
      remainder: exact - pulses,
    };
  });

  const remaining =
    pulseDataCount - allocated.reduce((sum, item) => sum + item.pulses, 0);

  [...allocated]
    .sort((a, b) => b.remainder - a.remainder || b.percent - a.percent || a.index - b.index)
    .slice(0, remaining)
    .forEach((item) => {
      item.pulses += 1;
    });

  return allocated;
}

function createPulseSources(
  data: ReturnType<typeof allocatePulses>,
  random: () => number,
  dataLength: number,
): PulseSource[] {
  const sources: PulseSource[] = [];
  const slotWidth = pulsePlot.width / dataLength;

  data.forEach((item, slot) => {
    if (item.pulses <= 0) {
      return;
    }

    const slotStartX = pulsePlot.left + slot * slotWidth;
    const targetY = percentToPulseY(item.percent);
    const offsets = Array.from({ length: item.pulses }, () =>
      between(random, 0.12, 0.88),
    ).sort((a, b) => a - b);

    const anchorIndex = offsets.reduce((best, offset, index) => {
      if (best === -1) {
        return index;
      }

      return Math.abs(offset - 0.5) < Math.abs(offsets[best] - 0.5)
        ? index
        : best;
    }, -1);

    offsets.forEach((offset, index) => {
      const isAnchor = index === anchorIndex;
      const prominence = isAnchor ? between(random, 1.12, 1.3) : between(random, 0.7, 1);
      const narrowness = isAnchor ? between(random, 0.68, 0.83) : between(random, 0.94, 1.1);
      const centerX = between(
        random,
        slotStartX + slotWidth * 0.1,
        slotStartX + slotWidth * 0.88,
      );
      const verticalJitter =
        item.pulses <= 1
          ? between(random, -5, 5)
          : (offset - 0.5) * 16 + between(random, -3, 3);

      sources.push({
        amplitude: between(random, 15, 31) * prominence,
        centerX,
        centerY: clamp(targetY + verticalJitter, pulsePlot.top + 5, pulsePlot.bottom - 5),
        crestScale: isAnchor ? between(random, 0.2, 0.38) : between(random, 0.03, 0.13),
        crestWidth: isAnchor ? between(random, 0.15, 0.25) : between(random, 0.2, 0.32),
        crestX: centerX + between(random, -3.2, 3.2),
        fieldY: between(random, 5.5, 12) * (isAnchor ? 0.86 : 1),
        identity: index + slot * 13,
        lean: between(random, -3.8, 3.8),
        needleScale: isAnchor ? between(random, 0.16, 0.3) : between(random, 0.05, 0.18),
        needleX: centerX + between(random, -5, 6),
        notch: between(random, 0.03, 0.12),
        spreadLeft: between(random, 5.5, 14.5) * narrowness,
        spreadRight: between(random, 5, 13) * narrowness,
      });
    });
  });

  return sources;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentToPulseY(percent: number) {
  return pulsePlot.bottom - (percent / 100) * pulsePlot.height;
}

function gaussian(value: number, center: number, spread: number) {
  const z = (value - center) / spread;
  return Math.exp(-0.5 * z * z);
}

function between(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fixedVariation(seed: number, min: number, max: number) {
  const unit = Math.abs(Math.sin(seed * 72.9898 + 14.233)) % 1;
  return min + unit * (max - min);
}

function asymmetricPeak(
  x: number,
  source: PulseSource,
  verticalInfluence: number,
  lineIndex: number,
) {
  const center = source.centerX + source.lean * Math.sin(lineIndex * 0.31 + source.identity);
  const spread = x < center ? source.spreadLeft : source.spreadRight;
  const core = gaussian(x, center, spread);
  const crest = gaussian(x, source.crestX, spread * source.crestWidth) * source.crestScale;
  const needle = gaussian(x, source.needleX, spread * 0.22) * source.needleScale;
  const leftEcho =
    gaussian(
      x,
      center - spread * fixedVariation(source.identity, 0.68, 1.26),
      spread * 0.43,
    ) * 0.18;
  const rightEcho =
    gaussian(
      x,
      center + spread * fixedVariation(source.identity + 7, 0.6, 1.15),
      spread * 0.48,
    ) * 0.11;
  const cut = gaussian(x, center + spread * 0.37, spread * 0.19) * source.notch;

  return source.amplitude * verticalInfluence * Math.max(0, core + crest + needle + leftEcho + rightEcho - cut);
}

function pulseBaselineAt(lineIndex: number, lineGap: number) {
  const ideal = pulsePlot.top + lineIndex * lineGap;
  return ideal + Math.sin(lineIndex * 1.71) * 0.22 + Math.sin(lineIndex * 0.43) * 0.11;
}

function softLimitLift(lift: number, baseline: number) {
  const ceiling = Math.min(66, Math.max(13, baseline - 7));
  const knee = ceiling * 0.57;
  if (lift <= knee) {
    return lift;
  }

  const range = ceiling - knee;
  return knee + range * (1 - Math.exp(-(lift - knee) / range));
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
