import { fetchThread } from "../services/reddit.js";

async function main() {
  const url = process.argv[2] || "https://www.reddit.com/r/AppIdeas/comments/1rbkcz9/how_do_you_come_up_with_new_app_ideas/";
  
  console.log(`🚀 Starting local fetch test for: ${url}`);
  
  try {
    const thread = await fetchThread(url);
    console.log("✅ Fetch Successful!");
    console.log(`Title: ${thread.title}`);
    console.log(`Author: ${thread.author}`);
    console.log(`Body Length: ${thread.body.length} characters`);
    console.log("\n--- Body Snippet ---");
    console.log(thread.body.substring(0, 500) + "...");
    console.log("------------------\n");
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Fetch Failed!");
    console.error(error.message);
    process.exit(1);
  }
}

main();
