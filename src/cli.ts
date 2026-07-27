#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { NoCapError, VERSION, parse, run } from "./index.js";

const HELP = `NoCap ${VERSION}

Usage:
  nocap <file.np>
  nocap --check <file.np>
  nocap -

Options:
  --check       Validate syntax without running the program
  -h, --help    Show this help
  -v, --version Show the version

Use '-' as the filename to read from standard input.`;

export async function main(args = process.argv.slice(2)): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return 0;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return 0;
  }

  const checkOnly = args.includes("--check");
  const positional = args.filter((argument) => argument !== "--check");
  const unknownOption = positional.find((argument) => argument.startsWith("-") && argument !== "-");
  if (unknownOption) {
    console.error(`Unknown option: ${unknownOption}\n\n${HELP}`);
    return 2;
  }
  if (positional.length !== 1) {
    console.error(HELP);
    return 2;
  }

  const filename = positional[0]!;
  if (filename !== "-" && !filename.endsWith(".np")) {
    console.error("NoCap files must use the '.np' extension.");
    return 2;
  }
  try {
    const source = filename === "-" ? await readStandardInput() : await readFile(filename, "utf8");
    if (checkOnly) {
      parse(source, filename === "-" ? "<stdin>" : filename);
      console.log("Vibe check passed. No cap.");
    } else {
      run(source, { filename: filename === "-" ? "<stdin>" : filename });
    }
    return 0;
  } catch (error) {
    if (error instanceof NoCapError) {
      console.error(error.format());
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    return 1;
  }
}

async function readStandardInput(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let source = "";
  for await (const chunk of process.stdin) source += String(chunk);
  return source;
}

process.exitCode = await main();
