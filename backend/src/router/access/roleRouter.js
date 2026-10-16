
import express from "express";
import { roleController } from "../controller/access/RoleController.js";
import { query, body, validationResult } from "express-validator";
import { checkScope } from "../../middleware/scope.js";
import { isAuth } from "../../middleware/auth.js";

const roleRouter = express.Router();

const validateData = [
	body('name').exists().withMessage('O name é obrigatório'),
	body('permissions').exists().withMessage('O permissions é obrigatório'),
	body('description').exists().withMessage('O description é obrigatório')	
];

const validateDataUpdated = [
	body('name').optional().exists().withMessage('O name é obrigatório'),
	body('permissions').optional().exists().withMessage('O permissions é obrigatório'),
	body('description').optional().exists().withMessage('O description é obrigatório')	
];

// Buscar por ID
roleRouter.get('/:id', isAuth(), checkScope(['read:role']), (req, res, next) => {
	roleController.findById(req.params.id)
		.then(result => {
			res.send(result);
		}).catch(next);
});

// Buscar todos paginado
roleRouter.get('/', [
	query('page').optional().exists().withMessage('O page precisa estar presente.'),
	query('size').optional().exists().withMessage('O size precisa estar presente.'),
	query('search').optional().exists().withMessage('O search precisa estar presente.')
], isAuth(), checkScope(['read:role']), (req, res, next) => {
	roleController.all(req.query.page, req.query.size, req.query.search)
		.then(result => {
			res.send(result);
		}).catch(next);
});

// Criar novo registro
roleRouter.post('/register', validateData, isAuth(), checkScope(['write:role']), (req, res, next) => {

	// Validação dos dados recebidos
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(500).json({ errors: errors.array() });
	}

	const { name, permissions, description } = req.body;
	roleController.create(name, permissions, description)
		.then(result => {
			res.send(result);
		}).catch(next);
});

// Atualizar registro
roleRouter.put('/update/:id', isAuth(), checkScope(['update:role']), validateDataUpdated, (req, res, next) => {

	// Validação dos dados recebidos
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(500).json({ errors: errors.array() });
	}

	const { name, permissions, description } = req.body;
	roleController.update(req.params.id, name, permissions, description)
		.then(result => {
			res.send(result);
		}).catch(next);
});

// Alternar status
roleRouter.patch('/toggle-status/:id', isAuth(), checkScope(['read:update']), (req, res, next) => {
	roleController.toggleStatus(req.params.id)
		.then(result => {
			res.send(result);
		}).catch(next);
});

export { roleRouter };
