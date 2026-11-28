import { Integration } from '../model/integration.js';
import { refreshGoogleCredentials } from '../connection/google.js';
import { ApiError } from '../contracts/Error.js';
class Controller {

    async findByUser(user_id, provider) {
        return Integration.findOne({
            where: { user_id, provider },
            attributes: { exclude: ['credentials', 'channel_id'] },
            include: [{
                association: 'channel'
            }]
        });
    }

    async findAllByUser(user_id) {
        return Integration.findAll({
            where: { user_id },
            attributes: { exclude: ['credentials', 'channel_id'] },
            include: [{
                association: 'channel'
            }]
        });
    }

    async findTokenByUser(user_id, provider) {

        if(!user_id || !provider) throw ApiError.notFound("ID de usuário e/ou provedor são necessários.")

        const integration = await Integration.findOne({
            where: {
                    user_id: user_id,
                    provider: provider
            },
            order: [['created_at', 'DESC']]
        });

        if (!integration) return null;

        switch (integration.provider) {
            case 'google': {
                // resolve o refresh (renova o access token ou lança REAUTH_GOOGLE_ACCOUNT)
                const { access_token } = await refreshGoogleCredentials(integration);

                return { access: access_token };
            }

            case 'whatsapp': {
                // O business token da Meta não expira no fluxo padrão: só lemos.
                const credentials = integration.credentials ? JSON.parse(integration.credentials) : {};

                return { access: credentials.business_token ?? null };
            }

            case 'discord': {
                // O bot token do Discord não expira no fluxo padrão: só lemos.
                const credentials = integration.credentials ? JSON.parse(integration.credentials) : {};

                return { access: credentials.access_token ?? null };
            }

            default: {
               throw ApiError.notFound("Necessário declarar o provider", 400);
            }
               
        }

    }

    async deleteUserProvider(user_id, provider){

        if(!user_id || !provider) throw ApiError.notFound("ID de usuário e/ou provedor são necessários.")

        const integration = await Integration.findOne({
            where: {
                    user_id: user_id,
                    provider: provider
            }
        });

        await integration.destroy();

		return { message: 'Integração deletada com sucesso.' };

    }

}

const IntegrationController = new Controller();
export { IntegrationController };