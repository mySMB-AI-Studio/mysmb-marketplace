import { z } from "zod";
import { XeroApiClient } from "../client.js";

export const getProfitAndLossInput = z.object({
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("ISO date (YYYY-MM-DD) for the start of the period, inclusive."),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("ISO date (YYYY-MM-DD) for the end of the period, inclusive."),
});

export type GetProfitAndLossInput = z.infer<typeof getProfitAndLossInput>;

export async function getProfitAndLoss(
  client: XeroApiClient,
  input: GetProfitAndLossInput,
) {
  const api = await client.accounting();
  const res = await api.getReportProfitAndLoss(
    client.tenantId,
    input.from_date,
    input.to_date,
  );

  const report = res.body.reports?.[0];
  if (!report) {
    return { report: null };
  }

  // Return the structured rows as-is; tools that consume this (the
  // xero-reports skill) can walk the section tree and compute totals.
  return {
    report: {
      report_id: report.reportID,
      report_name: report.reportName,
      report_title: report.reportTitles,
      report_date: report.reportDate,
      updated_date_utc: report.updatedDateUTC,
      rows: report.rows,
    },
  };
}
