import { NextRequest, NextResponse } from "next/server";
import { PINCODE_STATE_MAP } from "../../../lib/shared/address-utils";

type PostalApiRecord = {
  District?: unknown;
  State?: unknown;
};

type PostalApiEntry = {
  Status?: unknown;
  PostOffice?: unknown;
};

function fallbackResponse(pincode: string) {
  return NextResponse.json(
    {
      success: false,
      city: "",
      state: PINCODE_STATE_MAP[pincode.slice(0, 2)] ?? "",
      country: "India",
      pincode,
      source: "local-fallback",
    },
    { status: 200 }
  );
}

function warnPincodeLookup(pincode: string, reason: string) {
  console.warn("[pincode lookup]", { pincode, reason });
}

export async function GET(req: NextRequest) {
  const pincode = (req.nextUrl.searchParams.get("pincode") || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ success: false, error: "Invalid pincode." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      warnPincodeLookup(pincode, `external status ${response.status}`);
      return fallbackResponse(pincode);
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      warnPincodeLookup(pincode, "malformed response");
      return fallbackResponse(pincode);
    }

    const first = body[0] as PostalApiEntry | undefined;
    if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice) || first.PostOffice.length === 0) {
      warnPincodeLookup(pincode, "missing successful post office records");
      return fallbackResponse(pincode);
    }

    const record = first.PostOffice.find((entry: PostalApiRecord) => {
      const district = String(entry?.District ?? "").trim();
      const state = String(entry?.State ?? "").trim();
      return Boolean(district && state);
    }) as PostalApiRecord | undefined;

    const city = String(record?.District ?? "").trim();
    const state = String(record?.State ?? "").trim();
    if (!city || !state) {
      warnPincodeLookup(pincode, "missing district or state");
      return fallbackResponse(pincode);
    }

    return NextResponse.json(
      {
        success: true,
        city,
        state,
        country: "India",
        pincode,
        source: "postal-api",
      },
      { status: 200 }
    );
  } catch (error) {
    warnPincodeLookup(pincode, error instanceof Error && error.name === "AbortError" ? "timeout" : "request failed");
    return fallbackResponse(pincode);
  } finally {
    clearTimeout(timeout);
  }
}
