export interface CrawlOptions {
  maxPages?: number;
  /** Stay on the start URL's origin. */
  sameOrigin?: boolean;
  fetch?: typeof fetch;
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  links: string[];
}

const stripTags = (html: string) => html.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function extractPage(url: string, html: string): CrawledPage {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const link = new URL(match[1]!, url);
      if (link.protocol === "http:" || link.protocol === "https:") links.add(link.href);
    } catch {}
  }
  return { url, title, text: stripTags(html), links: [...links] };
}

/** Small polite breadth-first crawl for static pages. JS-heavy sites: use the Playwright MCP tool instead. */
export async function crawl(startUrl: string, options: CrawlOptions = {}): Promise<CrawledPage[]> {
  const doFetch = options.fetch ?? fetch;
  const max = options.maxPages ?? 10;
  const origin = new URL(startUrl).origin;
  const seen = new Set<string>([startUrl]);
  const queue = [startUrl];
  const pages: CrawledPage[] = [];
  while (queue.length && pages.length < max) {
    const url = queue.shift()!;
    const response = await doFetch(url, { headers: { "user-agent": "SuperAgentBot/0.1" }, signal: AbortSignal.timeout(15_000) }).catch(() => undefined);
    if (!response?.ok || !/html/i.test(response.headers.get("content-type") ?? "")) continue;
    const page = extractPage(url, await response.text());
    pages.push(page);
    for (const link of page.links) {
      if (seen.has(link) || (options.sameOrigin !== false && new URL(link).origin !== origin)) continue;
      seen.add(link);
      queue.push(link);
    }
  }
  return pages;
}
