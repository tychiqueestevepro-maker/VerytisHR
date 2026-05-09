import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.replace(/&amp;/g, "&").replace(/\\u0026/g, "&");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing media URL" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Unsupported media URL" }, { status: 400 });
  }

  const response = await fetch(url, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 VerytisHR/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Unable to load media" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "URL is not an image" }, { status: 415 });
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "content-type": contentType,
    },
  });
}
