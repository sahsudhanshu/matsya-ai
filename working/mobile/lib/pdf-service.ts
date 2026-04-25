import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import type { GroupRecord } from "./types";

export class PDFService {
  /**
   * Generate PDF for a group analysis
   */
  static async generateGroupPDF(
    group: GroupRecord,
    userName: string,
  ): Promise<string> {
    const html = this.generateGroupHTML(group, userName);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Generate PDF for analytics report
   */
  static async generateAnalyticsReport(
    analytics: any,
    userName: string,
    dateRange: { from: string; to: string },
    catchHistory?: Array<{
      date: Date;
      species: string;
      weight: number;
      quality: string;
      earnings: number;
    }>,
  ): Promise<string> {
    const html = this.generateAnalyticsHTML(
      analytics,
      userName,
      dateRange,
      catchHistory,
    );

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Share analytics report
   */
  static async shareReport(uri: string): Promise<void> {
    const fileName = `Matsya AI_Analytics_${new Date().toISOString().split("T")[0]}.pdf`;
    await this.sharePDF(uri, fileName);
  }

  /**
   * Share PDF file
   */
  static async sharePDF(uri: string, fileName: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device");
    }

    // Copy to a permanent location with proper filename
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: newUri });

    await Sharing.shareAsync(newUri, {
      mimeType: "application/pdf",
      dialogTitle: "Share PDF Report",
      UTI: "com.adobe.pdf",
    });
  }

  /**
   * Generate HTML for group report
   */
  private static generateGroupHTML(
    group: GroupRecord,
    userName: string,
  ): string {
    const analysis = group.analysisResult;
    if (!analysis) {
      throw new Error("No analysis result available");
    }

    const stats = analysis.aggregateStats;
    const date = new Date(group.createdAt).toLocaleDateString();
    const time = new Date(group.createdAt).toLocaleTimeString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Catch Report - ${date}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 40px;
              color: #1e293b;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #1e40af;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #1e40af;
              margin: 0;
              font-size: 32px;
            }
            .header p {
              color: #64748b;
              margin: 5px 0;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f1f5f9;
              padding: 20px;
              border-radius: 12px;
              border-left: 4px solid #1e40af;
            }
            .stat-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 28px;
              font-weight: bold;
              color: #1e293b;
            }
            .section {
              margin: 30px 0;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 15px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 10px;
            }
            .species-list {
              list-style: none;
              padding: 0;
            }
            .species-item {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              background: #f8fafc;
              margin-bottom: 8px;
              border-radius: 8px;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🐟 Catch Report</h1>
            <p><strong>${userName}</strong></p>
            <p>${date} at ${time}</p>
            <p>Group ID: ${group.groupId.substring(0, 8)}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Fish</div>
              <div class="stat-value">${stats.totalFishCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Species Count</div>
              <div class="stat-value">${Object.keys(stats.speciesDistribution).length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Estimated Weight</div>
              <div class="stat-value">${stats.totalEstimatedWeight.toFixed(1)} kg</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Estimated Value</div>
              <div class="stat-value">₹${stats.totalEstimatedValue.toFixed(0)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Species Distribution</div>
            <ul class="species-list">
              ${Object.entries(stats.speciesDistribution)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(
                  ([species, count]) => `
                <li class="species-item">
                  <span>${species}</span>
                  <strong>${count} fish</strong>
                </li>
              `,
                )
                .join("")}
            </ul>
          </div>

          ${
            group.latitude && group.longitude
              ? `
          <div class="section">
            <div class="section-title">Location</div>
            <p>Latitude: ${group.latitude.toFixed(6)}</p>
            <p>Longitude: ${group.longitude.toFixed(6)}</p>
          </div>
          `
              : ""
          }

          <div class="footer">
            <p>Generated by Matsya AI - AI for Bharat Fishermen</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for analytics report
   */
  private static generateAnalyticsHTML(
    analytics: any,
    userName: string,
    dateRange: { from: string; to: string },
    catchHistory?: Array<{
      date: Date;
      species: string;
      weight: number;
      quality: string;
      earnings: number;
    }>,
  ): string {
    const generatedDate = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Prepare catch history with pagination
    const ITEMS_PER_PAGE = 20;
    const catchPages: Array<typeof catchHistory> = [];
    if (catchHistory && catchHistory.length > 0) {
      for (let i = 0; i < catchHistory.length; i += ITEMS_PER_PAGE) {
        catchPages.push(catchHistory.slice(i, i + ITEMS_PER_PAGE));
      }
    }

    const maxEarnings = Math.max(
      ...analytics.weeklyTrend.map((d: any) => d.earnings),
    );
    const qualityTotal = analytics.qualityDistribution.reduce(
      (sum: number, q: any) => sum + q.count,
      0,
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Analytics Report - ${userName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.6; }
            .page { padding: 40px; page-break-after: always; }
            .page:last-child { page-break-after: auto; }
            .cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; text-align: center; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; }
            .cover-logo { font-size: 64px; margin-bottom: 20px; }
            .cover-title { font-size: 48px; font-weight: bold; margin-bottom: 10px; }
            .cover-subtitle { font-size: 24px; opacity: 0.9; margin-bottom: 40px; }
            .cover-user { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
            .cover-date-range { font-size: 20px; opacity: 0.8; margin-bottom: 5px; }
            .cover-generated { font-size: 16px; opacity: 0.7; margin-top: 40px; }
            .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #1e40af; font-size: 32px; margin-bottom: 5px; }
            .header p { color: #64748b; font-size: 14px; }
            .section { margin-bottom: 40px; }
            .section-title { font-size: 24px; font-weight: bold; color: #1e40af; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: #f1f5f9; padding: 24px; border-radius: 12px; border-left: 4px solid #1e40af; }
            .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
            .stat-value { font-size: 36px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #f1f5f9; color: #1e293b; font-weight: 600; text-align: left; padding: 12px; border-bottom: 2px solid #cbd5e1; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            tr:last-child td { border-bottom: none; }
            tr:hover { background: #f8fafc; }
            .species-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
            .species-row:last-child { border-bottom: none; }
            .species-name { flex: 0 0 150px; font-weight: 600; color: #1e293b; }
            .species-bar-container { flex: 1; height: 24px; background: #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 15px; }
            .species-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #1e40af); border-radius: 12px; }
            .species-stats { flex: 0 0 120px; text-align: right; font-size: 13px; color: #64748b; }
            .species-count { font-weight: 600; color: #1e293b; }
            .chart-container { background: #f8fafc; padding: 20px; border-radius: 12px; margin-top: 15px; }
            .bar-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 200px; gap: 8px; }
            .bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .bar-value { font-size: 11px; color: #64748b; font-weight: 600; }
            .bar-track { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
            .bar { width: 100%; max-width: 40px; background: linear-gradient(180deg, #3b82f6, #1e40af); border-radius: 6px 6px 0 0; min-height: 8px; }
            .bar-label { font-size: 11px; color: #64748b; font-weight: 500; }
            .quality-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
            .quality-premium { background: #dcfce7; color: #166534; }
            .quality-standard { background: #fef3c7; color: #92400e; }
            .quality-low { background: #fee2e2; color: #991b1b; }
            .page-number { position: fixed; bottom: 20px; right: 40px; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="page cover-page">
            <div class="cover-logo">🐟</div>
            <h1 class="cover-title">Analytics Report</h1>
            <p class="cover-subtitle">Catch Performance & Insights</p>
            <div style="margin-top: 60px;">
              <p class="cover-user">${userName}</p>
              <p class="cover-date-range">${dateRange.from} - ${dateRange.to}</p>
              <p class="cover-generated">Generated on ${generatedDate}</p>
            </div>
          </div>

          <div class="page">
            <div class="header">
              <h1>Summary Statistics</h1>
              <p>${dateRange.from} - ${dateRange.to}</p>
            </div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Earnings</div>
                <div class="stat-value">₹${analytics.totalEarnings.toLocaleString("en-IN")}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Catches</div>
                <div class="stat-value">${analytics.totalCatches}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Average Weight</div>
                <div class="stat-value">${analytics.avgWeight.toFixed(1)} kg</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Top Species</div>
                <div class="stat-value" style="font-size: 24px;">${analytics.topSpecies}</div>
              </div>
            </div>
            <div class="section">
              <div class="section-title">Performance Overview</div>
              <table>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Details</th>
                </tr>
                <tr>
                  <td>Total Images Analyzed</td>
                  <td><strong>${analytics.totalImages}</strong></td>
                  <td>Individual fish photos processed</td>
                </tr>
                <tr>
                  <td>Total Catches</td>
                  <td><strong>${analytics.totalCatches}</strong></td>
                  <td>Successful catch identifications</td>
                </tr>
                <tr>
                  <td>Total Earnings</td>
                  <td><strong>₹${analytics.totalEarnings.toLocaleString("en-IN")}</strong></td>
                  <td>Estimated market value</td>
                </tr>
                <tr>
                  <td>Average Weight per Catch</td>
                  <td><strong>${analytics.avgWeight.toFixed(2)} kg</strong></td>
                  <td>Mean weight across all catches</td>
                </tr>
                <tr>
                  <td>Most Caught Species</td>
                  <td><strong>${analytics.topSpecies}</strong></td>
                  <td>Highest frequency species</td>
                </tr>
              </table>
            </div>
            <div class="page-number">Page 2</div>
          </div>

          <div class="page">
            <div class="header">
              <h1>Species Breakdown</h1>
              <p>Distribution of catches by species</p>
            </div>
            <div class="section">
              <div class="section-title">Species Distribution</div>
              ${analytics.speciesBreakdown
                .map(
                  (species: any) => `
                <div class="species-row">
                  <div class="species-name">${species.name}</div>
                  <div class="species-bar-container">
                    <div class="species-bar" style="width: ${species.percentage}%"></div>
                  </div>
                  <div class="species-stats">
                    <span class="species-count">${species.count}</span> (${species.percentage}%)
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>
            <div class="section">
              <div class="section-title">Species Details</div>
              <table>
                <tr>
                  <th>Species</th>
                  <th>Count</th>
                  <th>Percentage</th>
                  <th>Rank</th>
                </tr>
                ${analytics.speciesBreakdown
                  .map(
                    (species: any, index: number) => `
                  <tr>
                    <td><strong>${species.name}</strong></td>
                    <td>${species.count}</td>
                    <td>${species.percentage}%</td>
                    <td>#${index + 1}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </table>
            </div>
            <div class="page-number">Page 3</div>
          </div>

          <div class="page">
            <div class="header">
              <h1>Weekly Activity Trend</h1>
              <p>Earnings and catches over time</p>
            </div>
            <div class="section">
              <div class="section-title">Weekly Earnings Chart</div>
              <div class="chart-container">
                <div class="bar-chart">
                  ${analytics.weeklyTrend
                    .map((day: any) => {
                      const barHeight = Math.max(
                        (day.earnings / maxEarnings) * 100,
                        5,
                      );
                      return `
                    <div class="bar-wrapper">
                      <div class="bar-value">₹${(day.earnings / 1000).toFixed(1)}k</div>
                      <div class="bar-track">
                        <div class="bar" style="height: ${barHeight}%"></div>
                      </div>
                      <div class="bar-label">${day.date}</div>
                    </div>
                  `;
                    })
                    .join("")}
                </div>
              </div>
            </div>
            <div class="section">
              <div class="section-title">Weekly Activity Table</div>
              <table>
                <tr>
                  <th>Date</th>
                  <th>Earnings</th>
                  <th>Catches</th>
                  <th>Avg per Catch</th>
                </tr>
                ${analytics.weeklyTrend
                  .map(
                    (day: any) => `
                  <tr>
                    <td><strong>${day.date}</strong></td>
                    <td>₹${day.earnings.toLocaleString("en-IN")}</td>
                    <td>${day.catches}</td>
                    <td>₹${day.catches > 0 ? Math.round(day.earnings / day.catches).toLocaleString("en-IN") : "0"}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </table>
            </div>
            <div class="page-number">Page 4</div>
          </div>

          <div class="page">
            <div class="header">
              <h1>Quality Distribution</h1>
              <p>Catch quality grades breakdown</p>
            </div>
            <div class="section">
              <div class="section-title">Quality Grades</div>
              <table>
                <tr>
                  <th>Grade</th>
                  <th>Count</th>
                  <th>Percentage</th>
                </tr>
                ${analytics.qualityDistribution
                  .map((quality: any) => {
                    const percentage = (
                      (quality.count / qualityTotal) *
                      100
                    ).toFixed(1);
                    const badgeClass = quality.grade.toLowerCase();
                    return `
                  <tr>
                    <td>
                      <span class="quality-badge quality-${badgeClass}">
                        ${quality.grade}
                      </span>
                    </td>
                    <td><strong>${quality.count}</strong></td>
                    <td>${percentage}%</td>
                  </tr>
                `;
                  })
                  .join("")}
              </table>
            </div>
            <div class="page-number">Page 5</div>
          </div>

          ${
            catchHistory && catchHistory.length > 0
              ? catchPages
                  .map(
                    (page, pageIndex) => `
            <div class="page">
              <div class="header">
                <h1>Catch History</h1>
                <p>Detailed catch records (Page ${pageIndex + 1} of ${catchPages.length})</p>
              </div>
              <div class="section">
                <table>
                  <tr>
                    <th>Date</th>
                    <th>Species</th>
                    <th>Weight</th>
                    <th>Quality</th>
                    <th>Earnings</th>
                  </tr>
                  ${(page || [])
                    .map((catch_: any) => {
                      const badgeClass = catch_.quality.toLowerCase();
                      return `
                    <tr>
                      <td>${new Date(catch_.date).toLocaleDateString("en-IN")}</td>
                      <td><strong>${catch_.species}</strong></td>
                      <td>${catch_.weight.toFixed(2)} kg</td>
                      <td>
                        <span class="quality-badge quality-${badgeClass}">
                          ${catch_.quality}
                        </span>
                      </td>
                      <td>₹${catch_.earnings.toLocaleString("en-IN")}</td>
                    </tr>
                  `;
                    })
                    .join("")}
                </table>
              </div>
              <div class="page-number">Page ${6 + pageIndex}</div>
            </div>
          `,
                  )
                  .join("")
              : ""
          }

          <div class="page">
            <div style="min-height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">🐟</div>
              <h2 style="color: #1e40af; font-size: 28px; margin-bottom: 10px;">Matsya AI</h2>
              <p style="color: #64748b; font-size: 16px; margin-bottom: 40px;">
                AI-Powered Fisherman Assistance Platform
              </p>
              <p style="color: #94a3b8; font-size: 14px;">
                Generated on ${generatedDate}
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 10px;">
                © ${new Date().getFullYear()} Matsya AI - AI for Bharat
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
