import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            fontSize: 220,
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
