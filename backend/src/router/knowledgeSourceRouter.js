import express from 'express';
import { param, validationResult } from 'express-validator';
import { uploadKnowledge } from '../middleware/upload.js';
import Env from '../util/Env.js';
import { parsers } from '../service/knowledge/documentParser.js';
import { KnowledgeController } from '../controller/KnowledgeSourceController.js';
import { isAuth } from '../middleware/auth.js';

const KnowledgeSourceRouter = express.Router();

KnowledgeSourceRouter.get('/agent/:id/knowledge',
	[
		param('id').isInt({ min: 1 }).withMessage('Agent id must be a positive integer.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await KnowledgeController.findAllByAgent(req.params.id, req.auth.data.sub);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

KnowledgeSourceRouter.get('/knowledge/:source_id',
	[
		param('source_id').isInt({ min: 1 }).withMessage('Knowledge source id must be a positive integer.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await KnowledgeController.findById(req.params.source_id, req.auth.data.sub);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

KnowledgeSourceRouter.delete('/knowledge/:source_id',
	[
		param('source_id').isInt({ min: 1 }).withMessage('Knowledge source id must be a positive integer.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await KnowledgeController.deleteById(req.params.source_id, req.auth.data.sub);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

KnowledgeSourceRouter.get('/limits', isAuth, async (req, res, next) => {

  try {

    res.status(200).json({
      maxFiles: Env.getUploadMaxFilesLimit() || 10,
      maxFileSizeMB: Env.getUploadFileSizeLimit(),
      maxFileSizeBytes: Env.getUploadFileSizeLimit() * 1024 * 1024,
      allowedTypes: Object.keys(parsers ?? {}),
      allowedExtensions: Object.keys(parsers ?? {}).map(k => '.' + k),
    });

  } catch (err) { next(err); }

});

export { KnowledgeSourceRouter };
