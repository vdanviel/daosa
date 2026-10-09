import { Op } from 'sequelize';
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

  async all(page = 1, size = 10, search = '') {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.max(1, parseInt(size, 10) || 10);
    const where = search ? {
      [Op.or]: ['value_1', 'value_2', 'value_3'].map(field => ({
        [field]: { [Op.like]: `%${search}%` }
      }))
    } : {};
    const { rows, count } = await __TitleModuleName__.findAndCountAll({
      where,
      offset: (safePage - 1) * safeSize,
      limit: safeSize
    });

    return {
      data: rows,
      total: count,
      quantity: rows.length,
      totalPages: Math.ceil(count / safeSize)
    };
  }

  async create(value1, value2, value3) {
    return __TitleModuleName__.create({
      value_1: value1,
      value_2: value2,
      value_3: value3
    });
  }

  async update(id, value1, value2, value3) {
    const record = await this.find(id);
    const fields = Object.fromEntries(
      Object.entries({ value_1: value1, value_2: value2, value_3: value3 })
        .filter(([, value]) => value !== undefined)
    );
    if (Object.keys(fields).length > 0) {
      await record.update({ ...fields, updated_at: new Date() });
    }
    return record;
  }

  async delete(id) {
    const deletedCount = await __TitleModuleName__.destroy({ where: { id } });
    if (deletedCount === 0) {
      const error = new Error('Not found.');
      error.status = 404;
      throw error;
    }
    return { message: 'Deleted successfully.' };
  }

  async toggleStatus(id) {
    const record = await this.find(id);
    const status = !record.status;
    await record.update({ status, updated_at: new Date() });
    return { message: `Status ${status ? 'enabled' : 'disabled'} successfully.` };
  }
}

const __TitleModuleName__Controller = new Controller();
export { __TitleModuleName__Controller };