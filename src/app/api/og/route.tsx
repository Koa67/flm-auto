import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "FLM AUTO";
  const subtitle =
    searchParams.get("subtitle") || "Encyclop\u00e9die automobile";
  const statsParam = searchParams.get("stats");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: "#09090b",
          padding: 60,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.15), transparent 60%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#a1a1aa",
              letterSpacing: "0.1em",
            }}
          >
            FLM AUTO
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "white",
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#71717a",
              marginTop: 8,
            }}
          >
            {subtitle}
          </div>
          {statsParam && (
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {statsParam.split("|").map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    color: "#e4e4e7",
                    fontSize: 18,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {stat}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
