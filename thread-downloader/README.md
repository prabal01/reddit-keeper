# Reddit Thread Downloader

A standalone, simple tool to download Reddit threads and their comments in Markdown format. Perfect for copy-pasting into ChatGPT for marketing analysis, research, or content creation.

## Prerequisites

- Node.js v18 or later

## Installation

```bash
cd thread-downloader
npm install
```

## Usage

You can run the downloader using the convenience script:

```bash
./download.sh <reddit-url>
```

Or using `npx` directly:

```bash
npx tsx downloader.ts <reddit-url>
```

### Features

- **Standalone**: No API keys required for public threads.
- **Recursive**: Automatically fetches deep/nested comments.
- **ChatGPT Ready**: Outputs clean Markdown with thread metadata and hierarchical comments.
- **Copyable**: Direct terminal output designed for easy selection and copying.

## Examples

**Input:**
`https://www.reddit.com/r/marketing/comments/xyz123/how_to_use_reddit_for_research/`

**Output:**
```markdown
# How to use Reddit for research

**Author:** u/marketer | **Subreddit:** r/marketing | **Score:** 42 | **Comments:** 15
**Link:** https://www.reddit.com/r/marketing/comments/xyz123/...

## Original Post
... (post content) ...

---
## Comments

### u/expert (12 points)
You should definitely look into...
  ### u/reply (5 points)
  Thanks for the tip!
...
```
