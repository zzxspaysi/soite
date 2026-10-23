import "./prepare-demo.mjs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

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
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PAYMENT_MODE: "demo",
      ONE_C_TOKEN: "",
      YOOKASSA_AUTHORIZATION: "",
      YOOKASSA_SHOP_ID: "",
      YOOKASSA_SECRET_KEY: "",
      SITE_URL: "",
    },
  },
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
