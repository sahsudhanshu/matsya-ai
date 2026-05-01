const fs = require('fs');
const filePath = '/home/akshat/Desktop/matsya-ai/working/mobile/app/(tabs)/settings.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replacements object
const replacements = [
  ['style={styles.safe}', 'className="flex-1 bg-slate-900"'],
  ['style={styles.scroll}', 'className="flex-1"'],
  ['contentContainerStyle={styles.content}', 'contentContainerClassName="p-6 pb-16"'],
  ['style={styles.header}', 'className="mb-6 flex-row justify-between items-center"'],
  ['style={styles.title}', 'className="text-xl text-slate-50 font-bold"'],
  ['style={styles.profileCard}', 'className="flex-row items-center bg-slate-800 rounded-[20px] border border-slate-700 p-4 mb-6 gap-2"'],
  ['style={styles.profileAvatar}', 'className="w-12 h-12 rounded-full bg-blue-800 items-center justify-center"'],
  ['style={styles.profileAvatarText}', 'className="text-[17px] text-white font-bold"'],
  ['style={styles.profileInfo}', 'className="flex-1"'],
  ['style={styles.profileName}', 'className="text-[13px] font-semibold text-slate-50"'],
  ['style={styles.profileEmail}', 'className="text-xs text-slate-400 mt-0.5"'],
  ['style={styles.profileLocation}', 'className="text-[10px] text-slate-500 mt-0.5"'],
  ['style={styles.sectionLabel}', 'className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mb-1 mt-2 px-1"'],
  ['style={styles.menuCard}', 'className="mb-1 overflow-hidden"'],
  ['style={styles.loadingCard}', 'className="flex-row items-center justify-center p-6 gap-4"'],
  ['style={styles.loadingText}', 'className="text-xs text-slate-400"'],
  ['style={[styles.menuCard, { padding: SPACING.md }]}', 'className="mb-1 overflow-hidden p-4"'],
  ['style={styles.logoutBtn}', 'className="bg-red-500/15 border border-red-500/40 rounded-2xl p-2 items-center mt-6 mb-2"'],
  ['style={styles.logoutText}', 'className="text-red-500 text-xs font-semibold"'],
  ['style={styles.appInfo}', 'className="text-center text-slate-500 text-[10px] mb-2"'],
  ['style={styles.modalOverlay}', 'className="flex-1 bg-black/70 justify-center items-center p-8"'],
  ['style={styles.modalSheet}', 'className="bg-slate-800 rounded-[20px] p-6 pb-12 max-h-[80%] w-full"'],
  ['style={styles.modalTitle}', 'className="text-[13px] font-semibold text-slate-50 mb-2"'],
  ['style={[\\n                      styles.langOption,\\n                      code === locale && styles.langOptionActive,\\n                    ]}', 'className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${code === locale ? "bg-blue-800/15 rounded-xl px-2" : ""}`}'],
  ['style={[\\n                        styles.langOptionText,\\n                        code === locale && styles.langOptionTextActive,\\n                      ]}', 'className={`text-[13px] text-slate-200 ${code === locale ? "text-blue-500 font-bold" : ""}`}'],
  ['style={[\\n                    styles.langOption,\\n                    preferences?.boatType === type && styles.langOptionActive,\\n                  ]}', 'className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${preferences?.boatType === type ? "bg-blue-800/15 rounded-xl px-2" : ""}`}'],
  ['style={[\\n                      styles.langOptionText,\\n                      preferences?.boatType === type &&\\n                        styles.langOptionTextActive,\\n                    ]}', 'className={`text-[13px] text-slate-200 ${preferences?.boatType === type ? "text-blue-500 font-bold" : ""}`}'],
  ['style={[\\n                    styles.langOption,\\n                    preferences?.units === unit.value &&\\n                      styles.langOptionActive,\\n                  ]}', 'className={`flex-row justify-between items-center py-2 border-b border-slate-700 ${preferences?.units === unit.value ? "bg-blue-800/15 rounded-xl px-2" : ""}`}'],
  ['style={[\\n                      styles.langOptionText,\\n                      preferences?.units === unit.value &&\\n                        styles.langOptionTextActive,\\n                    ]}', 'className={`text-[13px] text-slate-200 ${preferences?.units === unit.value ? "text-blue-500 font-bold" : ""}`}'],
  ['style={[styles.menuCard, { maxHeight: 300 }]}', 'className="mb-1 overflow-hidden max-h-[300px]"']
];

for (const [oldStr, newStr] of replacements) {
  content = content.replace(oldStr, newStr);
}

// Strip out the StyleSheet.create block
content = content.replace(/const styles = StyleSheet\.create\(\{[\s\S]*?\}\);\s*$/, '');

// Remove StyleSheet import
content = content.replace(/,\n  StyleSheet/g, '');
content = content.replace(/StyleSheet,\n/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Transformation completed.");
