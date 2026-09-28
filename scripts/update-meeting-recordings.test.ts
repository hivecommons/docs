import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(
  repoRoot,
  "scripts",
  "update-meeting-recordings.ts"
);
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");
const workRoot = path.join(repoRoot, ".test-work", "meeting-recordings");

let caseDir: string;

function writeFeedStub(source: string): string {
  const preloadPath = path.join(caseDir, "fetch-stub.mjs");
  fs.writeFileSync(preloadPath, source);
  return preloadPath;
}

function runUpdate(preloadPath: string) {
  return spawnSync(tsxBin, [scriptPath], {
    cwd: caseDir,
    env: { ...process.env, NODE_OPTIONS: `--import ${preloadPath}` },
    encoding: "utf8",
    timeout: 60_000,
  });
}

function readData() {
  return JSON.parse(
    fs.readFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      "utf8"
    )
  );
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));
  fs.mkdirSync(path.join(caseDir, "data"));
});

afterEach(() => {
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("update-meeting-recordings", () => {
  it("merges matching YouTube feed entries with committed metadata", () => {
    fs.writeFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      JSON.stringify({
        updatedAt: "2026-01-01T00:00:00.000Z",
        source: "old-source",
        channelId: "old-channel",
        recordings: [
          {
            id: "oldvid00001",
            title: "Community Meeting #1",
            publishedAt: "2026-01-01T00:00:00Z",
            url: "https://example.test/old",
            thumbnail: "https://i.ytimg.com/vi/oldvid00001/hqdefault.jpg",
            duration: "PT30M",
          },
        ],
      })
    );
    const preload = writeFeedStub(`
      globalThis.fetch = async () => ({
        ok: true,
        text: async () => \`<feed>
          <entry>
            <yt:videoId>newvid00001</yt:videoId>
            <title>Hive Commons Community Call &amp; demo</title>
            <published>2026-02-01T00:00:00Z</published>
            <updated>2026-02-02T00:00:00Z</updated>
            <link href="https://youtu.be/newvid00001" />
            <media:thumbnail url="https://i1.ytimg.com/vi/newvid00001/hqdefault.jpg" />
            <media:description>News &amp; notes</media:description>
          </entry>
          <entry><yt:videoId>skip</yt:videoId><title>Unrelated demo</title></entry>
        </feed>\`,
      });
    `);

    const result = runUpdate(preload);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("meeting recordings: 2");
    const data = readData();
    expect(data.source).toContain("youtube.com/feeds/videos.xml");
    expect(data.channelId).toBe("UCIA3fKJFv2nLoG6vKK65xLg");
    expect(data.recordings.map((r: { id: string }) => r.id)).toEqual([
      "newvid00001",
      "oldvid00001",
    ]);
    expect(data.recordings[0]).toMatchObject({
      title: "Hive Commons Community Call & demo",
      thumbnail: "https://i.ytimg.com/vi/newvid00001/hqdefault.jpg",
      description: "News & notes",
    });
    expect(data.recordings[1].duration).toBe("PT30M");
  });

  it("keeps committed data when the feed fetch fails", () => {
    const existing = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      source:
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg",
      channelId: "UCIA3fKJFv2nLoG6vKK65xLg",
      recordings: [
        {
          id: "keep",
          title: "Community meeting fallback",
          publishedAt: "2026-01-01T00:00:00Z",
          url: "https://example.test/keep",
          thumbnail: "https://i.ytimg.com/vi/keep/hqdefault.jpg",
        },
      ],
    };
    fs.writeFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      JSON.stringify(existing)
    );
    const preload = writeFeedStub(
      `globalThis.fetch = async () => { throw new Error("network down") };`
    );

    const result = runUpdate(preload);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("meeting recordings feed unavailable");
    expect(readData()).toEqual(existing);
  });

  it("drops entries with malformed video ids and rejects non-YouTube urls", () => {
    fs.writeFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      JSON.stringify({
        updatedAt: "2026-01-01T00:00:00.000Z",
        source:
          "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg",
        channelId: "UCIA3fKJFv2nLoG6vKK65xLg",
        recordings: [],
      })
    );
    const preload = writeFeedStub(`
      globalThis.fetch = async () => ({
        ok: true,
        text: async () => \`<feed>
          <entry>
            <yt:videoId>../evilpath</yt:videoId>
            <title>Community meeting bad id</title>
            <published>2026-02-01T00:00:00Z</published>
          </entry>
          <entry>
            <yt:videoId>goodvid0001</yt:videoId>
            <title>Community meeting bad urls</title>
            <published>2026-02-01T00:00:00Z</published>
            <link href="javascript:alert(1)" />
            <media:thumbnail url="https://evil.example/vi/goodvid0001/hqdefault.jpg" />
          </entry>
        </feed>\`,
      });
    `);

    const result = runUpdate(preload);
    expect(result.status).toBe(0);
    const data = readData();
    expect(data.recordings).toHaveLength(1);
    expect(data.recordings[0]).toMatchObject({
      id: "goodvid0001",
      url: "https://www.youtube.com/watch?v=goodvid0001",
      thumbnail: "https://i.ytimg.com/vi/goodvid0001/hqdefault.jpg",
    });
  });

  it("does not double-decode entities in titles and descriptions", () => {
    fs.writeFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      JSON.stringify({
        updatedAt: "2026-01-01T00:00:00.000Z",
        source:
          "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg",
        channelId: "UCIA3fKJFv2nLoG6vKK65xLg",
        recordings: [],
      })
    );
    const preload = writeFeedStub(`
      globalThis.fetch = async () => ({
        ok: true,
        text: async () => \`<feed>
          <entry>
            <yt:videoId>encvideo001</yt:videoId>
            <title>Community meeting &amp;lt;demo&amp;gt;</title>
            <published>2026-02-01T00:00:00Z</published>
            <media:description>a &amp;amp; b</media:description>
          </entry>
        </feed>\`,
      });
    `);

    const result = runUpdate(preload);
    expect(result.status).toBe(0);
    const data = readData();
    // Double-encoded input must decode exactly one level, never to raw markup.
    expect(data.recordings[0].title).toBe("Community meeting &lt;demo&gt;");
    expect(data.recordings[0].description).toBe("a &amp; b");
  });
});
