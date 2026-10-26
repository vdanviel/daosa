import { Agent } from '../model/agent.js';
import { Message } from "../model/message.js";
import { Conversation } from "../model/conversation.js";
import { llmModelClient, llmInfo, preprocessCorpus } from "../connection/llm.js";

import { Op } from 'sequelize';

class Controller {

	async chat(agent_id, user_id, conversation_id, user_text, channel_id, external_user_id, external_user_name) {

		const agent = await Agent.findOne({
			where: { id: agent_id }
		});

		if (!agent) throw Object.assign(new Error('Agente não encontrado.'), { status: 404 });

		// Agente arquivado não atende: mesmo formato de erro dos demais, mas 503.
		if (agent.status === 'archived') throw Object.assign(new Error('Serviço atualmente desativado.'), { status: 503 });

		const conversation = conversation_id
		? await Conversation.findOne({ where: { id: conversation_id, agent_id: agent.id } })
		: await Conversation.create(
			{ 
				agent_id: agent.id,
				user_id: user_id,
				channel_id: channel_id || 1,
				external_user_id: external_user_id || null,
				external_user_name: external_user_name || null
			}
		);

		if (!conversation) throw Object.assign(new Error('Conversa não encontrada.'), { status: 404 });

		// Conversa fechada não recebe mais mensagens — mesmo erro do agente arquivado.
		if (conversation.status === 'closed') throw Object.assign(new Error('Serviço atualmente desativado.'), { status: 503 });

		const history = await Message.findAll({
			where: { conversation_id: conversation.id },
			order: [['id', 'DESC']],
			limit: 20
		});

		await Message.create(
			{ 
				conversation_id: conversation.id,
				role: 'user',
				content: user_text
			}
		);
		
		const systemPrompt = [agent.objective, agent.description].filter(Boolean).join('\n\n');

		const modelConfig = typeof agent.model_config === 'string' ? JSON.parse(agent.model_config) : (agent.model_config || {});
		
		const modelOptions = modelConfig.options || {};

		const knowledge_chunks = null; // Fragmentos de RAG do Qdrant (null se não houver busca ativa)

		const { raw, content, tokens_used, tool_calls, latency_ms } = await llmModelClient.chat([
			{ role: 'system', content: preprocessCorpus(systemPrompt) },
			...history.map(m => ({ role: m.role, content: preprocessCorpus(m.content) })),
			{ role: 'user', content: preprocessCorpus(user_text) }
		], modelOptions);

		await Message.create({ 
			conversation_id: conversation.id,
			role: 'assistant', 
			content: content,
			knowledge_chunks: knowledge_chunks,
			tokens_used: tokens_used,
			tool_calls: tool_calls,
			latency_ms: latency_ms
		});

		agent.status = 'active';
		agent.save();

		conversation.last_message_at = new Date();
		await conversation.save();

		return { 
			conversation_id: conversation.id, 
			reply: content,
			rawResponse: raw
		};

	}

	async create(user_id, channel_id, name, description, objective, agent_option_temp, agent_option_top_p, agent_option_num_predict) {

		const existingAgent = await Agent.findOne({ 
			where: {
				name: name,
				user_id: user_id
			} 
		});

        if (existingAgent) {
            const err = new Error('Nome de agente já utilizado, use outro nome.');
            err.status = 409;
            throw err;
        }

		const agentModelConfig = {
			provider: llmInfo.provider,
			model: llmInfo.model,
			options: {
				temperature: agent_option_temp || 0.7,
				top_p: agent_option_top_p || 0.9,
				num_predict: agent_option_num_predict || 300
			},
			used_at: new Date()
		}

		return await Agent.create(
			{ 
				user_id: user_id,
				channel_id: channel_id,
				name: name,
				status: 'active',
				description: description, 
				objective: objective, 
				model_config: agentModelConfig
			}
		);

	}

	async findAll(page = 1, size = 10, search = '', user_id = null) {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 10);
		search = typeof search === 'string' ? search.trim() : '';

		const where = {};
		if (user_id !== null && user_id !== undefined) where.user_id = user_id;
		if (search) {
			where[Op.or] = [
				{ name: { [Op.like]: `%${search}%` } },
				{ description: { [Op.like]: `%${search}%` } },
				{ objective: { [Op.like]: `%${search}%` } }
			];
		}
		const { rows, count: total } = await Agent.findAndCountAll({
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

	async getAllConversations(id, page = 1, size = 10) {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 10);

		const { rows, count: total } = await Conversation.findAndCountAll({
			where: { agent_id: id },
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
		const record = await Agent.findByPk(id);
		if (!record) {
			const error = new Error('Agente não encontrado.');
			error.status = 404;
			throw error;
		}
		return record;
	}

	async update(id, user_id, channel_id, name, description, objective, agent_option_temp, agent_option_top_p, agent_option_num_predict) {
		const record = await Agent.findByPk(id);

		if (!record) {
			const error = new Error('Agente não encontrado.');
			error.status = 404;
			throw error;
		}

		if (channel_id !== undefined) record.channel_id = channel_id;
		if (user_id !== undefined) record.user_id = user_id;
		if (name !== undefined) record.name = name;
		if (description !== undefined) record.description = description;
		if (objective !== undefined) record.objective = objective;

		const currentModelConfig = typeof record.model_config === 'string' ? JSON.parse(record.model_config) : (record.model_config || {});

		const modelConfig = {
			...currentModelConfig,
			provider: currentModelConfig.provider || llmInfo.provider,
			model: currentModelConfig.model || llmInfo.model,
			options: {
				...(currentModelConfig.options || {}),
			},
			used_at: currentModelConfig.used_at || new Date()
		};

		if (agent_option_temp !== undefined) modelConfig.options.temperature = agent_option_temp;
		if (agent_option_top_p !== undefined) modelConfig.options.top_p = agent_option_top_p;
		if (agent_option_num_predict !== undefined) modelConfig.options.num_predict = agent_option_num_predict;

		record.model_config = modelConfig;

		await record.save();

		return record;
	}

	async toggleStatus(id, status) {
		const record = await Agent.findByPk(id);

		if (!record) {
			const error = new Error('Agente não encontrado.');
			error.status = 404;
			throw error;
		}

		if (!['draft', 'active', 'archived'].includes(status)) {
			const error = new Error("Status must be 'draft', 'active' or 'archived'.");
			error.status = 400;
			throw error;
		}

		record.status = status;
		await record.save();

		return record;
	}

	async delete(id) {
		const record = await Agent.findByPk(id);

		if (!record) {
			const error = new Error('Agente não encontrado.');
			error.status = 404;
			throw error;
		}

		await record.destroy();

		return { message: 'Agente deletado com sucesso.' };
	}

}

const AgentController = new Controller();
export { AgentController };