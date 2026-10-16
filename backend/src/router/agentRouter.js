import express from "express";
import { query, body, param, validationResult } from "express-validator";
import { AgentController } from '../controller/AgentController.js';
import { isAuth } from "../middleware/auth.js";

const agentRouter = express.Router();

agentRouter.post('/:id/chat',
	[
		param('id').isInt().withMessage('O ID de agente deve ser um número inteiro.'),
		body('conversation_id').optional().isInt().withMessage('O ID deve ser um número inteiro.'),
		body('message').notEmpty().withMessage('Mensagem é obrigatório.').isString().withMessage('Descrição deve ser um texto.'),
		body('channel_id').notEmpty().withMessage('ID de canal inválido.').isInt().withMessage('O ID deve ser um número inteiro.'),
		body('external_user_id').optional().isString().withMessage('ID externo deve ser um texto.'),
		body('external_user_name').optional().isString().withMessage('Nome externo deve ser um texto.'),
	],
	isAuth,
	async (req, res, next) => {
		try {
			const result = await AgentController.chat(
				req.params.id,
				req.auth.data.sub,
				req.body.conversation_id,
				req.body.message,
				req.body.channel_id,
				req.body.external_user_id,
				req.body.external_user_name
			);
			return res.send(result);
		} catch (err) { next(err); }
	}
);

agentRouter.post('/register',
	[
		body('name').notEmpty().withMessage('Nome é obrigatório.').isString().isLength({ max: 80 }).withMessage('Nome deve ter no máximo 80 caracteres.'),
		body('description').optional().isString().withMessage('Descrição deve ser um texto.'),
		body('objective').notEmpty().withMessage('Objetivo é obrigatório.').isString().withMessage('Objetivo deve ser um texto.'),
		body('agent_opt_temp').optional().isFloat().withMessage('Temperatura inválida.'),
		body('agent_opt_top_p').optional().isFloat().withMessage('Top P inválido.'),
		body('agent_opt_num_predict').optional().isInt().withMessage('Limite de palavras inválido.'),
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await AgentController.create(req.auth.data.sub, req.body.name, req.body.description, req.body.objective, req.body.agent_opt_temp, req.body.agent_opt_top_p, req.body.agent_opt_num_predict);
			res.status(201).json(result);
		} catch (err) { next(err); }
	}
);

agentRouter.get('/all',
	[
		query('page').optional().exists(),
		query('size').optional().exists(),
		query('search').optional().exists()
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const { page, size, search } = req.query;
			const result = await AgentController.findAll(page, size, search);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

agentRouter.get('/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await AgentController.find(req.params.id);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

agentRouter.put('/update/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro'),
		body('name').notEmpty().withMessage('Nome é obrigatório.').isString().isLength({ max: 80 }).withMessage('Nome deve ter no máximo 80 caracteres.'),
		body('description').optional().isString().withMessage('Descrição deve ser um texto.'),
		body('objective').notEmpty().withMessage('Objetivo é obrigatório.').isString().withMessage('Objetivo deve ser um texto.'),
		body('model_config').optional().isObject().withMessage('Configuração inválida.'),
	],
	isAuth,
	async (req, res, next) => {
		try {
			const validation = validationResult(req);
			if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

			const result = await AgentController.update(req.params.id, req.auth.data.sub, req.body.name, req.body.description, req.body.objective);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

agentRouter.patch('/toggle-status/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro'),
		body('status').isIn(['draft', 'active', 'archived']).withMessage("status deve ser 'draft', 'active' ou 'archived'.")
	],
	isAuth,
	async (req, res, next) => {
		try {
			const result = await AgentController.toggleStatus(req.params.id, req.body.status);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

agentRouter.delete('/delete/:id',
	[
		param('id').isInt().withMessage('O ID deve ser um número inteiro')
	],
	isAuth,
	async (req, res, next) => {
		try {
			const result = await AgentController.delete(req.params.id);
			res.status(200).json(result);
		} catch (err) { next(err); }
	}
);

export { agentRouter };