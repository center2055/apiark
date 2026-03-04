import type { RunSummary } from "@apiark/types";

export function exportAsJson(summary: RunSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function exportAsJUnit(summary: RunSummary): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites tests="${summary.totalRequests}" failures="${summary.totalFailed}" time="${(summary.totalTimeMs / 1000).toFixed(3)}">`,
  );

  for (const iteration of summary.iterations) {
    lines.push(
      `  <testsuite name="Iteration ${iteration.iteration + 1}" tests="${iteration.results.length}">`,
    );
    for (const result of iteration.results) {
      const time = result.timeMs ? (result.timeMs / 1000).toFixed(3) : "0.000";
      if (result.passed) {
        lines.push(
          `    <testcase name="${escapeXml(result.name)}" classname="${escapeXml(result.method)} ${escapeXml(result.url)}" time="${time}" />`,
        );
      } else {
        lines.push(
          `    <testcase name="${escapeXml(result.name)}" classname="${escapeXml(result.method)} ${escapeXml(result.url)}" time="${time}">`,
        );
        lines.push(
          `      <failure message="${escapeXml(result.error || "Test assertions failed")}">${escapeXml(
            result.error ||
              `Tests: ${result.testPassed}/${result.testCount}, Assertions: ${result.assertionPassed}/${result.assertionCount}`,
          )}</failure>`,
        );
        lines.push("    </testcase>");
      }
    }
    lines.push("  </testsuite>");
  }

  lines.push("</testsuites>");
  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
