export function GlassFilterDefs() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute size-0"
      focusable="false"
    >
      <defs>
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            baseFrequency="0.012 0.012"
            numOctaves="2"
            result="noise"
            seed="92"
            type="fractalNoise"
          />
          <feGaussianBlur in="noise" result="blurred" stdDeviation="2" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            result="displaced"
            scale="28"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
