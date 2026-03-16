import "dotenv/config";

const JUST_SERP_KEY = process.env.JUST_SERP_KEY;

if (!JUST_SERP_KEY) {
    console.error("❌ JUST_SERP_KEY is missing from .env");
    process.exit(1);
}

async function testJustSerpSearch(query: string) {
    console.log(`🔍 Searching JustSerp for: "${query}"`);

    const response = await fetch("https://api.justserp.com/v1/search", {
        method: "POST",
        headers: {
            "X-API-KEY": JUST_SERP_KEY || "",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            keyword: query,
            num: 10
        })
    });

    const data: any = await response.json();
    console.log("✅ JustSerp Response Received");

    const results = (data.organic_results || []).map((result: any) => {
        let numComments = 0;
        if (result.link.includes('reddit.com') && result.displayedLink) {
            const match = result.displayedLink.match(/(\d+)\+? comments/);
            if (match) {
                numComments = parseInt(match[1], 10);
            }
        }

        return {
            title: result.title,
            link: result.link,
            displayedLink: result.displayedLink,
            extractedComments: numComments
        };
    });

    console.log(JSON.stringify(results, null, 2));
}

// Test with multiple query styles
async function runTests() {
    await testJustSerpSearch("elden ring reddit");
    await testJustSerpSearch("slack frustating site:reddit.com");
}

runTests();
