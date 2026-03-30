import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export async function commitAll(repoPath: string, message: string): Promise<void> {
  await runGit(repoPath, ["add", "-A"]);
  await runGitWithIdentity(repoPath, ["commit", "-m", message]);
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  const { stdout } = await execFile("git", ["branch", "--show-current"], { cwd: repoPath });
  return stdout.trim();
}

export async function runGit(repoPath: string, args: string[]): Promise<void> {
  await execFile("git", args, { cwd: repoPath });
}

export async function runGitWithIdentity(repoPath: string, args: string[]): Promise<void> {
  await execFile("git", ["-c", "user.email=tester@example.com", "-c", "user.name=Context Probe Tester", ...args], {
    cwd: repoPath,
  });
}
