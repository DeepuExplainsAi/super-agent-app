import { CheerioCrawler, Configuration } from "@crawlee/cheerio";
import { MemoryStorage } from "@crawlee/memory-storage";
import type { CrawledPage } from "./crawl.ts";

/** Crawlee crawl for static pages: queueing, retries and per-host politeness. Memory storage only, nothing is written to disk. */
export async function crawlWithCrawlee(startUrl: string, options: { maxPages?: number; sameOrigin?: boolean } = {}): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = [];
  const config = new Configuration({ persistStorage: false, storageClient: new MemoryStorage({ persistStorage: false }) });
  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: options.maxPages ?? 10,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: 20,
    async requestHandler({ request, $, enqueueLinks }) {
      $("script,style,head").remove();
      const title = $("title").first().text().trim();
      const links = new Set<string>();
      await enqueueLinks({ strategy: options.sameOrigin === false ? "all" : "same-origin", transformRequestFunction: (r) => (links.add(r.url), r) });
      pages.push({ url: request.loadedUrl ?? request.url, title, text: $.root().text().replace(/\s+/g, " ").trim(), links: [...links] });
    },
  }, config);
  await crawler.run([startUrl]);
  return pages;
}
