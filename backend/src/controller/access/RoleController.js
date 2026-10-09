import { Role } from "../../model/access/role.js";
import { Op } from 'sequelize';

class Controller {

	async find(name) {
        const role = await Role.findOne({ where: { name } });
        if (!role) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }
        return role;
	}

    async findById(roleId) {
        const role = await Role.findByPk(roleId);
        if (!role) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }
        return role;
    }

    async all(page = 1, size = 10, search = '') {

        page = Math.max(1, parseInt(page, 10) || 1);
        size = Math.max(1, parseInt(size, 10) || 10);
        const where = search ? {
            [Op.or]: [
                { name: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ]
        } : {};
        const { rows: role, count: total } = await Role.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size
        });

        if (role.length == 0 ) {
            const err = new Error("Não há roles registrados(a).");
            err.status = 404;
            throw err;
        }

        return {
			data: role,
			total: total,
            quantity: role.length,
           	totalPages: Math.ceil(total / size)
		};

    }

	async create(name, permissions, description) {
        
        const data = await Role.create({
            name: name,
            permissions: permissions,
            description: description,
		});
		return data;
	}

    async update(roleId, name, permissions, description) {

        // Dados que podem ser atualizados
        const updatedData = {
            name: name,
            permissions: permissions,
            description: description
        };
        
        const fieldsToUpdate = Object.entries(updatedData).reduce((acc, [key, value]) => {

            if (value !== undefined) {
                
                acc[key] = value;
                
            }

            return acc;
        }, {});

        if (Object.keys(fieldsToUpdate).length === 0) {
            return await this.findById(roleId);
        }

        fieldsToUpdate.updated_at = new Date();
        const [updatedCount] = await Role.update(fieldsToUpdate, { where: { id: roleId } });

        if (updatedCount === 0) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }

        return await this.findById(roleId);
    }

	async delete(roleId) {
		// Deleta registro
		const deletedCount = await Role.destroy({ where: { id: roleId } });
        if (deletedCount === 0) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }
        return { message: "Deletado com sucesso." };
	}

	async toggleStatus(roleId) {
		// Alterna status booleano
		const role = await Role.findByPk(roleId);
        if (!role) {
            const err = new Error("Não encontrado.");
            err.status = 404;
            throw err;
        }

		const newStatus = !role.status;

        await role.update({ status: newStatus, updated_at: new Date() });
		return { message: `Status ${newStatus ? 'ativado' : 'desativado'} com sucesso.` };
	}
}

const roleController = new Controller();
export { roleController };
