import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDocs = [
  join(repoRoot, "README.md"),
  ...walkMarkdownFiles(join(repoRoot, "docs", "guide")),
];
const snippetPattern = /```([^\n`]*)\n([\s\S]*?)```/g;

const snippets = [];

for (const file of publicDocs) {
  const source = readFileSync(file, "utf8");
  let match;
  let snippetNumber = 0;

  while ((match = snippetPattern.exec(source)) !== null) {
    const info = match[1].trim();
    const [language, ...flags] = info.split(/\s+/).filter(Boolean);

    if (!["ts", "tsx", "typescript"].includes(language)) {
      continue;
    }

    snippetNumber += 1;

    if (flags.includes("no-verify")) {
      continue;
    }

    snippets.push({
      code: match[2].trim(),
      file,
      snippetNumber,
    });
  }
}

if (snippets.length === 0) {
  console.error("No verifiable public TypeScript snippets found.");
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), "socket-store-doc-snippets-"));

try {
  const configPath = join(tempDir, "tsconfig.json");
  const snippetFiles = snippets.map((snippet) => {
    const baseName = relative(repoRoot, snippet.file)
      .replace(/[\/\\]/g, "__")
      .replace(/\.md$/, "");
    const fileName = `${baseName}.snippet-${snippet.snippetNumber}.ts`;
    const filePath = join(tempDir, fileName);
    const header = `// Source: ${relative(repoRoot, snippet.file)}#snippet-${snippet.snippetNumber}\n`;

    writeFileSync(filePath, `${header}${snippet.code}\n`);
    return filePath;
  });

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          strict: true,
          noEmit: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          skipLibCheck: true,
          baseUrl: repoRoot,
          paths: {
            "socket-store": ["./src/index.ts"],
          },
        },
        include: snippetFiles,
      },
      null,
      2
    )
  );

  const tscPath = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(process.execPath, [tscPath, "--project", configPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }

  console.log(`Verified ${snippets.length} public TypeScript snippet(s).`);
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

function walkMarkdownFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(path));
      continue;
    }

    if (entry.isFile() && path.endsWith(".md")) {
      files.push(path);
    }
  }

  return files.sort();
}
