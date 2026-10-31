// Tiny ESM resolve hook so Node's native TS runner can follow this project's
// extensionless internal imports (the convention Convex's own esbuild-based
// bundler expects) when running these pure-function unit tests directly with
// `node --test`. Not used by the app or by Convex itself — test-only.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-zA-Z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
