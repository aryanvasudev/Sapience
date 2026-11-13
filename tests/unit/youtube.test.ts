import { describe, expect, it } from "vitest";

import { parseIsoDuration } from "@/lib/youtube/duration";
import { parseStartTime, parseYouTubeUrl } from "@/lib/youtube/parse-url";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl — accepted formats (Section 5.1)", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://youtube-nocookie.com/embed/${ID}`,
    // No scheme.
    `youtube.com/watch?v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtu.be/${ID}`,
    `m.youtube.com/watch?v=${ID}`,
    // Extra query parameters.
    `https://www.youtube.com/watch?v=${ID}&list=PLabcdefghijklmnop&index=3`,
    `https://www.youtube.com/watch?list=PLabcdefghijklmnop&v=${ID}`,
    `https://youtu.be/${ID}?si=AbCdEfGhIjKlMnOp`,
    `https://www.youtube.com/watch?v=${ID}&feature=youtu.be`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube.com/shorts/${ID}?feature=share&si=xyz`,
    // Surrounding whitespace and upper-case host.
    `  https://WWW.YOUTUBE.COM/watch?v=${ID}  `,
  ])("accepts %s", (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ videoId: ID, startSeconds: null });
  });

  it("keeps IDs with - and _", () => {
    expect(parseYouTubeUrl("https://youtu.be/a-b_c-d_e-f")?.videoId).toBe("a-b_c-d_e-f");
  });

  it.each([
    [`https://www.youtube.com/watch?v=${ID}&t=90`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=90s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, 90],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`, 3723],
    [`https://youtu.be/${ID}?t=45`, 45],
    [`https://youtu.be/${ID}?si=abc&t=2m`, 120],
    [`https://www.youtube.com/embed/${ID}?start=30`, 30],
    [`https://www.youtube-nocookie.com/embed/${ID}?start=125&rel=0`, 125],
    [`https://www.youtube.com/watch?v=${ID}&list=PLx&t=10s&feature=share`, 10],
    [`https://www.youtube.com/watch?v=${ID}#t=1m5s`, 65],
    [`youtube.com/watch?v=${ID}&t=0`, 0],
  ])("reads the start time from %s", (url, seconds) => {
    expect(parseYouTubeUrl(url)).toEqual({ videoId: ID, startSeconds: seconds });
  });

  it("an unparseable t= keeps the video but drops the start time", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=soon`)).toEqual({ videoId: ID, startSeconds: null });
  });
});

describe("parseYouTubeUrl — rejected input", () => {
  it.each([
    "",
    "   ",
    "not a url",
    ID, // a bare ID is not a link
    // Other hosts and look-alikes.
    `https://vimeo.com/123456789`,
    `https://www.notyoutube.com/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://evil.example/youtube.com/watch?v=${ID}`,
    `https://youtu.be.evil.example/${ID}`,
    `https://www.youtube-nocookie.com/watch?v=${ID}`,
    // Bad IDs.
    `https://www.youtube.com/watch?v=dQw4w9WgXc`, // 10 chars
    `https://www.youtube.com/watch?v=dQw4w9WgXcQQ`, // 12 chars
    `https://youtu.be/dQw4w9WgXc`,
    `https://youtu.be/dQw4w9WgXcQQ`,
    `https://www.youtube.com/watch?v=dQw4w9Wg%21cQ`,
    `https://www.youtube.com/watch?v=dQw4w9W.XcQ`,
    `https://www.youtube.com/embed/`,
    `https://youtu.be/`,
    // Playlists and channels without a video.
    `https://www.youtube.com/watch?list=PLabcdefghijklmnop`,
    `https://www.youtube.com/playlist?list=PLabcdefghijklmnop`,
    `https://www.youtube.com/@somechannel`,
    `https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv`,
    `https://www.youtube.com/`,
    // Dangerous or non-web schemes.
    "javascript:alert(1)",
    `javascript://www.youtube.com/watch?v=${ID}`,
    `javascript:alert('https://youtu.be/${ID}')`,
    `data:text/html,https://youtu.be/${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `file:///youtu.be/${ID}`,
    // Absurdly long input.
    `https://www.youtube.com/watch?v=${ID}&x=${"a".repeat(2100)}`,
  ])("rejects %s", (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });
});

describe("parseStartTime", () => {
  it.each([
    ["90", 90],
    ["0", 0],
    ["90s", 90],
    ["1m30s", 90],
    ["1h2m3s", 3723],
    ["2m", 120],
    ["1h", 3600],
    ["1h5s", 3605],
    [" 1M30S ", 90],
  ])("%s → %d", (value, seconds) => {
    expect(parseStartTime(value)).toBe(seconds);
  });

  it.each(["", "abc", "-5", "1.5", "1m30", "s", "1s2m", "1:30", "90 s"])("rejects %j", (value) => {
    expect(parseStartTime(value)).toBeNull();
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["PT10M", 600],
    ["P1DT2H", 93600],
    ["PT0S", 0],
    ["P1D", 86400],
    ["PT1H", 3600],
    ["PT2M30.9S", 150],
  ])("%s → %d", (value, seconds) => {
    expect(parseIsoDuration(value)).toBe(seconds);
  });

  it.each(["PT", "P", "", "junk", "1H2M", "PT1X", "pt1h", "P1Y", "P1M", "PT-5S", "P1DT"])("rejects %j", (value) => {
    expect(parseIsoDuration(value)).toBeNull();
  });
});
