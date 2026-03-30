import { registerReportMarkdownArchitectureTests } from "./report-markdown-architecture.js";
import { registerReportMarkdownDomainTests } from "./report-markdown-domain.js";

export function registerReportMarkdownTests(): void {
  registerReportMarkdownArchitectureTests();
  registerReportMarkdownDomainTests();
}
