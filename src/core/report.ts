import { renderArchitectureMarkdownReport } from "./report-architecture.js";
import { renderDomainMarkdownReport } from "./report-domain.js";

export { evaluateGate } from "./report-gate.js";

import { isArchitectureDomain, type ReportResponse } from "./report-shared.js";

export function renderMarkdownReport(response: ReportResponse, profileName?: string): string {
  if (isArchitectureDomain(response)) {
    return renderArchitectureMarkdownReport(response, profileName);
  }

  return renderDomainMarkdownReport(response);
}
