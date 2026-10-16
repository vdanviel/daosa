import { Op } from 'sequelize';
import { __TitleModuleName__ } from '../model/__ModuleName__.js';

class Controller {

	async create(value1, value2, value3) {

    const existing__TittleModuleName__ = await __TittleModuleName__.findAll({ 
			where: {
        value1: value1
			} 
		});

    if (existing__TittleModuleName__) {
        const err = new Error('__TittleModuleName__ is already being used.');
        err.status = 409;
        throw err;
    }

		return __TitleModuleName__.create({
      value1,
      value2,
      value3
    });
	}

	async findAll(page = 1, size = 10, search = '') {
		page = Math.max(1, parseInt(page, 10) || 1);
		size = Math.max(1, parseInt(size, 10) || 10);
		search = typeof search === 'string' ? search.trim() : '';

		const searchableFields = Object.entries(__TitleModuleName__.rawAttributes)
			.filter(([, attribute]) => attribute.type?.key === 'STRING')
			.map(([field]) => field);
		const where = search && searchableFields.length > 0 ? {
			[Op.or]: searchableFields.map(field => ({
				[field]: { [Op.like]: `%${search}%` }
			}))
		} : {};

		const { rows, count: total } = await __TitleModuleName__.findAndCountAll({
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
		const record = await __TitleModuleName__.findByPk(id);
		if (!record) {
			const error = new Error('__TitleModuleName__ not found.');
			error.status = 404;
			throw error;
		}
		return record;
	}

	async update(id, value1, value2, value3) {
		const record = await __TitleModuleName__.findOne(id);

		record.value1 = value1;
		record.value2 = value2;
		record.value3 = value3;
		record.updated_at = new Date();

		await record.save();

		return record;
	}

	async toggleStatus(id, status) {
		const record = await __TitleModuleName__.findOne(id);

		if (!['draft', 'active', 'archived'].includes(status)) {
			const error = new Error("Status must be 'draft', 'active' or 'archived'.");
			error.status = 400;
			throw error;
		}

		record.status = status;

    record.save();

		return record;
	}

	async delete(id) {
		const record = await __TitleModuleName__.findOne(id);

		await record.destroy();

		return record;
    
	}
}

const __TitleModuleName__Controller = new Controller();
export { __TitleModuleName__Controller };