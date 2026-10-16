import { User } from '../model/user.js';
import { PersonalAccessTokenController } from './access/PersonalAccessTokenController.js';
import { authController } from './access/AuthController.js';
import { roleController } from './access/RoleController.js';
import Util from '../util/Util.js';
import { sender as mailSender } from '../mail/MailSender.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import Env from '../util/Env.js';

const withoutPassword = (user) => {
    const { password_hash, ...safeUser } = user.get({ plain: true });
    return safeUser;
};

class Controller {
    
    async find(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('Usuário não encontrado.');
            err.status = 404;
            throw err;
        }
        return withoutPassword(user);
    }

    async all(page = 1, size = 10, search = '') {
        page = Math.max(1, parseInt(page, 10) || 1);
        size = Math.max(1, parseInt(size, 10) || 10);
        const where = search ? {
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ]
        } : {};
        const { rows, count: total } = await User.findAndCountAll({
            where,
            attributes: { exclude: ['password_hash'] },
            offset: (page - 1) * size,
            limit: size
        });

        return {
            data: rows,
            total,
            quantity: rows.length,
            totalPages: Math.ceil(total / size)
        };
    }

    async register(name, document, email, password) {

        if (!Util.isValidDocument(document)) {
            const err = new Error('Documento inválido.');
            err.status = 400;
            throw err;
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            const err = new Error('Usuário já existe.');
            err.status = 409;
            throw err;
        }

        const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
        const user = await User.create({
            name,
            email,
            document,
            password_hash: passwordHash,
            status: 'active'
        });

        try {
            await mailSender.sendUserWelcomeEmail(email, name);
        } catch (error) {
            console.error('Erro ao enviar email de boas-vindas:', error);
        }

        return withoutPassword(user);
    }

    async login(email, password, ip, userAgent) {
        const user = await User.findOne({ where: { email } });
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            const err = new Error('Email ou senha inválidos.');
            err.status = 401;
            throw err;
        }
        if (user.status !== 'active') {
            const err = new Error('Usuário desativado ou ainda não ativado.');
            err.status = 403;
            throw err;
        }

        await user.update({ last_login_at: new Date() });
        const userData = withoutPassword(user);
        const currentAuth = await authController.create(user.id, ip, userAgent, 'user-login');
        //const role = await roleController.find('user-role');
        
        const accessToken = jwt.sign({
            data: currentAuth,
            scope: []
        }, Env.getJwtSecret(), { expiresIn: '168h' });

        return { access_token: accessToken, user: userData };
    }

    //so pode atualizar a si mesmo
    async update(userId, name, document) {

        const [updatedCount] = await User.update({ name: name, document: document }, { where: { id: userId } });

        if (updatedCount === 0) {
            const err = new Error('Usuário não encontrado.');
            err.status = 404;
            throw err;
        }

        return this.find(userId);
    }

    async findByEmail(email) {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            const err = new Error('Usuário não encontrado.');
            err.status = 404;
            throw err;
        }
        return withoutPassword(user);
    }

    async toggleStatus(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('Usuário não encontrado.');
            err.status = 404;
            throw err;
        }
        const status = user.status === 'active' ? 'disabled' : 'active';
        await user.update({ status });
        return { message: `Usuário ${status === 'active' ? 'ativado' : 'desativado'} com sucesso.` };
    }

    async sendForgotPasswordCode(email) {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            const err = new Error('Usuário não existe.');
            err.status = 404;
            throw err;
        }

        const code = Util.generateCode(5);
        const secret = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PersonalAccessTokenController.register(
            'user_forgot_password', user.id, user.name, secret, code, null, Date.now(), expiresAt
        );

        try {
            await mailSender.sendPasswordResetEmail(user.email, user.name, code);
        } catch (error) {
            console.error('Erro ao enviar email de redefinição de senha:', error);
            const err = new Error('Falha ao enviar email de redefinição de senha.');
            err.status = 500;
            throw err;
        }
        return { message: 'O código de redefinição de senha foi enviado ao e-mail com sucesso.' };
    }

    async changePassword(oldPassword, newPassword, code, secret) {
        const personalAT = await PersonalAccessTokenController.verifyByCode(code);
        if (personalAT.error) {
            const err = new Error(personalAT.error);
            err.status = 500;
            throw err;
        }
        if (personalAT.secret !== secret) {
            const err = new Error('Falha na validação de segurança.');
            err.status = 403;
            throw err;
        }

        const user = await User.findByPk(personalAT.tokenable_id);
        if (!user) {
            const err = new Error('Usuário não existe.');
            err.status = 404;
            throw err;
        }
        if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
            const err = new Error('A senha antiga é inválida.');
            err.status = 401;
            throw err;
        }

        await user.update({ password_hash: bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10)) });
        await PersonalAccessTokenController.deleteAllRelated(user.id);
        return { message: 'Senha alterada com sucesso.' };
    }

    async sendChangeEmailCode(userId, newEmail) {
        const user = await User.findByPk(userId);
        if (!user) {
            const err = new Error('Usuário não existe.');
            err.status = 404;
            throw err;
        }
        if (await User.findOne({ where: { email: newEmail } })) {
            const err = new Error('Este email já está em uso.');
            err.status = 409;
            throw err;
        }

        const code = Util.generateCode(5);
        const secret = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PersonalAccessTokenController.register(
            'user_change_email', user.id, newEmail, secret, code, null, Date.now(), expiresAt
        );
        try {
            await mailSender.sendEmailChangeConfirmation(newEmail, user.name, code, secret);
        } catch (error) {
            console.error('Erro ao enviar email de confirmação de mudança:', error);
            const err = new Error('Falha ao enviar email de confirmação de mudança.');
            err.status = 500;
            throw err;
        }
        return { message: 'O código de confirmação foi enviado ao novo e-mail com sucesso.' };
    }

    async changeEmail(currentUserId, email, code, secret) {
        const personalAT = await PersonalAccessTokenController.verifyByCode(code);
        if (personalAT.error) {
            const err = new Error(personalAT.error);
            err.status = 500;
            throw err;
        }
        if (personalAT.secret !== secret) {
            const err = new Error('Falha na validação de segurança.');
            err.status = 403;
            throw err;
        }

        const user = await User.findByPk(personalAT.tokenable_id);
        if (!user) {
            const err = new Error('Usuário não existe.');
            err.status = 404;
            throw err;
        }
        if (String(user.id) !== String(currentUserId)) {
            const err = new Error('Identidade não confirmada.');
            err.status = 403;
            throw err;
        }
        if (await User.findOne({ where: { email } })) {
            const err = new Error('Este email já está em uso.');
            err.status = 409;
            throw err;
        }

        await user.update({ email });
        await PersonalAccessTokenController.deleteAllRelated(user.id);
        return { message: 'Email alterado com sucesso.' };
    }
}

const UserController = new Controller();
export { UserController };