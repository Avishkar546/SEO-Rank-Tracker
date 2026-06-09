import { KeywordTracking } from '../models/keywordTracking.model.js';
import { keywordTracking } from '../services/keywordTracking.service.js';

// Utility to send consistent error responses
const handleError = (res, err, message = 'Internal Server Error') => {
	console.error(err);
	return res.status(500).json({ success: false, message });
};

// Adds a new keyword to track for the authenticated user
const resolveUserId = (req) => {
	if (!req || !req.user) return null;
	return req.user.userId || req.user.id || req.user._id || null;
};

export const addKeyword = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { keyword, url } = req.body;
		if (!keyword || typeof keyword !== 'string' || !url) {
			return res.status(400).json({ success: false, message: 'Invalid keyword' });
		}

		let domain;
		try {
			let urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
			domain = urlObj.hostname.replace("www", "");
		} catch (error) {
			return res.status(400).json({ success: false, message: "Invalid URL format" });
		}

		// Prevent duplicate tracking for same keyword+engine+location for user
		const exists = await KeywordTracking.findOne({ userId, keyword: keyword.toLowerCase().trim(), domain });
		if (exists) return res.status(409).json({ success: false, message: 'Keyword already tracked' });

		const tracking = new KeywordTracking.create({
			userId,
			keyword: keyword.toLowerCase().trim(),
			url: url.startsWith("http") ? url : `https://${url}`,
			domain,
			status: "checking"
		});

		// await doc.save();
		return res.status(201).json({ success: true, message: "keyword tracking started", tracking });
		keywordTracking(tracking);
	} catch (err) {
		console.error("Add keyword error: ", error.message);
		if (err.code === 11000) return res.status(400).json({ success: false, message: "Already tracking this keyword" });
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// Get all tracked keywords for authenticated user with pagination/filtering
export const getAllKeywords = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { page = 1, limit = 25, active, tag, q } = req.query;
		const skip = (Math.max(parseInt(page, 10), 1) - 1) * Math.max(parseInt(limit, 10), 1);

		const filter = { userId };
		if (active === 'true') filter.isActive = true;
		if (active === 'false') filter.isActive = false;
		if (tag) filter.tags = tag;
		if (q) filter.keyword = { $regex: q, $options: 'i' };

		const [items, total] = await Promise.all([
			KeywordTracking.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Math.max(parseInt(limit, 10), 1)),
			KeywordTracking.countDocuments(filter),
		]);

		// const keywords = await KeywordTracking.find({userId:req.userId}).sort({createdAt:-1}).select("-rankHistory");
		// res.json({success:true, keywords});

		return res.json({ success: true, data: items, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
	} catch (err) {
		console.error("Get keywords error: ", err.message);
		return handleError(res, err);
	}
};

// Get single tracked keyword by id with full history
export const getKeywordById = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { id } = req.params;
		if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

		const doc = await KeywordTracking.findOne({ _id: id, userId });
		if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

		return res.json({ success: true, data: doc });
	} catch (err) {
		console.error("Get keyword error: ", err.message);
		return handleError(res, err);
	}
};

// Manually refresh a keyword ranking (adds a new history entry).
// Note: In production this would call an external ranking service; here we accept a rank in the body
export const refreshKeyword = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { id } = req.params;
		if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

		const doc = await KeywordTracking.findOne({ _id: id, userId });
		if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

		doc.status = "checking";
		await doc.save();
		res.json({ success: true, message: "Rank check started" });
		keywordTracking(doc);

		return res.json({ success: true, data: doc });
	} catch (err) {
		console.error("Refresh keyword error: ", err.message);
		return handleError(res, err);
	}
};

// Delete keyword tracking
export const deleteKeyword = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { id } = req.params;
		if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

		const doc = await KeywordTracking.findOneAndDelete({ _id: id, userId });
		if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

		return res.json({ success: true, message: 'Deleted', data: { id: doc._id } });
	} catch (err) {
		console.error("Delete keyword error: ", err.message);
		return handleError(res, err);
	}
};

// Toggle tracking active/inactive
export const toggleTracking = async (req, res) => {
	try {
		const userId = resolveUserId(req);
		if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

		const { id } = req.params;
		if (!id) return res.status(400).json({ success: false, message: 'Missing id' });

		const doc = await KeywordTracking.findOne({ _id: id, userId });
		if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

		doc.active = !doc.active;
		await doc.save();

		return res.json({ success: true, data: doc });
	} catch (err) {
		return handleError(res, err);
	}
};
