import express from "express";
import { query, validationResult } from "express-validator";
import { IntegrationController } from '../controller/IntegrationController.js';
import { isAuth } from "../middleware/auth.js";

const IntegrationRouter = express.Router();

IntegrationRouter.get('/user/all',
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findAllByUser(req.auth.data.sub);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

IntegrationRouter.get('/user',
	[
		query('provider').isString().withMessage('O provedor deve ser string.').notEmpty().withMessage('O provider é obrigatório.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findByUser(req.auth.data.sub, req.query.provider);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

IntegrationRouter.get('/user/credentials',
	[
        query('provider').isString().withMessage("O provedor deve ser string.").notEmpty().withMessage('O provider é obrigatório.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findTokenByUser(req.auth.data.sub, req.query.provider);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

IntegrationRouter.delete('/user/delete', 
	[
		query('provider').isString().withMessage("O provedor deve ser string.").notEmpty().withMessage('O provider é obrigatório.')
	],
	isAuth,
	async (req, res, next) => {

		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.deleteUserProvider(req.auth.data.sub, req.query.provider);

			res.status(200).json(result);
		} catch (err) { next(err); }

	}
)

export { IntegrationRouter }