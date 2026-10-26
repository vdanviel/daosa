import { Channel } from '../model/channel.js';

class Controller {

    async findAll() {
		return Channel.findAll();
	}

    async find(id) {
		const record = await Channel.findByPk(id);
		if (!record) {
			const error = new Error('Canal não encontrado.');
			error.status = 404;
			throw error;
		}
		return record;
	}

}

const ChannelController = new Controller();

export { ChannelController };