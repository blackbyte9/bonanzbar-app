const { spawn } = require("node:child_process");

const maximumAttempts = 3;
const retryDelayMilliseconds = 15_000;

function runMigration() {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(command, ["prisma", "migrate", "deploy"], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function main() {
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const { code, output } = await runMigration();
    if (code === 0) return;

    const isMigrationLockTimeout = output.includes("P1002") && output.includes("advisory lock");
    if (!isMigrationLockTimeout || attempt === maximumAttempts) {
      process.exitCode = code || 1;
      return;
    }

    console.warn(`Migrationssperre belegt; erneuter Versuch in ${retryDelayMilliseconds / 1000} Sekunden (${attempt + 1}/${maximumAttempts}).`);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMilliseconds));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
