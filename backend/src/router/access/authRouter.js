import express from "express";
import { authController } from "../controller/access/AuthController.js";
import { query, body, validationResult } from "express-validator";
import { checkScope } from "../../middleware/scope.js";
import { isAuth } from "../../middleware/auth.js";

const authRouter = express.Router();

const validateData = [
	body('sub').exists().withMessage('O sub é obrigatório'),
	body('ip').exists().withMessage('O ip é obrigatório'),
	body('agent').exists().withMessage('O agent é obrigatório')
];

const validateDataUpdated = [
	body('sub').optional().exists().withMessage('O sub é obrigatório'),
	body('ip').optional().exists().withMessage('O ip é obrigatório'),
	body('agent').optional().exists().withMessage('O agent é obrigatório')
];

// Buscar por ID
authRouter.get('/:id', isAuth(), checkScope(['read:auth']), (req, res) => {
	authController.find(req.params.id)
		.then(result => {
			res.send(result);
		});
});

// Buscar todos paginado
authRouter.get('/', [
	query('page').optional().exists().withMessage('O page precisa estar presente.'),
	query('size').optional().exists().withMessage('O size precisa estar presente.'),
	query('search').optional().exists().withMessage('O search precisa estar presente.')
], isAuth(), checkScope(['read:auth']), (req, res) => {
	authController.all(req.query.page, req.query.size, req.query.search)
		.then(result => {
			res.send(result);
		});
});

// Criar novo registro
authRouter.post('/register', validateData, isAuth(), checkScope(['write:auth']), (req, res) => {

	// Validação dos dados recebidos
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(500).json({ errors: errors.array() });
	}

	const { sub, ip, agent } = req.body;
	authController.create(sub, ip, agent)
		.then(result => {
			res.send(result);
		});
});

// Atualizar registro
authRouter.put('/update/:id', validateDataUpdated, isAuth(), checkScope(['update:auth']),(req, res) => {

	// Validação dos dados recebidos
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(500).json({ errors: errors.array() });
	}

	const { sub, ip, agent } = req.body;
	authController.update(req.params.id, sub, ip, agent)
		.then(result => {
			res.send(result);
		});
});

// Deletar registro
authRouter.delete('/delete/:id', isAuth(), checkScope(['delete:auth']), (req, res) => {
	authController.delete(req.params.id)
		.then(result => {
			res.send(result);
		});
});

export { authRouter };
