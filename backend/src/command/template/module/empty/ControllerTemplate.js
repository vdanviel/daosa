import { __TitleModuleName__ } from '../model/__TitleModuleName__.js';

class Controller {
	async find(id) {
		const record = await __TitleModuleName__.findByPk(id);
		if (!record) {
			const error = new Error('Not found.');
			error.status = 404;
			throw error;
		}
		return record;
	}
}

const __TitleModuleName__Controller = new Controller();
export { __TitleModuleName__Controller };