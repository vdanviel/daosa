import express from 'express';
import { isAuth } from '../middleware/auth.js';
import { body, validationResult, param, query } from 'express-validator';
import { UserController } from '../controller/UserController.js';

const userRouter = express.Router();

userRouter.get('/me', isAuth, (req, res, next) => {
    UserController.find(req.auth.data.sub).then(user => res.status(200).send(user)).catch(next);
});

userRouter.get('/all', [
    query('page').optional().exists(),
    query('size').optional().exists(),
    query('search').optional().exists()
], isAuth, (req, res, next) => {
    UserController.all(req.query.page, req.query.size, req.query.search).then(result => res.status(200).send(result)).catch(next);
});

// dados estatisticos
userRouter.get('/dashboard', isAuth, (req, res, next) => {
    UserController.dashboard(req.auth.data.sub).then(result => res.status(200).send(result)).catch(next);
});

userRouter.post('/register', [
    body('name').exists().notEmpty().withMessage('Preencha o nome.'),
    body('email').exists().isEmail().withMessage('Email inválido.'),
    body('document').exists().withMessage('Documento inválido.'),
    body('password').exists().notEmpty().withMessage('Preencha a senha.')
], (req, res, next) => {
    
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

    UserController.register(
        req.body.name,
        req.body.document,
        req.body.email,
        req.body.password
    ).then(user => res.status(201).send(user)).catch(next);
});

userRouter.post('/login', [
    body('email').exists().isEmail().withMessage('Email inválido.'),
    body('password').exists().notEmpty().withMessage('Preencha a senha.')
], (req, res, next) => {
    
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });

    UserController.login(req.body.email, req.body.password, req.ip, req.get('user-agent'))
        .then(result => res.status(200).send(result)).catch(next);
});

userRouter.put('/update', [
    body('name').exists().notEmpty().withMessage('Preencha o nome.')
], isAuth, (req, res, next) => {
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.update(req.auth.data.sub, req.body.name, req.body.document).then(user => res.send(user)).catch(next);
});

userRouter.post('/change-email/mail', [
    body('new_email').exists().isEmail().withMessage('Email inválido.')
], isAuth, (req, res, next) => {
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.sendChangeEmailCode(req.auth.data.sub, req.body.new_email).then(result => res.send(result)).catch(next);
});

userRouter.patch('/change-email', [
    body('code').exists().notEmpty(),
    body('secret').exists().notEmpty(),
    body('new_email').exists().isEmail().withMessage('Email inválido.')
], isAuth, (req, res, next) => {
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.changeEmail(req.auth.data.sub, req.body.new_email, req.body.code, req.body.secret)
        .then(result => res.send(result)).catch(next);
});

userRouter.post('/forgot-password/mail', [
    body('email').exists().isEmail().withMessage('Email inválido.')
], (req, res, next) => {
    
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.sendForgotPasswordCode(req.body.email).then(result => res.send(result)).catch(next);
});

userRouter.patch('/update-password', [
    body('code').exists().notEmpty(),
    body('old_password').exists().notEmpty(),
    body('new_password').exists().notEmpty(),
    body('secret').exists().notEmpty()
], (req, res, next) => {
    
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.changePassword(req.body.old_password, req.body.new_password, req.body.code, req.body.secret)
        .then(result => res.send(result)).catch(next);
});

userRouter.get('/:id', [
    param('id').exists().notEmpty().withMessage('O id do usuário é obrigatório.')
], (req, res, next) => {
    
    const validation = validationResult(req);
    if (!validation.isEmpty()) return res.status(400).send({ missing: validation.array() });
    UserController.find(req.params.id).then(user => res.send(user)).catch(next);
});

userRouter.patch('/toggle-status', isAuth, (req, res, next) => {
    UserController.toggleStatus(req.auth.data.sub).then(result => res.send(result)).catch(next);
});

export { userRouter };