const fs = require('fs');

const classMap = {
  safe: "flex-1 bg-bgDark",
  header: "flex-row items-center px-4 py-3 gap-3 border-b border-border bg-bgDark",
  headerText: "flex-1",
  headerTitle: "text-lg font-bold text-textPrimary",
  headerSub: "text-xs text-textMuted mt-0.5",
  iconBtn: "w-[34px] h-[34px] rounded-lg border border-border bg-bgCard items-center justify-center",
  pillBtn: "flex-row items-center gap-1 rounded-lg border border-border bg-bgCard px-4 py-1.5",
  pillBtnAlert: "border-[#f8717155] bg-[#f8717114]",
  pillBtnText: "text-xs font-semibold text-textSecondary",
  sunStrip: "flex-row items-center gap-[5px] px-4 py-[6px] bg-bgCard border-b border-border",
  sunText: "text-xs text-textSecondary",
  sunDivider: "w-[1px] h-3 bg-border mx-1",
  safetyBadge: "px-2 py-[2px] rounded-full",
  safeBadge: "bg-secondaryLight/20",
  unsafeBadge: "bg-[#f8717120]",
  safetyText: "text-xs font-bold tracking-[0.3px]",
  alertsOverlay: "absolute top-2 left-2 right-2 z-40 bg-[rgba(10,15,30,0.90)] rounded-xl border border-[rgba(255,255,255,0.10)] p-3 shadow-lg elevation-12",
  alertsOverlayHeader: "flex-row justify-between items-center mb-2",
  alertsOverlayTitle: "text-sm font-bold text-textPrimary",
  alertEmpty: "flex-row items-center gap-2 py-1.5",
  alertEmptyText: "text-sm text-textMuted",
  alertRow: "flex-row items-center py-1.5 border-b border-[rgba(255,255,255,0.06)]",
  alertTitle: "text-sm font-semibold",
  alertDesc: "text-xs text-textMuted mt-[1px]",
  legendBox: "mx-4 mb-2 bg-bgCard rounded-md border border-border p-3",
  legendLabel: "text-xs font-bold text-textMuted mb-1 uppercase tracking-wide",
  legendBar: "flex-row h-[10px] rounded-sm overflow-hidden",
  legendSegment: "flex-1",
  legendValues: "flex-row justify-between mt-[3px]",
  legendValue: "text-[9px] text-textSubtle font-bold",
  mapContainer: "flex-1 relative",
  map: "absolute top-0 bottom-0 left-0 right-0",
  dot: "w-[28px] h-[28px] rounded-full items-center justify-center border-2 border-[rgba(255,255,255,0.2)]",
  mapSpinner: "absolute top-3 self-center bg-bgCard/90 rounded-full p-2 border border-border z-10",
  fabRight: "absolute right-3 bottom-20 gap-2 items-center z-50",
  fabSmall: "w-[42px] h-[42px] rounded-full bg-bgCard border border-border items-center justify-center shadow-md elevation-5",
  fabSmallActive: "border-[rgba(34,211,238,0.33)] bg-[rgba(34,211,238,0.09)]",
  layersPopup: "absolute right-[62px] bottom-[56px] bg-bgCard rounded-xl border border-border p-3 w-[210px] z-50 shadow-lg elevation-10",
  layersPopupTitle: "text-xs font-bold text-textMuted uppercase tracking-wide px-3 py-1 mb-0.5",
  layerRow: "flex-row items-center gap-3 p-3 rounded-md",
  layerRowActive: "bg-[rgba(34,211,238,0.07)]",
  layerIconBox: "w-[34px] h-[34px] rounded-sm bg-bgSurface items-center justify-center",
  layerIconBoxActive: "bg-[rgba(34,211,238,0.13)]",
  layerLabel: "text-sm font-semibold text-textSecondary",
  layerLabelActive: "text-primaryLight",
  layerDesc: "text-xs text-textMuted mt-[1px]",
  layerClearBtn: "mt-1 py-2 items-center border-t border-border",
  layerClearText: "text-xs text-[#f87171] font-semibold",
  fabScanWrapper: "absolute left-4 bottom-5 z-50",
  fabScan: "flex-row items-center gap-2 bg-[#1d4ed8] rounded-full py-[13px] px-5 shadow-lg elevation-8 shadow-[#1d4ed8]/55",
  fabScanLabel: "text-sm font-bold text-white tracking-[0.3px]",
  tapCard: "absolute w-[220px] z-30 bg-[rgba(10,15,30,0.92)] rounded-xl border border-[rgba(255,255,255,0.12)] p-3 shadow-lg elevation-10",
  tapCardRow: "flex-row items-center gap-2 py-1",
  tapCardLoadText: "text-xs text-textMuted",
  tapCardHeader: "flex-row items-start justify-between mb-1.5",
  tapCardCoords: "text-xs font-bold text-textPrimary tracking-[0.2px]",
  tapCardDesc: "text-[10px] text-textMuted mt-0.5 capitalize",
  tapCardStats: "flex-row gap-3 mb-3 flex-wrap",
  tapCardStat: "flex-row items-center gap-[3px]",
  tapCardStatVal: "text-xs text-textSecondary",
  sendToAIBtn: "flex-row items-center justify-center gap-[5px] bg-primaryLight rounded-full py-[7px] px-3.5",
  sendToAIText: "text-xs font-semibold text-white",
  scanOverlay: "absolute bottom-0 left-0 right-0 h-[52%] z-20 bg-[rgba(8,12,26,0.94)] rounded-t-[24px] border-t border-l border-r border-[rgba(255,255,255,0.10)] pt-3 px-4 pb-6 shadow-xl elevation-16",
  scanHandle: "self-center w-[36px] h-1 rounded-full bg-[rgba(255,255,255,0.18)] mb-3",
  scanOverlayHeader: "flex-row items-start mb-3",
  scanOverlayTitle: "text-lg font-bold text-textPrimary",
  scanOverlayStage: "text-xs text-primaryLight mt-0.5 tracking-[0.3px]",
  scanCancelBtn: "flex-row items-center gap-1 py-1.5 px-3 rounded-full border border-[#f8717155] bg-[#f8717112]",
  scanCancelText: "text-xs font-semibold text-[#f87171]",
  scanProgressBg: "h-[3px] bg-[rgba(255,255,255,0.08)] rounded-sm overflow-hidden mb-3",
  scanProgressFill: "h-[3px] bg-primaryLight rounded-sm",
  scanResultBox: "items-center py-4 gap-3",
  scanResultText: "text-sm text-textSecondary text-center leading-5 px-4",
  scanActionBtn: "flex-row items-center gap-1.5 mt-2 py-2.5 px-6 rounded-full bg-primaryLight",
  scanActionBtnText: "text-sm font-bold text-white",
  scanFeed: "flex-1 mb-2",
  scanFeedRow: "flex-row items-start gap-2 py-[5px] border-b border-[rgba(255,255,255,0.05)]",
  scanFeedDot: "w-1.5 h-1.5 rounded-full bg-textSubtle mt-[5px]",
  scanFeedDotActive: "bg-primaryLight w-2 h-2 rounded-full",
  scanFeedText: "flex-1 text-xs text-textMuted leading-[17px]",
  scanFeedTextActive: "text-textPrimary font-semibold",
  scanHint: "text-[10px] text-textSubtle text-center leading-[15px]",
  infoCard: "mx-4 mt-2 mb-3 bg-bgCard rounded-lg border border-border p-4 shadow-md elevation-4",
  infoCardHeader: "flex-row justify-between items-start",
  infoTitle: "text-base font-bold text-textPrimary",
  infoSubtitle: "text-xs text-textMuted mt-0.5 capitalize",
  infoStats: "flex-row items-center gap-3 mt-3 flex-wrap",
  infoStat: "flex-row items-center gap-1",
  infoStatText: "text-sm text-textSecondary",
  infoMeta: "text-xs text-textSubtle mt-1",
  gradeBadge: "px-2 py-[3px] rounded-full",
  gradeText: "text-xs font-bold",
  confidenceBox: "mt-3 mb-2",
  confidenceLabel: "text-xs text-textMuted uppercase tracking-wide",
  confidenceScore: "text-lg font-bold",
  confidenceMax: "text-xs text-textMuted font-normal",
  barBg: "h-1.5 rounded-[3px] bg-bgSurface mt-1 overflow-hidden",
  barFill: "h-1.5 rounded-[3px]",
  scoreTile: "flex-1 items-center p-3 rounded-sm bg-bgSurface gap-[3px]",
  scoreTileLabel: "text-[10px] text-textMuted text-center",
  scoreTileValue: "text-sm font-bold text-textPrimary",
  chloTag: "flex-row items-center gap-[5px] mt-1.5",
  chloTagText: "text-xs text-[#22d3ee]"
};

const customReplacements = [
  {
    from: 'style={[styles.pillBtn, alertsVisible && styles.pillBtnAlert]}',
    to: 'className={`' + classMap.pillBtn + ' ${alertsVisible ? \\\'border-[#f8717155] bg-[#f8717114]\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.pillBtnText, alertsVisible && { color: "#f87171" }]}',
    to: 'className="' + classMap.pillBtnText + '" style={alertsVisible ? { color: "#f87171" } : undefined}'
  },
  {
    from: 'style={[styles.safetyBadge, safetyStatus === "SAFE" ? styles.safeBadge : styles.unsafeBadge]}',
    to: 'className={`' + classMap.safetyBadge + ' ${safetyStatus === "SAFE" ? \\\'bg-secondaryLight/20\\\' : \\\'bg-[#f8717120]\\\'}`}'
  },
  {
    from: 'style={[styles.safetyText, { color: safetyStatus === "SAFE" ? COLORS.secondaryLight : "#f87171" }]}',
    to: 'className="' + classMap.safetyText + '" style={{ color: safetyStatus === "SAFE" ? COLORS.secondaryLight : "#f87171" }}'
  },
  {
    from: 'style={[styles.legendSegment, { backgroundColor: s.color }]}',
    to: 'className="' + classMap.legendSegment + '" style={{ backgroundColor: s.color }}'
  },
  {
    from: 'style={[styles.dot, { backgroundColor: GRADE_COLOR[m.qualityGrade ?? ""] ?? GRADE_COLOR.Low }]}',
    to: 'className="' + classMap.dot + '" style={{ backgroundColor: GRADE_COLOR[m.qualityGrade ?? ""] ?? GRADE_COLOR.Low }}'
  },
  {
    from: 'style={[styles.fabSmall, activeLayer && styles.fabSmallActive]}',
    to: 'className={`' + classMap.fabSmall + ' ${activeLayer ? \\\'border-[rgba(34,211,238,0.33)] bg-[rgba(34,211,238,0.09)]\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.layerRow, activeLayer === layer.id && styles.layerRowActive]}',
    to: 'className={`' + classMap.layerRow + ' ${activeLayer === layer.id ? \\\'bg-[rgba(34,211,238,0.07)]\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.layerIconBox, activeLayer === layer.id && styles.layerIconBoxActive]}',
    to: 'className={`' + classMap.layerIconBox + ' ${activeLayer === layer.id ? \\\'bg-[rgba(34,211,238,0.13)]\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.layerLabel, activeLayer === layer.id && styles.layerLabelActive]}',
    to: 'className={`' + classMap.layerLabel + ' ${activeLayer === layer.id ? \\\'text-primaryLight\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.tapCard, tapCard.cardX !== undefined && tapCard.cardY !== undefined ? { left: tapCard.cardX, top: tapCard.cardY } : { left: 12, top: 60 }]}',
    to: 'className="' + classMap.tapCard + '" style={tapCard.cardX !== undefined && tapCard.cardY !== undefined ? { left: tapCard.cardX, top: tapCard.cardY } : { left: 12, top: 60 }}'
  },
  {
    from: 'style={[styles.scanProgressFill, { width: `${scanProgress.pct}%` as any }]}',
    to: 'className="' + classMap.scanProgressFill + '" style={{ width: `${scanProgress.pct}%` as any }}'
  },
  {
    from: 'style={[styles.scanResultText, { color: "#f87171" }]}',
    to: 'className="' + classMap.scanResultText + '" style={{ color: "#f87171" }}'
  },
  {
    from: 'style={[styles.scanFeedDot, i === scanMessages.length - 1 && styles.scanFeedDotActive]}',
    to: 'className={`' + classMap.scanFeedDot + ' ${i === scanMessages.length - 1 ? \\\'bg-primaryLight w-2 h-2 rounded-full\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.scanFeedText, i === scanMessages.length - 1 && styles.scanFeedTextActive]}',
    to: 'className={`' + classMap.scanFeedText + ' ${i === scanMessages.length - 1 ? \\\'text-textPrimary font-semibold\\\' : \\\'\\\'}`}'
  },
  {
    from: 'style={[styles.gradeBadge, { backgroundColor: (GRADE_COLOR[selectedMarker.qualityGrade] ?? GRADE_COLOR.Low) + "22" }]}',
    to: 'className="' + classMap.gradeBadge + '" style={{ backgroundColor: (GRADE_COLOR[selectedMarker.qualityGrade] ?? GRADE_COLOR.Low) + "22" }}'
  },
  {
    from: 'style={[styles.gradeText, { color: GRADE_COLOR[selectedMarker.qualityGrade] ?? GRADE_COLOR.Low }]}',
    to: 'className="' + classMap.gradeText + '" style={{ color: GRADE_COLOR[selectedMarker.qualityGrade] ?? GRADE_COLOR.Low }}'
  },
  {
    from: 'style={[styles.confidenceScore, { color: selectedSpot.color }]}',
    to: 'className="' + classMap.confidenceScore + '" style={{ color: selectedSpot.color }}'
  },
  {
    from: 'style={[styles.barFill, { width: `${selectedSpot.confidence}%` as any, backgroundColor: selectedSpot.color }]}',
    to: 'className="' + classMap.barFill + '" style={{ width: `${selectedSpot.confidence}%` as any, backgroundColor: selectedSpot.color }}'
  },
  {
    from: 'style={[styles.infoSubtitle, { marginTop: 2 }]}',
    to: 'className="' + classMap.infoSubtitle + '" style={{ marginTop: 2 }}'
  }
];

let content = fs.readFileSync('app/(tabs)/map.tsx', 'utf8');

// Apply custom replacements
for (const rep of customReplacements) {
  content = content.replace(rep.from, rep.to);
}

// Ensure all exact multiline object-style array replacements work if any. Wait, the array styles are inline.

// Replace single styles
for (const [key, val] of Object.entries(classMap)) {
  const regex = new RegExp(`style=\\{styles\\.${key}\\}`, 'g');
  content = content.replace(regex, `className="${val}"`);
}

// Remove StyleSheet.create block
content = content.replace(/\n\/\/ ─────────────────────────────────────────────────────────────────────────────\nconst styles = StyleSheet\.create\(\{[\s\S]*?\}\);\n/m, '');

// Also remove StyleSheet import if it exists.
content = content.replace(/StyleSheet,\\s*/, '');

fs.writeFileSync('app/(tabs)/map.tsx', content);
console.log('Migration complete!');
