import { Integration } from '../model/integration.js';
import { refreshGoogleCredentials } from '../connection/google.js';

class Controller {

    async findByUser(user_id, provider) {
        return Integration.findOne({
            where: { user_id, provider },
            attributes: { exclude: ['credentials', 'metadata'] }
        });
    }

    async findAllByUser(user_id) {
        return Integration.findAll({
            where: { user_id },
            attributes: { exclude: ['credentials', 'metadata'] }
        });
    }

    async findTokenByUser(user_id, provider) {

        const integration = await Integration.findOne({
            where: {
                user_id,
                ...(provider ? { provider } : {})
            }
        });

        if (!integration) return null;

        switch (integration.provider) {
            case 'google': {
                // resolve o refresh (renova o access token ou lança REAUTH_GOOGLE_ACCOUNT)
                const { access_token } = await refreshGoogleCredentials(integration);

                return { access: access_token };
            }

            default:
               throw new Error("Necessário declarar o provider", {status: 400});
               
        }

    }

}

const IntegrationController = new Controller();
export { IntegrationController };