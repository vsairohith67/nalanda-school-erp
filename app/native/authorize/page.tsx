import { getCurrentAuthContext } from "@/lib/auth";
import { inspectNativeAuthorization } from "@/lib/native-app/auth";
import { PRODUCT_BRAND } from "@/config/product-brand";

export const dynamic = "force-dynamic";

export default async function NativeAuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const requestId = String(params.request ?? "");
  const state = String(params.state ?? "");
  const challenge = String(params.challenge ?? "");
  const proof = String(params.proof ?? "");
  const context = await getCurrentAuthContext();
  let details: Awaited<ReturnType<typeof inspectNativeAuthorization>> | null = null;
  try { details = await inspectNativeAuthorization({ requestId, state, challenge }); } catch {}

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#edf3f5", padding: 24 }}>
    <section style={{ width: "min(520px,100%)", background: "white", border: "1px solid #d5e1e3", borderRadius: 18, padding: 32, boxShadow: "0 18px 55px #183f5017" }}>
      <img src="/nalanda-logo-transparent.png" alt="Nalanda Public School emblem" width="76" height="76" style={{ objectFit: "contain" }} />
      <p style={{ color: "#268b83", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", marginTop: 18 }}>NATIVE APP AUTHORIZATION</p>
      <h1 style={{ color: "#102f46", fontFamily: "Georgia,serif", marginBottom: 12 }}>Connect this ERP app?</h1>
      {!context ? <p>Sign in to {PRODUCT_BRAND.productName} in this browser, then reopen the authorization link from the app.</p> : !details || !proof ? <p>This authorization request is invalid, incomplete or expired. Return to the app and begin again.</p> : <>
        <p>Signed in as <strong>{context.user.name}</strong>. Confirm only if the device below is yours.</p>
        <dl style={{ background: "#f4f8f8", borderRadius: 10, padding: 16, lineHeight: 1.8 }}><dt>Device</dt><dd>{details.deviceLabel}</dd><dt>Platform</dt><dd>{details.platform}</dd><dt>Device reference</dt><dd>{details.publicDeviceId.slice(0, 8)}…</dd></dl>
        <p style={{ color: "#6d5930", background: "#fff7e5", borderRadius: 9, padding: 12, fontSize: 13 }}>This grants no extra permissions. The server rechecks your active account, role, device approval and finance permission on every request.</p>
        <form action="/api/native-auth/authorize" method="post">
          <input type="hidden" name="request" value={requestId} /><input type="hidden" name="state" value={state} /><input type="hidden" name="challenge" value={challenge} /><input type="hidden" name="proof" value={proof} />
          <button type="submit" style={{ width: "100%", border: 0, borderRadius: 9, color: "white", background: "#147f78", padding: 12, fontWeight: 750 }}>Confirm this device</button>
        </form>
      </>}
    </section>
  </main>;
}
