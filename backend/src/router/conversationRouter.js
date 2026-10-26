
import express from "express";
import { query, body, param, validationResult } from "express-validator";
import { ConversationController } from '../controller/ConversationController.js';
import { isAuth } from "../middleware/auth.js";

const ConversationRouter = express.Router();

ConversationRouter.post('/register',
	[
		body('agent_id').exists().withMessage('Agente inválido.').isInt().withMessage('O ID do agente deve ser um número inteiro.'),
		body('channel_id').exists().withMessage('Canal inválido.').isInt().withMessage('O ID do canal deve ser um número inteiro.'),
		body('external_user_id').optional().isString().isLength({ max: 255 }).withMessage('O ID do usuário externo deve ter no máximo 255 caracteres.'),
		body('external_user_name').optional().isString().isLength({ max: 255 }).withMessage('O nome do usuário externo deve ter no máximo 255 caracteres.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await ConversationController.create(
			req.body.agent_id,
			req.auth.data.sub,
			req.body.channel_id,
			req.body.external_user_id || null,
			req.body.external_user_name || null
		);
		res.status(201).json(result);
	}
);

ConversationRouter.get('/all',
	[
		query('page').optional().isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
		query('size').optional().isInt({ min: 1 }).withMessage('O tamanho deve ser um número inteiro positivo.'),
		query('search').optional().isString().withMessage('A busca deve ser um texto')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await ConversationController.findAll(req.query.page, req.query.size, req.query.search, req.auth.data.sub);
		res.status(200).json(result);
	}
);

ConversationRouter.get('/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await ConversationController.find(req.params.id);
		res.status(200).json(result);
	}
);

ConversationRouter.patch('/toggle-status/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.'),
		body('status').isIn(['open', 'closed']).withMessage("status deve ser 'open' ou 'closed'.")
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await ConversationController.toggleStatus(req.params.id, req.body.status);
		res.status(200).json(result);
	}
);

ConversationRouter.delete('/delete/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await ConversationController.delete(req.params.id);
		res.status(200).json(result);
	}
);

export { ConversationRouter };
