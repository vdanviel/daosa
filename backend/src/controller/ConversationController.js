import { Conversation } from '../model/conversation.js';
import { Message } from '../model/message.js';
import { Op } from 'sequelize';

class Controller {

	async create(agent_id, user_id, channel_id, external_user_id, external_user_name) {

		return await Conversation.create(
			{ 
				agent_id: agent_id,
				user_id: user_id,
				channel_id: channel_id,
				external_user_id: external_user_id || null,
				external_user_name: external_user_name || null
			}
		);

	}

	async findAll(page = 1, size = 10, search = '', user_id) {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 10);
		search = typeof search === 'string' ? search.trim() : '';

		const isNumericSearch = /^\d+$/.test(search);
		const where = { user_id };
		if (search) {
			where[Op.or] = [
				{ '$agent.name$': { [Op.like]: `%${search}%` } },
				{ '$user.name$': { [Op.like]: `%${search}%` } },
				{ '$user.document$': { [Op.like]: `%${search}%` } },
				...(isNumericSearch ? [
					{ agent_id: search },
					{ user_id: search }
				] : [])
			];
		}
		const { rows, count: total } = await Conversation.findAndCountAll({
			where,
			include: [
				{ association: 'agent', attributes: [], required: false },
				{ association: 'user', attributes: [], required: false }
			],
			distinct: true,
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
		const record = await Conversation.findByPk(id);
		if (!record) {
			const error = new Error('Conversa não encontrado.');
			error.status = 404;
			throw error;
		}
		return record;
	}

	async findMessagesByUserId(user_id) {
		const conversations = await Conversation.findAll({
			attributes: ['id'],
			where: { user_id: user_id }
		});
		const conversationIds = conversations.map(({ id }) => id);

		return await Message.findAll({
			where: {
				[Op.or]: [
					{ user_id: user_id },
					{ conversation_id: { [Op.in]: conversationIds } }
				]
			},
			order: [['created_at', 'DESC']]
		});
	}

	async findMessagesByAgentId(agent_id) {
		const conversations = await Conversation.findAll({
			attributes: ['id'],
			where: { agent_id: agent_id }
		});
		const conversationIds = conversations.map(({ id }) => id);

		return await Message.findAll({
			where: {
				[Op.or]: [
					{ agent_id: agent_id },
					{ conversation_id: { [Op.in]: conversationIds } }
				]
			},
			order: [['created_at', 'DESC']]
		});
	}

	async toggleStatus(id, status) {

		const record = await this.find(id);

		if (!['open', 'closed'].includes(status)) {
			const error = new Error("Status must be 'open' or 'closed'.");
			error.status = 400;
			throw error;
		}

		record.status = status;
		if (status === 'closed') {
			const now = new Date();
			record.closed_at = now;
			record.last_message_at = now;
		}

		await record.save();

		return record;
	}

	async delete(id) {
		const record = await Conversation.findByPk(id);

		if (!record) {
			const error = new Error('Conversa não encontrado.');
			error.status = 404;
			throw error;
		}

		// A tabela `message` não possui FK com ON DELETE CASCADE (o schema veio
		// do sequelize.sync), então as mensagens são removidas explicitamente
		// antes da conversa, para não deixar registros órfãos.
		await Message.destroy({ where: { conversation_id: id } });
		await record.destroy();

		return { message: 'Conversa deletada com sucesso.' };
	}
}

const ConversationController = new Controller();
export { ConversationController };