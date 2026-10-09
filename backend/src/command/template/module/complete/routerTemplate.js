
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { __TitleModuleName__Controller } from '../controller/__TitleModuleName__Controller.js';

const __TitleModuleName__Router = express.Router();

__TitleModuleName__Router.get('/:id', async (req, res) => {
	res.send(await __TitleModuleName__Controller.find(req.params.id));
});

__TitleModuleName__Router.get('/', [
	query('page').optional().isInt({ min: 1 }),
	query('size').optional().isInt({ min: 1 }),
	query('search').optional().isString()
], async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	res.send(await __TitleModuleName__Controller.all(
		req.query.page,
		req.query.size,
		req.query.search
	));
});

__TitleModuleName__Router.post('/register', [
	body('value1').optional(),
	body('value2').optional(),
	body('value3').optional()
], async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	res.status(201).send(await __TitleModuleName__Controller.create(
		req.body.value1,
		req.body.value2,
		req.body.value3
	));
});

__TitleModuleName__Router.put('/update/:id', [
	body('value1').optional(),
	body('value2').optional(),
	body('value3').optional()
], async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	res.send(await __TitleModuleName__Controller.update(
		req.params.id,
		req.body.value1,
		req.body.value2,
		req.body.value3
	));
});

__TitleModuleName__Router.delete('/delete/:id', async (req, res) => {
	res.send(await __TitleModuleName__Controller.delete(req.params.id));
});

__TitleModuleName__Router.patch('/:id/status', async (req, res) => {
	res.send(await __TitleModuleName__Controller.toggleStatus(req.params.id));
});

export { __TitleModuleName__Router };
