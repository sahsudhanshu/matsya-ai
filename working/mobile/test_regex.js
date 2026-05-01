const code = `
style={[
  styles.messageRow,
  item.role === "user" ? styles.messageRowUser : styles.messageRowBot,
]}
style={[styles.replyContext, isUser && styles.replyContextUser]}
style={[
  styles.messageContent,
  item.role === "user"
    ? styles.messageContentUser
    : styles.messageContentBot,
]}
style={styles.singleOne}
`;

const regexArrayTernary = /style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*([^?\]]+?)\s*\?\s*styles\.([a-zA-Z0-9_]+)\s*:\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}/g;
const regexArrayAnd = /style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*([^&\]]+?)&&\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}/g;

console.log("Ternary:", [...code.matchAll(regexArrayTernary)].map(m => m[0]));
console.log("And:", [...code.matchAll(regexArrayAnd)].map(m => m[0]));
