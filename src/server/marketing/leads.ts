import express from "express";
import { getDb } from "../firestore.js";
import { adminMiddleware } from "../middleware/admin.js";

const router = express.Router();

/**
 * GET /api/admin/marketing/leads
 * Fetches the latest research-sourced leads for the Admin Portal.
 * Restricted to super-admins.
 */
router.get("/leads", adminMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection("marketing_leads_v1")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
      
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(leads);
  } catch (err: any) {
    console.error("[MARKETING_API] Failed to fetch leads:", err);
    res.status(500).json({ error: "Failed to fetch marketing leads." });
  }
});

/**
 * POST /api/admin/marketing/leads/:id/status
 * Updates the status of a lead (e.g., 'contacted').
 */
router.post("/leads/:id/status", adminMiddleware, async (req, res) => {
  const id = req.params.id as string;
  const status = req.body.status as string;
  
  if (!(['new', 'contacted', 'ignore'] as string[]).includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  
  try {
    const db = getDb();
    await db.collection("marketing_leads_v1").doc(id).update({
      status,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("[MARKETING_API] Failed to update lead status:", err);
    res.status(500).json({ error: "Failed to update lead status." });
  }
});

export default router;
