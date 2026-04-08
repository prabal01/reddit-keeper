import { Router, Request, Response } from 'express';
import { saveExtractedData, listExtractions, saveThreadToFolder } from '../firestore.js';
import { authMiddleware } from '../middleware/auth.js';
import { usageGuard } from '../middleware/usageGuard.js';
import { granularAnalysisQueue } from '../queues.js';
import { minifyComments } from '../ai.js';
import { countComments } from '../../reddit/tree-builder.js';
import type { SavedThread } from '../firestore.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/', authMiddleware, usageGuard('SAVED_THREADS'), async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const { data } = req.body;
        if (!data?.id) throw new Error('Invalid extraction data');

        await saveExtractedData(req.user.uid, data);

        // BRIDGE: If a folderId is provided, also save to the folder thread list
        if (data.folderId) {
            try {
                logger.info({ extractionId: data.id, folderId: data.folderId }, 'Attempting to link extraction to folder');
                let threadPayload;

                if (data.content) {
                    const commentLimit = req.user.config.commentLimit;
                    let arrayKey = 'flattenedComments';
                    if (Array.isArray(data.content.reviews)) {
                        arrayKey = 'reviews';
                    } else if (Array.isArray(data.content.comments)) {
                        arrayKey = 'comments';
                    }

                    let items = data.content[arrayKey] || [];
                    const originalCount = items.length;
                    let truncated = false;

                    if (commentLimit > 0 && originalCount > commentLimit) {
                        items = items.slice(0, commentLimit);
                        truncated = true;
                    }

                    const totalCount = (arrayKey === 'comments')
                        ? countComments(data.content.comments)
                        : items.length;

                    const minifiedChars = minifyComments(items).length;
                    const titleChars = data.title?.length || 0;
                    const tokenCount = Math.ceil((minifiedChars + titleChars) / 4);

                    const updatedContent = { ...data.content };
                    updatedContent[arrayKey] = items;
                    updatedContent.originalCommentCount = totalCount;
                    updatedContent.truncated = truncated;

                    threadPayload = {
                        id: data.id,
                        title: data.title,
                        post: data.content.post || { title: data.title },
                        content: updatedContent,
                        commentCount: truncated ? items.length : totalCount,
                        tokenCount,
                        source: data.source,
                        metadata: {
                            fetchedAt: data.extractedAt || new Date().toISOString(),
                            totalCommentsFetched: truncated ? items.length : totalCount,
                            originalCommentCount: totalCount,
                            truncated,
                            toolVersion: 'ext-1.1.0',
                            source: data.source
                        }
                    };
                } else {
                    const source = data.source || 'reddit';
                    const subreddit = data.post?.subreddit || (source === 'reddit' ? 'r/unknown' : source);
                    threadPayload = {
                        id: data.id,
                        title: data.title,
                        post: data.post || { title: data.title, author: data.author || 'anonymous', subreddit },
                        content: null,
                        commentCount: data.commentCount || 0,
                        tokenCount: data.tokenCount || 0,
                        source,
                        storageUrl: data.storageUrl,
                        metadata: {
                            fetchedAt: data.extractedAt || new Date().toISOString(),
                            totalCommentsFetched: data.commentCount || 0,
                            toolVersion: 'ext-1.1.0',
                            source
                        }
                    };
                }

                await saveThreadToFolder(req.user.uid, data.folderId, threadPayload);
                logger.info({ extractionId: data.id, folderId: data.folderId }, 'Bridge: extraction linked to folder');
            } catch (bridgeErr) {
                logger.error({ err: bridgeErr }, 'Bridge: failed to link extraction to folder');
            }
        }

        res.json({ success: true, id: data.id });
    } catch (err: unknown) {
        logger.error({ err }, 'POST /api/extractions failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', async (req: Request, res: Response) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    try {
        const data = await listExtractions(req.user.uid);
        res.json(data);
    } catch (err: unknown) {
        logger.error({ err }, 'GET /api/extractions failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
