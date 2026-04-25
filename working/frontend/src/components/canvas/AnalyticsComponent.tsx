"use client";

import React, { useState, useEffect, useMemo } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Download,
  Search,
  Filter,
  Fish,
  Scale,
  DollarSign,
  Anchor,
  ArrowUpRight,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnalytics, getGroups } from "@/lib/api-client";
import type { AnalyticsResponse, GroupRecord } from "@/lib/api-client";
import { toast } from "sonner";
import type { PaneMessage } from "@/types/agent-first";
import { useAgentFirstStore } from "@/lib/stores/agent-first-store";
import { useLanguage } from "@/lib/i18n";

const PIE_COLORS = ["#3b82f6", "#065f46", "#d97706", "#334155"];

export interface AnalyticsComponentProps {
  /** Callback to dispatch PaneMessage to AgentInterface */
  onPaneMessage: (message: PaneMessage) => void;
  /** Optional date range filter */
  dateRange?: { from: string; to: string };
  /** Optional species to highlight */
  highlightSpecies?: string;
  /** Optional class for the outer container */
  className?: string;
}

function StatSkeleton() {
  return (
    <Card className="rounded-3xl border-border/50 bg-card/50 p-6">
      <Skeleton className="h-12 w-12 rounded-2xl mb-4" />
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32" />
    </Card>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn("rounded-3xl border-border/50 bg-card/50 p-8", className)}
    >
      <Skeleton className="h-6 w-40 mb-2" />
      <Skeleton className="h-4 w-56 mb-8" />
      <Skeleton className="h-[300px] w-full rounded-xl" />
    </Card>
  );
}

export default function AnalyticsComponent({
  onPaneMessage,
  dateRange,
  highlightSpecies,
  className,
}: AnalyticsComponentProps) {
  const { t } = useLanguage();
  const setActiveComponent = useAgentFirstStore((s) => s.setActiveComponent);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChartTab, setActiveChartTab] = useState("revenue");

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsData, groupsData] = await Promise.all([
          getAnalytics(),
          getGroups(20),
        ]);
        setAnalytics(analyticsData);
        setGroups(groupsData.groups || []);

        // Dispatch data_loaded PaneMessage
        if (analyticsData) {
          onPaneMessage({
            id: `analytics-loaded-${Date.now()}`,
            type: "info",
            source: "analytics",
            payload: {
              event: "analytics:data_loaded",
              totalCatches: analyticsData.totalCatches,
              totalEarnings: analyticsData.totalEarnings,
              dateRange: {
                from: new Date(
                  Date.now() - 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                to: new Date().toISOString(),
              },
            },
            timestamp: Date.now(),
            metadata: {
              userInitiated: false,
              requiresResponse: false,
            },
          });
        }
      } catch (err) {
        toast.error(t("analytics.failedLoad"));
        console.error(err);
      } finally {
        setIsLoadingAnalytics(false);
        setIsLoadingGroups(false);
      }
    };
    load();
  }, [onPaneMessage]);

  // Client-side search filter on the group history
  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();

      // Search in aggregate stats if analysis is complete
      if (group.analysisResult) {
        const stats = group.analysisResult.aggregateStats;
        const speciesNames = Object.keys(stats.speciesDistribution)
          .join(" ")
          .toLowerCase();
        if (speciesNames.includes(q)) return true;
        if (stats.diseaseDetected && "disease".includes(q)) return true;
      }

      // Search by status
      if (group.status.toLowerCase().includes(q)) return true;

      return false;
    });
  }, [groups, searchQuery]);

  const earningsData = analytics?.weeklyTrend ?? [];
  const speciesData = analytics?.speciesBreakdown ?? [];
  const pieData = speciesData.map((s, i) => ({
    ...s,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const summaryStats = analytics
    ? [
      {
        label: t("analytics.totalCatch"),
        value: `${((analytics.avgWeight / 1000) * analytics.totalCatches).toFixed(0)} kg`,
        icon: Scale,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      {
        label: t("analytics.topSpecies"),
        value: analytics.topSpecies.split(" ").slice(0, 2).join(" "),
        icon: Fish,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
      {
        label: t("analytics.totalCatches"),
        value: `${analytics.totalCatches}`,
        icon: Anchor,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
      },
    ]
    : [];

  // Handle chart click
  const handleChartClick = (
    chartType: "earnings" | "species",
    dataPoint: any,
  ) => {
    onPaneMessage({
      id: `analytics-chart-${Date.now()}`,
      type: "query",
      source: "analytics",
      payload: {
        event: "analytics:chart_click",
        chartType,
        dataPoint: {
          label: dataPoint.name || dataPoint.date || "Unknown",
          value:
            dataPoint.value ||
            dataPoint.earnings ||
            dataPoint.catches ||
            dataPoint.count ||
            0,
          date: dataPoint.date,
        },
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: true,
      },
    });
  };

  // Handle filter change
  const handleFilterChange = (query: string) => {
    setSearchQuery(query);

    onPaneMessage({
      id: `analytics-filter-${Date.now()}`,
      type: "action",
      source: "analytics",
      payload: {
        event: "analytics:filter_change",
        species: query || undefined,
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: false,
      },
    });
  };

  // Handle export request
  const handleExportRequest = () => {
    try {
      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("MatsyaAI - Analysis Report", 14, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);

      if (analytics) {
        y += 15;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Summary Stats", 14, y);
        y += 8;
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Total Catch Weight: ${((analytics.avgWeight / 1000) * analytics.totalCatches).toFixed(0)} kg`, 18, y);
        y += 6;
        doc.text(`Top Species: ${analytics.topSpecies}`, 18, y);
        y += 6;
        doc.text(`Total Catches: ${analytics.totalCatches}`, 18, y);
        y += 6;
        doc.text(`Est. Revenue: Rs ${analytics.totalEarnings.toLocaleString()}`, 18, y);
        
        // Species Breakdown
        if (analytics.speciesBreakdown && analytics.speciesBreakdown.length > 0) {
          y += 15;
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("Species Breakdown", 14, y);
          
          autoTable(doc, {
            startY: y + 5,
            head: [["Species", "Count"]],
            body: analytics.speciesBreakdown.map((s: { name: string, count: number }) => [s.name, s.count?.toString() || '0']),
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y = (doc as any).lastAutoTable.finalY + 15;
        }
      }

      if (groups && groups.length > 0) {
        if (y > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          y = 20;
        } else {
           y += 5;
        }
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Historical Log", 14, y);
        
        const tableData = [];
        for (const g of groups) {
          const stats = g.analysisResult?.aggregateStats;
          
          tableData.push([
            new Date(g.createdAt).toLocaleDateString(),
            stats?.totalFishCount?.toString() || '0',
            stats?.totalEstimatedWeight ? `${stats.totalEstimatedWeight.toFixed(1)} kg` : '-',
            `Rs ${stats?.totalEstimatedValue || 0}`
          ]);
        }
        
        if (tableData.length > 0) {
          autoTable(doc, {
            startY: y + 5,
            head: [["Date", "Fish Count", "Weight", "Value"]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
          });
        }
      }

      doc.save(`matsyaai-analytics-${Date.now()}.pdf`);
      toast.success("Report generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report");
    }

    onPaneMessage({
      id: `analytics-export-${Date.now()}`,
      type: "action",
      source: "analytics",
      payload: {
        event: "analytics:export_request",
      },
      timestamp: Date.now(),
      metadata: {
        userInitiated: true,
        requiresResponse: true,
      },
    });
  };

  return (
    <div className={cn("space-y-4 sm:space-y-6 pb-6", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="rounded-xl bg-primary font-bold shadow-lg shadow-primary/20 gap-2"
            onClick={handleExportRequest}
            disabled={isLoadingAnalytics || !analytics}
          >
            <Download className="w-4 h-4" />{t("analytics.generateReport")}</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoadingAnalytics
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : summaryStats.map((stat, i) => (
            <Card
              key={i}
              className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
            >
              <CardContent className="p-3 sm:p-4 lg:p-5">
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`${stat.bg} p-2 sm:p-2.5 rounded-xl ${stat.color}`}
                  >
                    <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Earnings Chart */}
        {isLoadingAnalytics ? (
          <ChartSkeleton className="lg:col-span-8" />
        ) : (
          <Card className="lg:col-span-8 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-6">
            <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold">{t("analytics.earningsOverview")}</CardTitle>
                <CardDescription>
                  {activeChartTab === "revenue"
                    ? t("analytics.dailyRevenueDesc")
                    : t("analytics.dailyCatchDesc")}
                </CardDescription>
              </div>
              <Tabs
                defaultValue="revenue"
                onValueChange={setActiveChartTab}
                className="w-[200px]"
              >
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 rounded-xl">
                  <TabsTrigger
                    value="revenue"
                    className="rounded-lg text-xs font-bold"
                  >{t("analytics.revenueTab")}</TabsTrigger>
                  <TabsTrigger
                    value="catch"
                    className="rounded-lg text-xs font-bold"
                  >{t("analytics.catchTab")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <div className="h-[220px] sm:h-[280px] lg:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs>
                    <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                    }}
                    itemStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey={
                      activeChartTab === "revenue" ? "earnings" : "catches"
                    }
                    stroke="#3b82f6"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorMain)"
                    onClick={(data) => handleChartClick("earnings", data)}
                    style={{ cursor: "pointer" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Species Distribution */}
        {isLoadingAnalytics ? (
          <ChartSkeleton className="lg:col-span-4" />
        ) : (
          <Card className="lg:col-span-4 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-6 flex flex-col">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-base sm:text-lg font-bold">{t("analytics.catchDistribution")}</CardTitle>
              <CardDescription>{t("analytics.speciesBreakdown")}</CardDescription>
            </CardHeader>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-[220px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={8}
                      dataKey="count"
                      onClick={(data) => handleChartClick("species", data)}
                      style={{ cursor: "pointer" }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold">
                    {pieData[0]?.percentage ?? 0}%
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("analytics.topSpecies")}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full mt-6">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-bold text-muted-foreground truncate tracking-tight">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold ml-auto">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Group History Table */}
      <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="p-6 sm:p-8 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">{t("analytics.analysisHistory")}</CardTitle>
              <CardDescription>{t("analytics.reviewResults")}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("analytics.filterPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="pl-10 h-10 w-full sm:w-64 bg-muted/30 border-none rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingGroups ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">{t("analytics.loadingHistory")}</span>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[750px]">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="pl-8 font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("analytics.tableGroup")}</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("analytics.tableFishCount")}</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("analytics.tableSpecies")}</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("analytics.tableDisease")}</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("analytics.tableDate")}</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">{t("analytics.tableStatus")}</TableHead>
                      <TableHead className="pr-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-12 text-muted-foreground"
                        >
                          {searchQuery
                            ? t("analytics.noMatches")
                            : t("analytics.noHistory")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((group) => {
                        const stats = group.analysisResult?.aggregateStats;
                        const fishCount = stats?.totalFishCount ?? 0;
                        const speciesCount = stats
                          ? Object.keys(stats.speciesDistribution).length
                          : 0;
                        const topSpecies = stats
                          ? Object.keys(stats.speciesDistribution)[0]
                          : "-";
                        const hasDisease = stats?.diseaseDetected ?? false;

                        return (
                          <TableRow
                            key={group.groupId}
                            className="border-border/50 hover:bg-muted/10 group transition-colors cursor-pointer"
                            onClick={() =>
                              setActiveComponent("history", {
                                selectedGroupId: group.groupId,
                              })
                            }
                          >
                            <TableCell className="pl-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary overflow-hidden shrink-0">
                                  {group.presignedViewUrls?.[0] ? (
                                    <img src={group.presignedViewUrls[0]} alt="Catch Thumbnail" className="w-full h-full object-cover" />
                                  ) : (
                                    <Fish className="w-5 h-5" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-base">
                                    {group.imageCount}{" "}
                                    {group.imageCount === 1 ? t("analytics.image") : t("analytics.images")}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {t("analytics.groupId")} {group.groupId.slice(0, 8)}...
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-foreground/80">{fishCount} {t("history.fish")}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-sm">
                                  {topSpecies}
                                </span>
                                {speciesCount > 1 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{speciesCount - 1} {t("analytics.more")}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full border-none px-3 py-1 text-[10px] font-bold uppercase",
                                  hasDisease
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-500",
                                )}
                              >
                                {hasDisease ? t("analytics.detected") : t("analytics.healthy")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-medium">
                              {new Date(group.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "rounded-lg border-none px-2 py-0.5 text-[10px] font-bold uppercase",
                                  group.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : group.status === "processing"
                                      ? "bg-blue-500/10 text-blue-500"
                                      : group.status === "partial"
                                        ? "bg-amber-500/10 text-amber-500"
                                        : group.status === "failed"
                                          ? "bg-red-500/10 text-red-500"
                                          : "bg-gray-500/10 text-gray-500",
                                )}
                              >
                                {group.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl opacity-0 lg:group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
        <CardHeader className="p-6 sm:p-8 border-t border-border/50 bg-muted/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-muted-foreground font-medium">{t("analytics.showingGroups").replace("{filtered}", filteredGroups.length.toString()).replace("{total}", groups.length.toString())}</span>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
