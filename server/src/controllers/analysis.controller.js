import { analyzeSeoData } from '../services/gemini.service.js';
import { scrapeUrl } from '../services/scrapper.service.js';
import Analysis from './../models/analysis.model.js';

// Active background analyses registry to handle cancellations in-memory
const activeAnalyses = new Map();

const resolveUserId = (req) => {
    if (!req || !req.user) return null;
    return req.user.userId || req.user.id || req.user._id || null;
};

export const analyzeUrl = async (req, res) => {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "URL is required" });

        let validUrl;
        try {
            validUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
        } catch (error) {
            return res.status(400).json({ success: false, message: "Incalid URL" });
        }

        const analysis = await Analysis.create({
            userId, url: validUrl.href, status: "processing",
        })

        const abortController = new AbortController();
        const analysisIdStr = analysis._id.toString();
        activeAnalyses.set(analysisIdStr, abortController);

        res.json({ success: true, message: "Analysis started", analysisId: analysis._id });

        // Run scrapping and analysis in background
        try {
            const scrapeResult = await scrapeUrl(validUrl.href, abortController.signal);

            // Check if aborted during scraping
            if (abortController.signal.aborted) {
                console.log("Analysis aborted during or after scraping.");
                return;
            }

            if (!scrapeResult || !scrapeResult.success) {
                analysis.status = "failed";
                analysis.errorMessage = scrapeResult?.error || "Failed to scan the website. Please check the URL and try again.";
                await analysis.save();
                return;
            }

            // Step 2: Analyze with Gemini AI
            // Check abort again just before calling Gemini API
            if (abortController.signal.aborted) {
                console.log("Analysis aborted before calling Gemini API.");
                return;
            }

            const aiResult = await analyzeSeoData(scrapeResult.data, abortController.signal);
            console.log("Analysis report from gemin: ", aiResult);

            // Check abort again after calling Gemini API
            if (abortController.signal.aborted) {
                console.log("Analysis aborted after Gemini API responded.");
                return;
            }

            if (!aiResult.success) {
                analysis.status = "failed";
                const isGeminiTrafficError = aiResult.error && (
                    aiResult.error.toLowerCase().includes("quota") ||
                    aiResult.error.toLowerCase().includes("limit") ||
                    aiResult.error.toLowerCase().includes("exhausted") ||
                    aiResult.error.toLowerCase().includes("overload") ||
                    aiResult.error.toLowerCase().includes("traffic") ||
                    aiResult.error.toLowerCase().includes("busy") ||
                    aiResult.error.toLowerCase().includes("429") ||
                    aiResult.error.toLowerCase().includes("503") ||
                    aiResult.error.toLowerCase().includes("unavailable") ||
                    aiResult.error.toLowerCase().includes("temporarily")
                );

                if (isGeminiTrafficError) {
                    analysis.errorMessage = "This project uses Free tier model from Google Gemini. It's tokens are expired or Model is taking to much time due to high traffic. We can change it for high scale users";
                } else {
                    analysis.errorMessage = aiResult.error || "Gemini AI analysis failed. Please try again.";
                }
                await analysis.save();
                return;
            }

            // Step 3: Save Results
            analysis.overallScore = aiResult.data.overallScore || 0;
            analysis.categories = aiResult.data.categories || {};
            analysis.metaData = scrapeResult.data.metaData || {};
            analysis.headings = scrapeResult.data.headings || {};
            analysis.links = scrapeResult.data.links || {};
            analysis.images = scrapeResult.data.images || {};
            analysis.keywords = aiResult.data.keywords || [];
            analysis.issues = aiResult.data.issues || [];
            analysis.loadTime = scrapeResult.data.loadTime || 0;
            analysis.pageSize = scrapeResult.data.pageSize || 0;
            analysis.wordCount = scrapeResult.data.wordCount || 0;
            analysis.status = "completed";

            await analysis.save();

        } catch (bgError) {
            console.error("Background analysis error: ", bgError.message);
            try {
                if (abortController.signal.aborted) {
                    return;
                }
                analysis.status = "failed";
                analysis.errorMessage = bgError.message || "An unexpected error occurred during analysis.";
                await analysis.save();
            } catch (saveError) {
                console.log("Failed to save failed status: ", saveError.message);
            }
        } finally {
            activeAnalyses.delete(analysisIdStr);
        }
    } catch (error) {
        console.error("Analyze URL error: ", error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
}

export const getAnalysis = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const analysis = await Analysis.findOne({ _id: req.params.id, userId });

        if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' });
        res.status(200).json({ success: true, analysis });
    } catch (error) {
        console.error("Get analysis error: ", error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

// Get all analyses for user
export const getAnalyses = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const analyses = await Analysis.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-issues -keyword");
        // const total = await Analysis.countDocuments({userId});
        const total = analyses.length;

        if (!analyses) return res.status(404).json({ success: false, message: 'Analysis not found for given user' });
        res.status(200).json({ success: true, analyses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        console.error("Get  all analysis error: ", error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const deleteAnalysis = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const id = req.params.id;

        const deletedDoc = await Analysis.findByIdAndDelete(id);
        if (!deletedDoc) return res.status(404).json({ success: false, message: 'Analysis doesnt exist to delete' });
        res.status(204).json({ success: false, message: `${id} deleted` });
    } catch (error) {
        console.error("Delete analysis error: ", error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const abortAnalysis = async (req, res) => {
    try {
        const userId = resolveUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const id = req.params.id;
        const analysis = await Analysis.findOne({ _id: id, userId });

        if (!analysis) {
            return res.status(404).json({ success: false, message: 'Analysis not found' });
        }

        if (analysis.status === 'processing' || analysis.status === 'pending') {
            analysis.status = 'aborted';
            analysis.errorMessage = 'Analysis aborted by user.';
            await analysis.save();

            // Trigger in-memory cancellation
            const abortController = activeAnalyses.get(id);
            if (abortController) {
                abortController.abort();
                activeAnalyses.delete(id);
            }

            return res.status(200).json({ success: true, message: 'Analysis aborted successfully' });
        }

        return res.status(400).json({ success: false, message: `Cannot abort analysis with status: ${analysis.status}` });
    } catch (error) {
        console.error("Abort analysis error: ", error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}