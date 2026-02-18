Chrome Web Store Upload Guide
Follow these steps to package and submit your extension for review.

ℹ️ Account Type (Trader vs Non-Trader)
When setting up your developer account, you will be asked to choose between a "Trader" or "Non-Trader" status (required for EU compliance):

Select "Trader": OpinionDeck is a commercial service ($9/mo). Since you are offering a paid product, you are acting in a professional/business capacity.
Verification: You will need to provide a business address and phone number for verification, which will be displayed to EU users.
1. Build the Production Bundle
Ensure you have the latest production URLs and branding (BETA) in your code.

bash
cd chrome-extension
npm install
npm run build
2. 🚨 CRITICAL: The "ID" Step
Since we use externally_connectable for secure auth, your Web App needs to know the Production Extension ID, which you only get after creating the item in the store.

Draft: Go to the Chrome Web Store Dashboard, click + New Item, and upload your 
opiniondeck-extension.zip
.
Get ID: Once uploaded, look at the URL or the dashboard to find your Extension ID (e.g., pLm...).
Update Web App:
Open 
.github/workflows/deploy-app.yml
 in your repo.
Add VITE_EXTENSION_ID: your-new-id to the 
env
 section under "Build Web App".
Commit & Push: This triggers a new build with the correct ID.
No Extension Rebuild Needed: You don't need to rebuild the extension for this step (unless you want to hardcode the ID in the manifest, which isn't strictly required for externally_connectable as long as the domain matches).
3. Prepare the Zip File
The Chrome Web Store requires a 
.zip
 file of your extension.

If Vite created a dist folder: Zip the contents of the dist folder.
If you are running with existing root files: Zip 
manifest.json
, icons/, and all 
.js
/
.css
 files required by the manifest.
bash
# Example if zipping the current folder (excluding source/node_modules)
zip -r opiniondeck-extension.zip manifest.json icons/ *.js *.css src/
3. Chrome Developer Dashboard
Go to the Chrome Web Store Developer Dashboard.
Click + New Item.
Upload your 
opiniondeck-extension.zip
.
4. Fill Application Details
Title: OpinionDeck Extractor (BETA)
Summary: Strategic market intelligence from Reddit, G2, and more.
Description: Add a detailed explanation of how it helps users extract insights.
Category: Productivity / Search Tools.
Icons: Use the 128x128 icon from your icons/ folder.
Screenshots: Take at least one screenshot of the popup in action on a Reddit thread.
5. Privacy & Permissions
Indicate why you need activeTab (to read the current page content for extraction).
Indicate why you need storage (to sync your auth token).
Link to your new Privacy Policy: https://opiniondeck.com/privacy
6. Submit for Review
Click Submit for Review. Google usually takes 24-72 hours for initial approval.