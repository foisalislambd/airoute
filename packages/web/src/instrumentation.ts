/**
 * Next.js instrumentation entry (must live under packages/web/src).
 * Keep the `./instrumentation-node` dynamic import co-located here so Next's
 * bundler emits the Node chunk correctly (same pattern as packages/core).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodejs } = await import("./instrumentation-node");
    await registerNodejs();
  }
}
