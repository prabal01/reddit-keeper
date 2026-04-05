# Walkthrough: Setting up the Local Reddit Fetcher Tunnel

This guide explains how to run the `reddit-fetcher` service on your local Mac and connect it to your Cloud-hosted OpinionDeck application. This allows the app to use your **home router's IP** for Reddit fetching, bypassing Data Center blocks.

## 📦 Step 1: Local Setup

1. **Navigate to the fetcher directory**:
   ```bash
   cd services/reddit-fetcher
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure the environment**:
   Create a `.env` file in `services/reddit-fetcher/.env`:
   ```env
   PORT=3002
   INTERNAL_FETCH_SECRET=your_long_random_secret_here
   REDDIT_USER_AGENT="macos:opiniondeck-research:v1.0.0 (by /u/your_username)"
   ```

4. **Start the service**:
   ```bash
   npm run dev
   ```

---

## 🚇 Step 2: Setting up the Tunnel (Cloudflare)

To make your local Mac accessible to your Cloud Run app, we'll use a **Cloudflare Tunnel** (free and permanent).

1. **Install Cloudflare's CLI**:
   ```bash
   brew install cloudflared
   ```

2. **Authorize the tunnel**:
   ```bash
   cloudflared tunnel login
   ```

3. **Create the tunnel**:
   ```bash
   cloudflared tunnel create reddit-bridge
   ```

4. **Run the tunnel**:
   ```bash
   cloudflared tunnel serve --url http://localhost:3002
   ```

> [!IMPORTANT]
> Copy the resulting URL (e.g., `https://random-words.trycloudflare.com`). This is your new **Egress Bridge URL**.

---

## 🚀 Step 3: Link to OpinionDeck (Cloud)

1. **Update your Cloud Run Environment Variables**:
   Set the following variables in your Google Cloud Console for the main `reddit-dl` app:
   - `REDDIT_SERVICE_URL`: `https://your-tunnel-url.trycloudflare.com`
   - `INTERNAL_FETCH_SECRET`: `your_long_random_secret_here` (Must match the one in Step 1.3)

2. **Deploy/Restart**:
   Once the variables are set, OpinionDeck will automatically route all Reddit traffic through your home Mac.

---

## 🛡️ Verification

1. **Check the logs**:
   When you perform a search in OpinionDeck, you should see logs appearing in your local `npm run dev` terminal on your Mac.
   
2. **IP Verification**:
   The `/health` endpoint of your main app should now report your **Home IP address** as the fetcher's egress IP.

---

## 🕒 Best Practices

> [!WARNING]
> Your Mac must stay **awake and connected** to the internet for background syncs to work. If your Mac sleeps, the tunnel will break, and the cloud app will receive "502 Bad Gateway" errors.

> [!TIP]
> For a more permanent setup, you can create a dedicated Cloudflare Tunnel in your dashboard and run the agent as a background service on your Mac.
