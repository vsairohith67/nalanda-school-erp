export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { hydratePortableRuntimeSecrets } = await import("@/lib/portable-runtime/secrets");
  hydratePortableRuntimeSecrets();
  const deployment = (process.env.NALANDA_ENVIRONMENT || process.env.DEPLOYMENT_ENVIRONMENT || "").toLowerCase();
  if (["synthetic-staging", "staging", "production"].includes(deployment)) {
    const { assertPortableRuntimeConfiguration } = await import("@/lib/portable-runtime/config");
    assertPortableRuntimeConfiguration(process.env, "web");
  }
}
