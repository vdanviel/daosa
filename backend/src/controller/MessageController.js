import { Message } from '../model/message.js';
import { Conversation } from '../model/conversation.js';
import { Op } from 'sequelize';

class Controller {

	async create(conversation_id, role = 'user', content) {

		if (!content) {
			const error = new Error('Conteúdo da mensagem é obrigatório.');
			error.status = 400;
			throw error;
		}

		const validRoles = ['user', 'assistant', 'system', 'tool'];
		if (role && !validRoles.includes(role)) {
			const error = new Error("Role inválido. Deve ser 'user', 'assistant', 'system' ou 'tool'.");
			error.status = 400;
			throw error;
		}

		if (conversation_id) {
			const conversation = await Conversation.findByPk(conversation_id);
			if (!conversation) {
				const error = new Error('Conversa não encontrada.');
				error.status = 404;
				throw error;
			}
			await conversation.update({ last_message_at: new Date() });
		}

		return await Message.create({
			conversation_id: conversation_id || null,
			role: role || 'user',
			content: content || null
		});
	}

	async findAll(page = 1, size = 10, search = '', conversation_id = null, agent_id = null, user_id = null) {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 10);
		search = typeof search === 'string' ? search.trim() : '';

		const where = {};

		if (search) {
			where[Op.or] = [
				{ content: { [Op.like]: `%${search}%` } },
				{ role: { [Op.like]: `%${search}%` } }
			];
		}

		if (conversation_id) {
			where.conversation_id = conversation_id;
		}

		const { rows, count: total } = await Message.findAndCountAll({
			where,
			offset: (page - 1) * size,
			limit: size,
			order: [['created_at', 'DESC']]
		});

		return {
			data: rows,
			total,
			quantity: rows.length,
			totalPages: Math.ceil(total / size)
		};
	}

	async find(id) {
		const record = await Message.findByPk(id);
		if (!record) {
			const error = new Error('Mensagem não encontrada.');
			error.status = 404;
			throw error;
		}
		return record;
	}

	async findByConversation(conversation_id, page = 1, size = 50) {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 50);

		const { rows, count: total } = await Message.findAndCountAll({
			where: { conversation_id },
			offset: (page - 1) * size,
			limit: size,
			order: [['created_at', 'ASC']]
		});

		return {
			data: rows,
			total,
			quantity: rows.length,
			totalPages: Math.ceil(total / size)
		};
	}

	async update(id, content) {
		const record = await Message.findOne(id);

		record.content = content;
		record.role = 'user';

		await record.save();

		return record;
	}

	async delete(id) {
		const record = await Message.findOne(id);

		await record.destroy();

		return { message: 'Mensagem deletada com sucesso.' };
	}

	async deleteByConversation(conversation_id) {
		const count = await Message.destroy({
			where: { conversation_id }
		});

		return { message: `${count} mensagem(ns) deletada(s) com sucesso.` };
	}

}

const MessageController = new Controller();
export { MessageController };