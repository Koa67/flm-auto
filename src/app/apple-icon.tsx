import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "22%",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: 78,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: "-0.05em",
          }}
        >
          FLM
        </span>
      </div>
    ),
    { ...size }
  );
}
