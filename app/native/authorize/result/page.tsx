export default async function NativeAuthorizeResult({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const status = String((await searchParams).status ?? "");
  const approval = status === "device-approval-required";
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#edf3f5", padding: 24 }}><section style={{ width: "min(500px,100%)", background: "white", borderRadius: 18, padding: 34 }}><img src="/nalanda-logo-transparent.png" alt="Nalanda Public School emblem" width="72" height="72" /><h1 style={{ color: "#102f46", fontFamily: "Georgia,serif" }}>{approval ? "Device approval required" : "Authorization ended"}</h1><p>{approval ? "Your request is recorded. A Super Admin must verify and approve the named physical device before the app can receive a session. Close this tab and return to the app." : "Return to the app and start a new authorization request."}</p></section></main>;
}
