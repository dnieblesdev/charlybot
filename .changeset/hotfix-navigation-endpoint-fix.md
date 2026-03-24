---
"@charlybot/bot": patch
---

fix(music): add defensive checks for malformed YouTube search results

- Add null checks for video.title (string type) in search results
- Wrap playdl.search() in try/catch to handle internal parse errors
- Prevents crash when play-dl returns incomplete video objects
- Fixes: undefined is not an object (evaluating navigationEndpoint.browseEndpoint.browseId)
