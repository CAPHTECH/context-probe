export interface ValidationExpectation {
  extractor: {
    backend: "heuristic" | "cli";
    provider?: "codex" | "claude";
  };
  glossary?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  rules?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  invariants?: {
    mustInclude: string[];
    mustExclude: string[];
  };
  trace?: {
    mustLinkToCode?: string[];
    mustStayDocumentOnly?: string[];
  };
  review?: {
    sourceCommand: "doc.extract_glossary" | "doc.extract_rules" | "doc.extract_invariants";
    mustIncludeReasons: string[];
    maxItems: number;
  };
}

export interface ValidationCase {
  name: string;
  path: string;
  expectation: ValidationExpectation;
}
