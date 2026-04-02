import { Request, Response, NextFunction } from "express";

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const adminEmailsStr = process.env.ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(",").map((e: string) => e.trim().toLowerCase());

    const userEmail = req.user.email?.toLowerCase();

    if (!userEmail || !adminEmails.includes(userEmail)) {
        console.warn(`[Admin] Unauthorized access attempt by ${userEmail} (${req.user.uid})`);
        res.status(403).json({ error: "Forbidden: Admin access required" });
        return;
    }

    next();
}
