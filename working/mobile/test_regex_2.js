const code = `
style={[
  styles.sendBtn,
  !inputText.trim() && !pendingImage && styles.sendBtnDisabled,
]}
`;
const regexArrayAnd = /style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*(.+?)&&\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}/gs;
const regexArrayTernary = /style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*(.+?)\s*\?\s*styles\.([a-zA-Z0-9_]+)\s*:\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}/gs;

console.log("And:", [...code.matchAll(regexArrayAnd)].map(m => m[0]));
