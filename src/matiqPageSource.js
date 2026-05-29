import pageSource from "../matiq-site.html?raw";

function getMatch(pattern) {
  const match = pageSource.match(pattern);
  return match ? match[1].trim() : "";
}

const title = getMatch(/<title>([\s\S]*?)<\/title>/i);
const body = getMatch(/<body[^>]*>([\s\S]*?)<\/body>/i)
  .replace(/<script>[\s\S]*?<\/script>/gi, "")
  .trim();

export { body, title };
