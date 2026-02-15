import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { resolve } from "node:path";

import { parseRedditUrl } from "./reddit/parser.js";
import { fetchThread } from "./reddit/client.js";
import { formatAsMarkdown } from "./formatters/markdown.js";
import { formatAsJson } from "./formatters/json.js";
import { formatAsText } from "./formatters/text.js";
import { writeToFile } from "./output/file.js";
import { writeToStdout } from "./output/stdout.js";
import { applyFilters, estimateTokens } from "./utils/filters.js";
import type { CLIOptions } from "./reddit/types.js";

const FORMAT_EXTENSIONS: Record<string, string> = {
    md: ".md",
    json: ".json",
    text: ".txt",
};

export function createCli(): Command {
    const program = new Command();

    program
        .name("reddit-dl")
        .description(
            "Download complete Reddit threads (post + all comments) in AI-friendly formats"
        )
        .version("1.0.0")
        .argument("<url>", "Reddit post URL or post ID")
        .option(
            "-f, --format <format>",
            "Output format: md, json, text",
            "md"
        )
        .option("-o, --output <path>", "Output file path")
        .option("--stdout", "Print to stdout instead of file", false)
        .option("--copy", "Copy to clipboard", false)
        .option(
            "--min-score <n>",
            "Only include comments with score >= N",
            parseInt
        )
        .option("--max-depth <n>", "Limit comment nesting depth", parseInt)
        .option(
            "--sort <order>",
            "Comment sort: best, top, new, controversial, old",
            "confidence"
        )
        .option("--skip-deleted", "Skip deleted/removed comments", false)
        .option("--op-only", "Only include comments by OP", false)
        .option(
            "--top <n>",
            "Only include top N root-level comments",
            parseInt
        )
        .option("--token-count", "Show estimated token count", false)
        .action(async (url: string, opts: any) => {
            const options: CLIOptions = {
                format: opts.format,
                output: opts.output,
                stdout: opts.stdout,
                copy: opts.copy,
                minScore: opts.minScore,
                maxDepth: opts.maxDepth,
                sort: opts.sort,
                skipDeleted: opts.skipDeleted,
                opOnly: opts.opOnly,
                top: opts.top,
                tokenCount: opts.tokenCount,
            };

            // Validate format
            if (!["md", "json", "text"].includes(options.format)) {
                console.error(
                    chalk.red(
                        `Invalid format "${options.format}". Use: md, json, text`
                    )
                );
                process.exit(1);
            }

            // Parse the URL
            let urlInfo;
            try {
                urlInfo = parseRedditUrl(url);
            } catch (error: any) {
                console.error(chalk.red(error.message));
                process.exit(1);
            }

            // Set up spinner (only if not using stdout)
            const spinner = options.stdout
                ? null
                : ora({
                    text: "Starting download...",
                    color: "cyan",
                }).start();

            try {
                // Fetch the thread
                const thread = await fetchThread(
                    urlInfo,
                    options.sort,
                    (message) => {
                        if (spinner) spinner.text = message;
                    }
                );

                // Apply filters
                const filteredComments = applyFilters(
                    thread.comments,
                    options
                );
                const filteredThread = {
                    ...thread,
                    comments: filteredComments,
                };

                // Format output
                let output: string;
                switch (options.format) {
                    case "json":
                        output = formatAsJson(filteredThread);
                        break;
                    case "text":
                        output = formatAsText(filteredThread);
                        break;
                    case "md":
                    default:
                        output = formatAsMarkdown(filteredThread);
                        break;
                }

                // Output
                if (options.stdout) {
                    writeToStdout(output);
                } else if (options.copy) {
                    try {
                        const { default: clipboardy } = await import("clipboardy");
                        await clipboardy.write(output);
                        spinner?.succeed(
                            chalk.green(
                                `Copied ${thread.metadata.totalCommentsFetched} comments from r/${thread.post.subreddit} to clipboard`
                            )
                        );
                    } catch {
                        spinner?.fail(
                            chalk.red(
                                "Failed to copy to clipboard. Try installing xclip/xsel or use --stdout | pbcopy"
                            )
                        );
                        process.exit(1);
                    }
                } else {
                    // Write to file
                    const ext = FORMAT_EXTENSIONS[options.format] || ".md";
                    const fileName =
                        options.output ||
                        `${thread.post.subreddit}_${thread.post.id}${ext}`;
                    const filePath = resolve(process.cwd(), fileName);

                    await writeToFile(filePath, output);

                    const fileSize = Buffer.byteLength(output);
                    const sizeStr =
                        fileSize > 1024
                            ? `${(fileSize / 1024).toFixed(1)} KB`
                            : `${fileSize} B`;

                    spinner?.succeed(
                        chalk.green(
                            `Fetched ${thread.metadata.totalCommentsFetched} comments from r/${thread.post.subreddit}`
                        )
                    );
                    console.log(
                        chalk.dim(`  → Saved to ${chalk.white(fileName)} (${sizeStr})`)
                    );
                }

                // Token count
                if (options.tokenCount) {
                    const tokens = estimateTokens(output);
                    console.log(
                        chalk.dim(
                            `  → Estimated tokens: ~${tokens.toLocaleString()}`
                        )
                    );
                }
            } catch (error: any) {
                spinner?.fail(chalk.red(`Error: ${error.message}`));
                process.exit(1);
            }
        });

    return program;
}
