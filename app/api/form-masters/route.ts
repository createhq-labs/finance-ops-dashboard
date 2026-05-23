import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "../../../lib/server/auth";
import { assertSupabaseEnv, createUserScopedClient } from "../../../lib/server/supabase";
import { getAccessTokenFromCookieHeader } from "../../../lib/server/services/authCookies";

type AgencyRow = {
  agency_name: string | null;
  agency_trade_name: string | null;
};

type BrandRow = {
  brand_name: string | null;
  brand_trade_name: string | null;
};

type CreatorRow = {
  name: string | null;
  linked_brand_name?: string | null;
};

type DeliverableRow = {
  name: string | null;
  business_line: string | null;
};

export async function GET(req: NextRequest) {
  try {
    assertSupabaseEnv();

    let token = "";
    try {
      token = getBearerToken(req);
    } catch {
      token = getAccessTokenFromCookieHeader(req.cookies) ?? "";
    }
    if (!token) throw new Error("Missing auth token");

    const userClient = createUserScopedClient(token);

    const agenciesPromise = userClient
      .from("brands")
      .select("agency_name, agency_trade_name")
      .not("agency_name", "is", null)
      .eq("is_active", true)
      .order("agency_name", { ascending: true });

    const brandsPromise = userClient
      .from("brands")
      .select("brand_name, brand_trade_name")
      .not("brand_name", "is", null)
      .eq("is_active", true)
      .order("brand_name", { ascending: true });

    const creatorsPromise = userClient
      .from("creators")
      .select("name, linked_brand_name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    const deliverablesPromise = userClient
      .from("deliverables")
      .select("name, business_line")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const [agenciesRes, brandsRes, creatorsResult, deliverablesRes] = await Promise.all([
      agenciesPromise,
      brandsPromise,
      creatorsPromise,
      deliverablesPromise,
    ]);

    let creatorsError = creatorsResult.error;
    let creatorsData = (creatorsResult.data ?? []) as CreatorRow[];

    if (creatorsError && /linked_brand_name/i.test(creatorsError.message)) {
      const fallbackCreators = await userClient
        .from("creators")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      creatorsError = fallbackCreators.error;
      creatorsData = (fallbackCreators.data ?? []).map((row: { name?: string | null }) => ({
        name: row.name ?? null,
        linked_brand_name: null,
      }));
    }

    const errors = [agenciesRes.error, brandsRes.error, creatorsError, deliverablesRes.error].filter(Boolean);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.map((error) => error?.message).join(" | ") },
        { status: 400 }
      );
    }

    const agencies = ((agenciesRes.data ?? []) as AgencyRow[])
      .map((row) => ({
        name: row.agency_name?.trim() ?? "",
        tradeName: row.agency_trade_name?.trim() ?? "",
      }))
      .filter((row) => row.name);

    const brands = ((brandsRes.data ?? []) as BrandRow[])
      .map((row) => ({
        name: row.brand_name?.trim() ?? "",
        tradeName: row.brand_trade_name?.trim() ?? "",
      }))
      .filter((row) => row.name);

    const creators = creatorsData
      .map((row) => ({
        name: row.name?.trim() ?? "",
        linkedBrandName: row.linked_brand_name?.trim() ?? "",
      }))
      .filter((row) => row.name);

    const deliverables = { TM: [] as string[], IM: [] as string[] };
    for (const row of (deliverablesRes.data ?? []) as DeliverableRow[]) {
      const name = row.name?.trim();
      const line = (row.business_line ?? "").trim().toUpperCase();
      if (!name) continue;
      if (line === "TM") deliverables.TM.push(name);
      if (line === "IM") deliverables.IM.push(name);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          agencies,
          brands,
          creators,
          deliverables,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
