const fs = require('fs');

const classMap = {
  safe: "flex-1 bg-bgDark",
  flex: "flex-1",
  
  header: "flex-row items-center h-[52px] px-3 border-b-[0.5px] border-borderDark bg-bgDark",
  headerBtn: "w-[38px] h-[38px] rounded-[10px] items-center justify-center",
  headerCenter: "flex-1 flex-row items-center justify-center gap-2",
  headerLogo: "w-7 h-7 rounded-lg bg-primaryDark items-center justify-center",
  headerTitle: "text-[15px] font-semibold text-textPrimary max-w-[45%]",
  headerActions: "flex-row items-center gap-0.5",

  messageList: "pt-2 pb-3",
  messageListEmpty: "flex-grow justify-end",
  
  messageRow: "px-4 py-[6px] flex-row items-start",
  messageRowBot: "gap-[10px]",
  messageRowUser: "justify-end",
  
  botAvatar: "w-[30px] h-[30px] rounded-[10px] bg-primary/25 border-[1.5px] border-primaryLight/40 items-center justify-center mt-0.5 shrink-0",
  
  messageContent: "max-w-[78%] shrink",
  messageContentBot: "flex-1",
  messageContentUser: "bg-primary rounded-[18px] rounded-br-[4px] px-[14px] pt-2.5 pb-2 shadow-sm shadow-primaryLight/15 elevation-3",
  
  userText: "text-[#e0ecff] text-[14px] leading-[21px]",
  
  messageFooter: "flex-row items-center mt-1 gap-2",
  messageFooterUser: "justify-end",
  messageTime: "text-[10px] text-textSubtle",
  messageTimeUser: "text-[#bfdbfe]/55",
  ttsBtn: "p-0.5",
  
  replyContext: "bg-white/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primaryLight",
  replyContextUser: "bg-white/10",
  replyContent: "flex-1",
  replyAuthor: "text-[11px] font-semibold text-primaryLight mb-[1px]",
  replyText: "text-[11px] text-textMuted leading-[15px]",
  
  analysisReference: "flex-row items-center bg-white/5 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 border-primaryLight gap-2",
  analysisThumb: "w-9 h-9 rounded-md bg-bgDark",
  analysisThumbPlaceholder: "justify-center items-center",
  analysisInfo: "flex-1",
  analysisLabel: "text-[11px] font-semibold text-primaryLight mb-[1px]",
  analysisSpecies: "text-[11px] text-textMuted",
  
  swipeReplyAction: "justify-center items-center w-14 pr-2",
  swipeReplyCircle: "w-[34px] h-[34px] rounded-full bg-bgCard border border-borderDark items-center justify-center",
  
  typingRow: "flex-row items-center gap-2.5 px-4 py-2",
  typingBubble: "flex-row items-center gap-2 bg-bgCard rounded-[14px] px-[14px] py-2.5 border border-borderDark",
  typingDots: "flex-row items-center gap-1",
  typingLabel: "text-textMuted text-[12px]",
  dot: "w-1.5 h-1.5 rounded-full bg-primaryLight",
  stopBtn: "p-1 ml-0.5",
  
  capabilityHub: "px-4 pt-4 pb-2.5 bg-bgDark",
  hubHeader: "flex-row items-center mb-[14px] gap-3",
  hubIconWrap: "w-10 h-10 rounded-xl bg-primary items-center justify-center",
  hubHeaderText: "flex-1",
  hubGreeting: "text-[16px] font-bold text-textPrimary tracking-[0.2px]",
  hubSubtitle: "text-[12px] text-textMuted mt-[1px]",
  capGrid: "flex-row flex-wrap gap-2 mb-3",
  capCard: "w-[23.5%] bg-bgCard rounded-xl border border-borderDark py-2.5 px-1.5 items-center gap-1",
  capIconWrap: "w-[34px] h-[34px] rounded-[10px] items-center justify-center mb-0.5",
  capLabel: "text-[10px] font-semibold text-textPrimary text-center leading-[13px]",
  capDesc: "text-[8px] text-[#8c8c8c] text-center leading-[10px]",
  
  actionBar: "flex-row items-center justify-center gap-1 mb-2",
  actionBarBtn: "w-9 h-8 rounded-lg bg-bgCard border border-borderDark items-center justify-center",
  
  chipRow: "gap-2 pb-0.5",
  chip: "flex-row items-center bg-bgCard rounded-full border border-borderDark px-3 py-[7px] gap-[5px]",
  chipText: "text-textSecondary text-[12px] font-medium",
  
  inputArea: "bg-bgDark px-3 pt-2 pb-2.5 border-t-[0.5px] border-borderDark",
  inputRow: "flex-row items-end bg-bgCard rounded-[22px] border border-borderDark pl-1.5 pr-1 py-1",
  attachBtn: "w-[38px] h-[38px] items-center justify-center",
  textInput: "flex-1 py-2 px-2 text-textPrimary text-[14px] max-h-[100px] min-h-[36px] leading-5",
  sendBtn: "w-9 h-9 rounded-full bg-primary items-center justify-center",
  sendBtnDisabled: "bg-bgSurface opacity-40",
  
  replyPreview: "flex-row items-center bg-bgCard rounded-lg px-3 py-2 mb-1.5 gap-2",
  replyPreviewBar: "w-[3px] h-full bg-primaryLight rounded-sm absolute left-0 top-0 bottom-0",
  replyPreviewBody: "flex-1 flex-row items-center gap-2 pl-1",
  replyPreviewTextCol: "flex-1",
  replyPreviewAuthor: "text-[11px] font-semibold text-primaryLight mb-[1px]",
  replyPreviewMessage: "text-[11px] text-textMuted",
  
  analysisPreview: "flex-row items-center bg-bgCard rounded-lg px-3 py-2 mb-1.5 gap-2",
  analysisPreviewBody: "flex-1 flex-row items-center gap-2 pl-1",
  analysisPreviewThumb: "w-8 h-8 rounded-md bg-bgSurface",
  analysisPreviewThumbPlaceholder: "justify-center items-center",
  analysisPreviewTextCol: "flex-1",
  analysisPreviewLabel: "text-[11px] font-semibold text-primaryLight mb-[1px]",
  analysisPreviewSpecies: "text-[11px] text-textMuted",
  
  sidebarOverlay: "flex-1 bg-black/55",
  sidebar: "absolute left-0 top-0 bottom-0 w-[78%] bg-bgDark border-r-[0.5px] border-borderDark pt-[54px]",
  sidebarHeader: "flex-row justify-between items-center px-4 pb-3.5 border-b-[0.5px] border-borderDark",
  sidebarTitle: "text-[14px] font-bold text-textPrimary tracking-[0.3px]",
  newChatBtn: "flex-row items-center justify-center bg-primary mx-4 mt-3.5 mb-2.5 py-2.5 rounded-lg gap-1.5",
  newChatText: "text-white text-[13px] font-semibold",
  chatListScroll: "flex-1 px-2.5 pt-1.5",
  chatListItem: "flex-row items-center justify-between py-2.5 px-2.5 rounded-lg mb-0.5",
  chatListItemActive: "bg-primary/10 border border-primary/40",
  chatListItemContent: "flex-row items-center gap-2.5 flex-1",
  chatListItemText: "flex-1",
  chatListText: "text-textSecondary text-[13px] leading-[18px]",
  chatListTextActive: "text-primaryLight font-semibold",
  chatListTime: "text-textSubtle text-[10px] mt-0.5",
  deleteBtn: "p-1.5",
  emptyChatList: "items-center justify-center py-12 px-6",
  emptyChatTitle: "text-[14px] font-semibold text-textPrimary mt-3 mb-1 text-center",
  emptyChatText: "text-[12px] text-textMuted text-center leading-[18px]",
  
  offlineOverlay: "absolute top-0 left-0 right-0 bottom-0 bg-[#0f172a]/95 z-[1000] justify-center items-center p-8",
  offlineCard: "bg-bgCard rounded-2xl p-7 items-center max-w-[300px] border border-borderDark",
  offlineTitle: "text-[15px] font-semibold text-textPrimary mt-3 mb-1.5",
  offlineText: "text-[13px] text-textMuted text-center leading-[19px]"
};

let code = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');

function processStyles(code) {
  let result = '';
  let i = 0;
  while (i < code.length) {
    const idx = code.indexOf('style={', i);
    if (idx === -1) {
      result += code.slice(i);
      break;
    }
    result += code.slice(i, idx);
    
    // Find matching bracket
    let braceCount = 0;
    let j = idx + 6; // index of '{'
    let styleStr = '';
    while (j < code.length) {
      if (code[j] === '{') braceCount++;
      if (code[j] === '}') braceCount--;
      styleStr += code[j];
      j++;
      if (braceCount === 0) break;
    }
    
    const fullStyleAttr = "style=" + styleStr;
    const transformed = transformStyle(fullStyleAttr);
    result += transformed;
    
    i = j;
  }
  return result;
}

function transformStyle(str) {
  // array ternary
  let m = str.match(/^style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*([\s\S]*?)\s*\?\s*styles\.([a-zA-Z0-9_]+)\s*:\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}$/);
  if (m) {
    return `className={\`${classMap[m[1]]} \${${m[2].trim()} ? '${classMap[m[3]]}' : '${classMap[m[4]]}'}\`}`;
  }
  
  // array AND
  m = str.match(/^style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*([\s\S]*?)\s*&&\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}$/);
  if (m) {
    return `className={\`${classMap[m[1]]} \${${m[2].trim()} ? '${classMap[m[3]]}' : ''}\`}`;
  }
  
  // array 2 styles simple
  m = str.match(/^style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}$/);
  if (m) {
    return `className="${classMap[m[1]]} ${classMap[m[2]]}"`;
  }
  
  // array with inline object
  m = str.match(/^style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*(\{[\s\S]*?\})\s*,?\s*\]\s*\}$/);
  if (m) {
    return `className="${classMap[m[1]]}" style={${m[2]}}`;
  }
  
  // single
  m = str.match(/^style=\{\s*styles\.([a-zA-Z0-9_]+)\s*\}$/);
  if (m) {
    return `className="${classMap[m[1]]}"`;
  }
  
  return str;
}

code = processStyles(code);

// Remove the StyleSheet.create block
code = code.replace(/const styles = StyleSheet\.create\(\{[\s\S]*\}\);\s*/, '');

fs.writeFileSync('app/(tabs)/chat.tsx', code);
console.log("Successfully migrated chat.tsx");
