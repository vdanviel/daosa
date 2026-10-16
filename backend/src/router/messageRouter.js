import express from "express";
import { query, body, param, validationResult } from "express-validator";
import { MessageController } from '../controller/MessageController.js';
import { isAuth } from "../middleware/auth.js";

const MessageRouter = express.Router();

MessageRouter.post('/register',
	[
		body('conversation_id').optional().isInt().withMessage('O ID da conversa deve ser um número inteiro.'),
		body('role').optional().isIn(['user', 'assistant', 'system', 'tool']).withMessage("O papel (role) deve ser 'user', 'assistant', 'system' ou 'tool'."),
		body('content').notEmpty().withMessage('O conteúdo da mensagem é obrigatório.').isString().withMessage('O conteúdo deve ser um texto.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.create(
			req.body.conversation_id,
			req.body.role || 'user',
			req.body.content,
		);
		res.status(201).json(result);
	}
);

MessageRouter.get('/all',
	[
		query('page').optional().isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
		query('size').optional().isInt({ min: 1 }).withMessage('O tamanho deve ser um número inteiro positivo.'),
		query('search').optional().isString().withMessage('A busca deve ser um texto.'),
		query('conversation_id').optional().isInt().withMessage('O ID da conversa deve ser um número inteiro.'),
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.findAll(
			req.query.page,
			req.query.size,
			req.query.search,
			req.query.conversation_id
		);
		res.status(200).json(result);
	}
);

MessageRouter.get('/conversation/:conversationId',
	[
		param('conversationId').isInt().withMessage('O ID da conversa deve ser um número inteiro.'),
		query('page').optional().isInt({ min: 1 }).withMessage('A página deve ser um número inteiro positivo.'),
		query('size').optional().isInt({ min: 1 }).withMessage('O tamanho deve ser um número inteiro positivo.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.findByConversation(
			req.params.conversationId,
			req.query.page,
			req.query.size
		);
		res.status(200).json(result);
	}
);

MessageRouter.get('/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.find(req.params.id);
		res.status(200).json(result);
	}
);

MessageRouter.put('/update/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.'),
		body('content').optional().isString().withMessage('O conteúdo deve ser um texto.'),
		body('role').optional().isString().withMessage('O conteúdo deve ser um texto.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.update(
			req.params.id,
			req.body.content,
			req.body.role
		);
		res.status(200).json(result);
	}
);

MessageRouter.delete('/delete/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro.')
	],
	isAuth,
	async (req, res) => {
		const validation = validationResult(req);
		if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

		const result = await MessageController.delete(req.params.id);
		res.status(200).json(result);
	}
);

export { MessageRouter };
