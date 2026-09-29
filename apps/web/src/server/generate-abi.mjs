import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
const contracts = ["DepositEscrow", "ResolverRegistry", "LeaseFactory"];
const result = {};
let compiled;
if (process.argv.includes("--solc")) {
  const { default: solc } = await import("solc");
  const sources = {};
  const root = new URL("../../../../contracts/", import.meta.url);
  async function collect(folder) {
    for (const entry of await readdir(new URL(folder, root), {
      withFileTypes: true,
    })) {
      const name = folder + entry.name;
      if (entry.isDirectory()) await collect(name + "/");
      else if (name.endsWith(".sol"))
        sources[name] = {
          content: await readFile(new URL(name, root), "utf8"),
        };
    }
  }
  await collect("src/");
  await collect("lib/");
  compiled = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const errors = (compiled.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length)
    throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const dir = new URL("../../.rentbond/", import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(
    new URL("compiled-contracts.json", dir),
    JSON.stringify(compiled.contracts),
  );
}
for (const name of contracts) {
  const source = new URL(
    "../../../../contracts/out/" + name + ".sol/" + name + ".json",
    import.meta.url,
  );
  result[name] = compiled
    ? compiled.contracts["src/" + name + ".sol"][name].abi
    : JSON.parse(await readFile(source, "utf8")).abi;
}
await writeFile(
  new URL("./contracts.generated.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "Generated API ABIs from " +
    (compiled
      ? "pinned solc 0.8.24 and repository sources."
      : "Foundry artifacts."),
);
