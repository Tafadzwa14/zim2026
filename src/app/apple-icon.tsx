import { ImageResponse } from "next/og";

// iOS uses a PNG apple-touch-icon for the home-screen tile (it ignores the
// SVG maskable icon). Generated at build time — no binary asset to ship.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #2f6f8f, #1c4a63)",
          color: "white",
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -4,
        }}
      >
        Zim
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 0, marginTop: -6, opacity: 0.9 }}>2026</div>
      </div>
    ),
    { ...size },
  );
}
