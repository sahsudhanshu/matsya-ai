const code = `
style={[styles.swipeReplyAction, { opacity, transform: [{ scale }] }]}
<View>
style={[styles.replyContext, isUser && styles.replyContextUser]}
`;
const regexArrayAnd = /style=\{\s*\[\s*styles\.([a-zA-Z0-9_]+)\s*,\s*(((?!styles\.)[\s\S])*?)\s*&&\s*styles\.([a-zA-Z0-9_]+)\s*,?\s*\]\s*\}/g;

console.log([...code.matchAll(regexArrayAnd)].map(m => m[0]));
