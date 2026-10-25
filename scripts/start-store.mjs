// Demo remains the default. Live mode requires an explicitly persistent database.
if (process.env.PAYMENT_MODE !== "live") {
  await import("./serve-demo.mjs");
} else {
  const { isAbsolute, resolve } = await import("node:path");
  const { spawn } = await import("node:child_process");
  if (!process.env.ANADO_DB || !isAbsolute(process.env.ANADO_DB))
    throw new Error(
      "Live mode requires an absolute ANADO_DB path on a persistent disk.",
    );
  if (!process.env.SITE_URL?.startsWith("https://"))
    throw new Error("Live mode requires an HTTPS SITE_URL.");
  if (!process.env.ONE_C_TOKEN || process.env.ONE_C_TOKEN.length < 24)
    throw new Error(
      "Live mode requires ONE_C_TOKEN with at least 24 characters.",
    );
  await import("./prepare-demo.mjs"); // Catalog-only seed; existing databases are never replaced.
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const child = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(port),
    ],
    { stdio: "inherit", env: process.env },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = signal ? 0 : (code ?? 1);
  });
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}
