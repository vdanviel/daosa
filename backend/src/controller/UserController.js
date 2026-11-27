import { User } from '../model/user.js';
import { Agent } from '../model/agent.js';
import { Conversation } from '../model/conversation.js';
import { Message } from '../model/message.js';
import { PersonalAccessTokenController } from './access/PersonalAccessTokenController.js';
import { authController } from './access/AuthController.js';
import { roleController } from './access/RoleController.js';
import Util from '../util/Util.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op, fn, col } from 'sequelize';
import Env from '../util/Env.js';
import { emailQueue } from '../jobs/queue.js';
import { ApiError } from '../contracts/Error.js';

const withoutPassword = (user) => {
    const { password, ...safeUser } = user.get({ plain: true });
    return safeUser;
};

class Controller {
    
    async find(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw ApiError.notFound('Usuário não encontrado.');
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
            attributes: { exclude: ['password'] },
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

    /**
     * Agregados da tela de visão geral em UMA chamada.
     *
     * Antes o frontend fazia 2 + N requisições (agentes, conversas e uma chamada
     * por conversa só para contar mensagens); aqui tudo sai de 3 queries fixas.
     */
    async dashboard(user_id) {
        const [agents, conversations] = await Promise.all([
            Agent.findAll({
                where: { user_id },
                attributes: ['id', 'name', 'objective', 'status'],
                order: [['created_at', 'DESC']]
            }),
            Conversation.findAll({
                where: { user_id },
                attributes: ['id', 'agent_id', 'status']
            })
        ]);

        // Total de mensagens agrupado por conversa — uma query só, sem N+1.
        const conversationIds = conversations.map((c) => c.id);
        const messageRows = conversationIds.length
            ? await Message.findAll({
                attributes: ['conversation_id', [fn('COUNT', col('id')), 'total']],
                where: { conversation_id: { [Op.in]: conversationIds } },
                group: ['conversation_id'],
                raw: true
            })
            : [];

        const messagesByConversation = new Map(
            messageRows.map((r) => [Number(r.conversation_id), Number(r.total)])
        );

        // Acumula conversas e mensagens por agente.
        const perAgent = new Map();
        for (const conversation of conversations) {
            const key = Number(conversation.agent_id);
            const entry = perAgent.get(key) ?? { conversations: 0, open_conversations: 0, messages: 0 };
            entry.conversations += 1;
            if (conversation.status === 'open') entry.open_conversations += 1;
            entry.messages += messagesByConversation.get(Number(conversation.id)) ?? 0;
            perAgent.set(key, entry);
        }

        const byAgent = agents.map((agent) => {
            const stats = perAgent.get(Number(agent.id)) ?? { conversations: 0, open_conversations: 0, messages: 0 };
            return {
                id: agent.id,
                name: agent.name,
                objective: agent.objective,
                status: agent.status,
                ...stats
            };
        });

        const countBy = (list, status) => list.filter((item) => item.status === status).length;
        const messagesTotal = [...messagesByConversation.values()].reduce((sum, n) => sum + n, 0);

        return {
            agents: {
                total: agents.length,
                active: countBy(agents, 'active'),
                draft: countBy(agents, 'draft'),
                archived: countBy(agents, 'archived')
            },
            conversations: {
                total: conversations.length,
                open: countBy(conversations, 'open'),
                closed: countBy(conversations, 'closed')
            },
            messages: { total: messagesTotal },
            by_agent: byAgent
        };
    }

    async register(name, document, email, password) {

        if (!Util.isValidDocument(document)) {
            throw ApiError.validation('Documento inválido.');
        }

        const existingUser = await User.findOne({ where: { [Op.or]: [{ email: email }, { document: document }] } });
        if (existingUser) {
            throw ApiError.validation('Usuário já existe.', 409);
        }

        const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
        const user = await User.create({
            name,
            email,
            document,
            password: passwordHash,
            status: 'active'
        });

        await emailQueue.add('send-welcome-email', { name, email });

        return withoutPassword(user);
    }

    async login(email, password, ip, userAgent) {
        const user = await User.findOne({ where: { email } });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            throw ApiError.unauthorized('Email ou senha inválidos.');
        }

        if (user.status !== 'active') {
            throw ApiError.forbidden('Usuário desativado ou ainda não ativado.');
        }

        await user.update({ last_login_at: new Date() });
        const currentAuth = await authController.create(user.id, ip, userAgent, 'user-login');
        //const role = await roleController.find('user-role');
        
        const accessToken = jwt.sign({
            data: currentAuth,
            scope: []
        }, Env.getJwtSecret(), { expiresIn: '168h' });

        return { access_token: accessToken };
    }

    //so pode atualizar a si mesmo
    async update(userId, name, document) {

        const [updatedCount] = await User.update({ name: name, document: document }, { where: { id: userId } });

        if (updatedCount === 0) {
            throw ApiError.notFound('Usuário não encontrado.');
        }

        return this.find(userId);
    }

    async findByEmail(email) {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw ApiError.notFound('Usuário não encontrado.');
        }
        return withoutPassword(user);
    }

    async toggleStatus(userId) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw ApiError.notFound('Usuário não encontrado.');
        }
        const status = user.status === 'active' ? 'disabled' : 'active';
        await user.update({ status });
        return { message: `Usuário ${status === 'active' ? 'ativado' : 'desativado'} com sucesso.` };
    }

    async sendForgotPasswordCode(email) {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw ApiError.notFound('Usuário não existe.');
        }

        const code = Util.generateCode(5);
        const secret = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PersonalAccessTokenController.register(
            'user_forgot_password', user.id, user.name, secret, code, null, Date.now(), expiresAt
        );

        try {
            await emailQueue.add('send-password-reset-email', {
                email: user.email,
                name: user.name,
                code
            });
        } catch (error) {
            console.error('Erro ao enviar email de redefinição de senha:', error);
            throw ApiError.internal('Falha ao enviar email de redefinição de senha.');
        }
        return { message: 'O código de redefinição de senha foi enviado ao e-mail com sucesso.' };
    }

    async changePassword(oldPassword, newPassword, code, secret) {
        const personalAT = await PersonalAccessTokenController.verifyByCode(code);
        if (personalAT.error) {
            throw ApiError.validation(personalAT.error, 500);
        }
        if (personalAT.secret !== secret) {
            throw ApiError.forbidden('Falha na validação de segurança.');
        }

        const user = await User.findByPk(personalAT.tokenable_id);
        if (!user) {
            throw ApiError.notFound('Usuário não existe.');
        }
        if (!bcrypt.compareSync(oldPassword, user.password)) {
            throw ApiError.unauthorized('A senha antiga é inválida.');
        }

        await user.update({ password: bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10)) });
        await PersonalAccessTokenController.deleteAllRelated(user.id);
        return { message: 'Senha alterada com sucesso.' };
    }

    async sendChangeEmailCode(userId, newEmail) {
        const user = await User.findByPk(userId);
        if (!user) {
            throw ApiError.notFound('Usuário não existe.');
        }
        if (await User.findOne({ where: { email: newEmail } })) {
            throw ApiError.validation('Este email já está em uso.', 409);
        }

        const code = Util.generateCode(5);
        const secret = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await PersonalAccessTokenController.register(
            'user_change_email', user.id, newEmail, secret, code, null, Date.now(), expiresAt
        );
        try {
            await emailQueue.add('send-email-change-confirmation', {
                email: newEmail,
                name: user.name,
                code,
                secret
            });
        } catch (error) {
            console.error('Erro ao enviar email de confirmação de mudança:', error);
            throw ApiError.internal('Falha ao enviar email de confirmação de mudança.');
        }
        return { message: 'O código de confirmação foi enviado ao novo e-mail com sucesso.' };
    }

    async changeEmail(currentUserId, email, code, secret) {
        const personalAT = await PersonalAccessTokenController.verifyByCode(code);
        if (personalAT.error) {
            throw ApiError.validation(personalAT.error, 500);
        }
        if (personalAT.secret !== secret) {
            throw ApiError.forbidden('Falha na validação de segurança.');
        }

        const user = await User.findByPk(personalAT.tokenable_id);
        if (!user) {
            throw ApiError.notFound('Usuário não existe.');
        }
        if (String(user.id) !== String(currentUserId)) {
            throw ApiError.forbidden('Identidade não confirmada.');
        }
        if (await User.findOne({ where: { email } })) {
            throw ApiError.validation('Este email já está em uso.', 409);
        }

        await user.update({ email });
        await PersonalAccessTokenController.deleteAllRelated(user.id);
        return { message: 'Email alterado com sucesso.' };
    }
}

const UserController = new Controller();
export { UserController };