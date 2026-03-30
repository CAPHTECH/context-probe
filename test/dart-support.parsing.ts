import { expect, test } from "vitest";

import { parseCodebase } from "../src/analyzers/code.js";

import { PARSER_REPO } from "./dart-support.helpers.js";

export function registerDartSupportParsingTests(): void {
  test("parses Dart imports, exports, parts, package URIs, and mixed-language files", async () => {
    const codebase = await parseCodebase(PARSER_REPO);

    expect(codebase.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "lib/application/load_order.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "../contracts/order_contract.dart",
          targetKind: "file",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/application/use_case.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "package:parser_repo/contracts/order_contract.dart",
          targetKind: "file",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/infrastructure/json_codec.dart",
          target: "dart:convert",
          specifier: "dart:convert",
          targetKind: "external",
          kind: "import",
        }),
        expect.objectContaining({
          source: "lib/contracts/contracts.dart",
          target: "lib/contracts/order_contract.dart",
          specifier: "order_contract.dart",
          targetKind: "file",
          kind: "export",
        }),
        expect.objectContaining({
          source: "lib/models/order.dart",
          target: "lib/models/order.g.dart",
          specifier: "order.g.dart",
          targetKind: "file",
          kind: "part",
        }),
        expect.objectContaining({
          source: "lib/application/missing_dep.dart",
          target: "../contracts/missing_contract.dart",
          specifier: "../contracts/missing_contract.dart",
          targetKind: "missing",
          kind: "import",
        }),
      ]),
    );

    expect(codebase.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "lib/models/order.g.dart",
          language: "dart",
          generated: true,
          libraryRole: "part",
        }),
        expect.objectContaining({
          path: "src/bridge.ts",
          language: "typescript",
          generated: false,
        }),
      ]),
    );
    expect(codebase.scorableSourceFiles).not.toContain("lib/models/order.g.dart");
    expect(codebase.scorableSourceFiles).toContain("lib/models/order.dart");
    expect(codebase.scorableSourceFiles).toContain("src/bridge.ts");
  });
}
