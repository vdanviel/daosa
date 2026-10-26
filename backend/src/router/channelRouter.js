import express from "express";
import { param, validationResult } from "express-validator";
import { ChannelController } from '../controller/ChannelController.js';
import { isAuth } from "../middleware/auth.js";

const ChannelRouter = express.Router();

ChannelRouter.get('/all',
	isAuth,
	async (req, res, next) => {
		try {
			const result = await ChannelController.findAll();
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

ChannelRouter.get('/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await ChannelController.find(req.params.id);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

export { ChannelRouter };
