import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const base = getArg("--base") ?? "origin/main";
const head = getArg("--head") ?? "HEAD";
const prBody = process.env.PR_BODY ?? "";
const releaseIntent = process.env.RELEASE_INTENT ?? "";

const readFiles = (gitArgs) =>
  execFileSync("git", gitArgs, { encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);

const changedFiles = [
  ...readFiles(["diff", "--name-only", `${base}...${head}`]),
  ...readFiles(["diff", "--name-only", "HEAD"]),
  ...readFiles(["ls-files", "--others", "--exclude-standard"]),
];

const hasChangeset = changedFiles.some(
  (file) => file.startsWith(".changeset/") && file.endsWith(".md"),
);

const noReleaseNeeded =
  releaseIntent === "no-release-needed" ||
  /^- \[[xX]\] No release needed\b/m.test(prBody);

const isReleaseRelevant = (file) => {
  if (file.startsWith(".changeset/")) return false;
  if (file === "README.md" || file === "llms.txt" || file === "package.json") {
    return true;
  }
  if (file.startsWith("src/") || file.startsWith("examples/")) return true;
  if (file.startsWith("docs/guide/") || file.startsWith("docs/agents/")) {
    return true;
  }
  if (
    file.startsWith("docs/.vitepress/") &&
    !file.startsWith("docs/.vitepress/dist/")
  ) {
    return true;
  }
  return false;
};

const releaseRelevantFiles = [...new Set(changedFiles.filter(isReleaseRelevant))];

if (releaseRelevantFiles.length === 0) {
  console.log("release:intent ok: no release-relevant files changed");
  process.exit(0);
}

if (hasChangeset || noReleaseNeeded) {
  console.log(
    `release:intent ok: ${hasChangeset ? "changeset present" : "no-release-needed marker present"}`,
  );
  process.exit(0);
}

console.error("release:intent failed");
console.error("Release-relevant files changed without a changeset or explicit PR marker:");
for (const file of releaseRelevantFiles) {
  console.error(`- ${file}`);
}
console.error("");
console.error("Add a changeset or check `No release needed` in the PR template.");
process.exit(1);
