import { Request, Response, NextFunction } from "express";

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const adminEmailsStr = process.env.ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(",").map((e: string) => e.trim().toLowerCase()).filter(e => e.length > 0);

    const userEmail = req.user.email?.toLowerCase();

    if (!userEmail || !adminEmails.includes(userEmail)) {
        console.warn(`[Admin] Unauthorized access attempt: 
          - User Email: ${userEmail}
          - User UID: ${req.user.uid}
          - Allowed Emails (count): ${adminEmails.length}
          - List: ${adminEmailsStr.substring(0, 50)}... (masked)`);
          
        res.status(403).json({ error: "Forbidden: Admin access required. Email not in authorized list." });
        return;
    }

    next();
}
