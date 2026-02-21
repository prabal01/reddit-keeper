import { initFirebase, getDb, getAdminStorage } from "../src/server/firestore.js";
import { minifyComments } from "../src/server/ai.js";
import dotenv from "dotenv";

dotenv.config();

async function dump() {
    initFirebase();
    const db = getDb();
    const storage = getAdminStorage();
    if (!db || !storage) {
        console.error("Firebase/Storage not initialized");
        return;
    }

    // Target Folder IDs (Found 'Vimeo' earlier)
    const folderIds = ["ThePrqeXS8kXmuG56nRk"];
    console.log(`📦 Exporting ALL threads from folders: ${folderIds.join(", ")}...`);

    let masterPrompt = "I am providing multiple Reddit threads below for deep competitive analysis.\n\n";

    for (const folderId of folderIds) {
        const threadsSnapshot = await db.collection("saved_threads")
            .where("folderId", "==", folderId)
            .get();

        if (threadsSnapshot.empty) {
            console.log(`⚠️ No threads found in folder: ${folderId}`);
            continue;
        }

        console.log(`🧵 Found ${threadsSnapshot.size} threads in folder ${folderId}.`);

        for (const doc of threadsSnapshot.docs) {
            const thread = doc.data();
            let fullData = thread.data;

            if (!fullData && thread.storageUrl) {
                try {
                    let path = "";
                    if (thread.storageUrl.startsWith("gs://")) {
                        path = thread.storageUrl.replace(/gs:\/\/[^\/]+\//, "");
                    } else if (thread.storageUrl.includes("/o/")) {
                        const parts = thread.storageUrl.split("/o/")[1].split("?")[0];
                        path = decodeURIComponent(parts);
                    }

                    if (path) {
                        const [content] = await storage.bucket().file(path).download();
                        fullData = JSON.parse(content.toString());
                    }
                } catch (err: any) {
                    console.error(`   ❌ Failed to download ${thread.title}: ${err.message}`);
                    continue;
                }
            }

            if (fullData) {
                masterPrompt += `\n--- THREAD START ---\n`;
                masterPrompt += `Title: ${thread.title}\n`;
                masterPrompt += `Subreddit: r/${thread.subreddit || "unknown"}\n`;
                const comments = fullData.comments || fullData.data?.comments || [];
                masterPrompt += minifyComments(comments);
                masterPrompt += `\n--- THREAD END ---\n`;
            }
        }
    }

    console.log("\n================ MASTER PROMPT START ================\n");
    console.log(masterPrompt);
    console.log("\n================ MASTER PROMPT END ================\n");
    console.log("\n✨ Master prompt generated. Copy the section above into Vertex AI Studio.");
}

dump().catch(console.error);
