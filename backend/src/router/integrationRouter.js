import express from "express";
import { param, query, validationResult } from "express-validator";
import { IntegrationController } from '../controller/IntegrationController.js';
import { isAuth } from "../middleware/auth.js";

const IntegrationRouter = express.Router();

IntegrationRouter.get('/user/:id/all',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findAllByUser(req.params.id);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

IntegrationRouter.get('/user/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.'),
		query('provider').isString().withMessage('O provedor deve ser string.').notEmpty().withMessage('O provider é obrigatório.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findByUser(req.params.id, req.query.provider);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

IntegrationRouter.get('/user/credentials/:id',
	[
		param('id').notEmpty().withMessage('O ID é obrigatório.').isInt().withMessage('O ID deve ser um número inteiro.'),
        query('provider').isString().withMessage("O provedor deve ser string.").notEmpty().withMessage('O provider é obrigatório.')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await IntegrationController.findTokenByUser(req.params.id, req.query.provider);

			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

export { IntegrationRouter }