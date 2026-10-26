
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { ClientController } from '../controller/ClientController.js';

const clientController = express.Router();

clientController.get('/:id', async (req, res, next) => {
	try {
		res.send(await ClientController.find(req.params.id));
	} catch (err) { next(err); }
});

clientController.get('/', [
	query('page').optional().isInt({ min: 1 }),
	query('size').optional().isInt({ min: 1 }),
	query('search').optional().isString()
], async (req, res, next) => {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}

	try {
		res.send(await ClientController.all(
			req.query.page,
			req.query.size,
			req.query.search
		));
	} catch (err) { next(err); }

});

clientController.post('/register', [
	body('value1').optional(),
	body('value2').optional(),
	body('value3').optional()
], async (req, res, next) => {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}

	try {
		res.status(201).send(await ClientController.create(
			req.body.value1,
			req.body.value2,
			req.body.value3
		));
	} catch (err) { next(err); }

});

clientController.put('/update/:id', [
	body('value1').optional(),
	body('value2').optional(),
	body('value3').optional()
], async (req, res, next) => {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}

	try {
		res.send(await ClientController.update(
			req.params.id,
			req.body.value1,
			req.body.value2,
			req.body.value3
		));
	} catch (err) { next(err); }

});

clientController.delete('/delete/:id', async (req, res, next) => {
	try {
		res.send(await ClientController.delete(req.params.id));
	} catch (err) { next(err); }
});

clientController.patch('/:id/status', async (req, res, next) => {
	try {
		res.send(await ClientController.toggleStatus(req.params.id));
	} catch (err) { next(err); }
});

export { clientController };
