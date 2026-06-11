import { analyzeSeoData } from '../services/gemini.service';
import { scrapeUrl } from '../services/scrapper.service';
import Analysis from './../models/analysis.model';
import { AIPErrorInterface } from './../../node_modules/gaxios/build/esm/src/common.d';

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

        res.json({ success: true, message: "Analysis started", analysisId: analysis._id });

        // Run scrapping and analysis in background
        try {
            const scrapeResult = await scrapeUrl(validUrl.href);
            if (!scrapeResult.success) {
                analysis.status = "failed";
                await analysis.save();
                return;
            }

            // Step 2: Analyze with Gemini AI
            const AIPErrorInterfaceResult = await analyzeSeoData(scrapeResult.data);

            if (!aiResult.success) {
                analysis.status = "failed";
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
                analysis.status = "failed";
                await analysis.save();
            } catch (saveError) {

            }
            console.log("Failed to save failed status: ", saveError.message);
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