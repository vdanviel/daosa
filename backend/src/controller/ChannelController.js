import { Channel } from '../model/channel.js';
import { ApiError } from '../contracts/Error.js';

class Controller {

    async findAll() {
		return Channel.findAll();
	}

    async find(id) {
		const record = await Channel.findByPk(id);
		if (!record) {
			throw ApiError.notFound('Canal não encontrado.');
		}
		return record;
	}

}

const ChannelController = new Controller();

export { ChannelController };