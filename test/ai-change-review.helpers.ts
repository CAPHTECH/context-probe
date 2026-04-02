import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

async function writeRepoFiles(repoPath: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(repoPath, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }
}

async function appendToFile(repoPath: string, relativePath: string, content: string): Promise<void> {
  const targetPath = path.join(repoPath, relativePath);
  const current = await readFile(targetPath, "utf8");
  await writeFile(targetPath, `${current}${content}`, "utf8");
}

async function commitAll(repoPath: string, message: string): Promise<void> {
  await execFile("git", ["add", "."], { cwd: repoPath });
  await execFile(
    "git",
    ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", "commit", "-m", message],
    { cwd: repoPath },
  );
}

function buildLargeModule(version: string): string {
  const lines = Array.from({ length: 40 }, (_, index) => `export const line${index + 1} = "${version}-${index + 1}";`);
  return `${lines.join("\n")}\n`;
}

export async function createAiChangeReviewFixture(options?: { withFeatureChanges?: boolean }): Promise<{
  repoPath: string;
  baseBranch: string;
  headBranch: string;
}> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "context-probe-ai-change-review-"));
  await writeRepoFiles(repoPath, {
    "src/shared/util.ts": [
      "export function sharedValue(input: string): string {",
      "  return input.trim().toUpperCase();",
      "}",
      "",
    ].join("\n"),
    "src/shared/util.test.ts": [
      "describe(\"sharedValue\", () => {",
      "  it(\"keeps a placeholder test nearby\", () => {",
      "    expect(true).toBe(true);",
      "  });",
      "});",
      "",
    ].join("\n"),
    "src/app/consumer-a.ts": [
      "import { sharedValue } from \"../shared/util\";",
      "",
      "export function consumeA(): string {",
      "  return sharedValue(\"a\");",
      "}",
      "",
    ].join("\n"),
    "src/app/consumer-b.ts": [
      "import { sharedValue } from \"../shared/util\";",
      "",
      "export function consumeB(): string {",
      "  return sharedValue(\"b\");",
      "}",
      "",
    ].join("\n"),
    "src/app/consumer-c.ts": [
      "import { sharedValue } from \"../shared/util\";",
      "",
      "export function consumeC(): string {",
      "  return sharedValue(\"c\");",
      "}",
      "",
    ].join("\n"),
    "src/service/payment.ts": [
      "export function charge(amount: number): number {",
      "  return amount;",
      "}",
      "",
    ].join("\n"),
    "src/large.ts": buildLargeModule("base"),
  });

  await execFile("git", ["init"], { cwd: repoPath });
  await execFile("git", ["config", "user.email", "tester@example.com"], { cwd: repoPath });
  await execFile("git", ["config", "user.name", "Context Probe Tester"], { cwd: repoPath });
  await commitAll(repoPath, "feat: initial");
  await execFile("git", ["branch", "-M", "main"], { cwd: repoPath });

  await appendToFile(repoPath, "src/shared/util.ts", "\nexport const historyMarkerOne = \"main-1\";\n");
  await appendToFile(repoPath, "src/app/consumer-a.ts", "\nexport const consumerAMarker = \"main-1\";\n");
  await commitAll(repoPath, "feat: hotspot seed one");

  await appendToFile(repoPath, "src/shared/util.ts", "\nexport const historyMarkerTwo = \"main-2\";\n");
  await appendToFile(repoPath, "src/app/consumer-b.ts", "\nexport const consumerBMarker = \"main-2\";\n");
  await commitAll(repoPath, "feat: hotspot seed two");

  const headBranch = "feature/ai-review";
  await execFile("git", ["checkout", "-b", headBranch], { cwd: repoPath });

  if (options?.withFeatureChanges !== false) {
    await writeRepoFiles(repoPath, {
      "src/shared/util.ts": [
        "export function sharedValue(input: string): string {",
        "  return `feature:${input.trim().toLowerCase()}`;",
        "}",
        "",
        "export const historyMarkerOne = \"main-1\";",
        "export const historyMarkerTwo = \"main-2\";",
        "export const featureMarker = \"feature\";",
        "",
      ].join("\n"),
      "src/service/payment.ts": [
        "export function charge(amount: number): number {",
        "  return Math.round(amount * 1.1);",
        "}",
        "",
      ].join("\n"),
      "src/large.ts": buildLargeModule("feature"),
    });
    await commitAll(repoPath, "feat: AI branch changes");
  }

  return {
    repoPath,
    baseBranch: "main",
    headBranch,
  };
}
