import "dotenv/config";

const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!SERPER_API_KEY) {
    console.error("❌ SERPER_API_KEY is missing from .env");
    process.exit(1);
}

async function testSerperSearch(query: string) {
    console.log(`🔍 Searching Serper for: "${query}"`);

    const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
            "X-API-KEY": SERPER_API_KEY || "",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            q: query,
            num: 10,
            autostretch: true,
            gl: "us",
            hl: "en",
            location: "United States"
        })
    });

    const data = await response.json();
    console.log("✅ Serper Response Received");
    console.log("DEBUG: Full Response Data:", JSON.stringify(data, null, 2));

    (data.organic || []).forEach((res: any, i: number) => {
        console.log(`DEBUG: Result ${i} Snippet:`, res.snippet);
        if (res.attributes) {
            console.log(`DEBUG: Result ${i} Attributes:`, JSON.stringify(res.attributes, null, 2));
        }
    });

    const results = (data.organic || []).map((result: any) => {
        const snippet = result.snippet || "";

        // Regex to extract comment counts from Google snippets
        // Matches "50 comments", "1.2k comments", "1 comment"
        const commentMatch = snippet.match(/(\d+(?:\.\d+)?k?)\s+comments?/i);
        const upvoteMatch = snippet.match(/(\d+(?:\.\d+)?k?)\s+upvotes?/i);

        function parseCount(str: string | undefined): number {
            if (!str) return 0;
            if (str.toLowerCase().endsWith('k')) {
                return parseFloat(str.slice(0, -1)) * 1000;
            }
            return parseInt(str, 10);
        }

        return {
            title: result.title,
            link: result.link,
            snippet: snippet,
            extracted: {
                comments: parseCount(commentMatch?.[1]),
                upvotes: parseCount(upvoteMatch?.[1])
            }
        };
    });

    console.log(JSON.stringify(results, null, 2));
}

// Test with multiple query styles
async function runTests() {
    await testSerperSearch("elden ring reddit");
    await testSerperSearch("Notion frustrations reddit");
}

runTests();
