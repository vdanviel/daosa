import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandUtil } from '../CommandUtil.js';

class ModuleGenerator {

    _modelPath;
    _controllerPath;
    _routePath;
    _templateFileEmptyPath;
    _templateFileFilledPath;

    constructor() {
        this._modelPath = fileURLToPath(new URL('../../model/', import.meta.url));
        this._controllerPath = fileURLToPath(new URL('../../controller/', import.meta.url));
        this._routePath = fileURLToPath(new URL('../../router/', import.meta.url));
        this._templateFileEmptyPath = fileURLToPath(new URL('../template/module/empty/', import.meta.url));
        this._templateFileFilledPath = fileURLToPath(new URL('../template/module/complete/', import.meta.url));
    }

    _validateModuleName(titleModuleName) {
        if (fs.existsSync(path.join(this._modelPath, `${titleModuleName}.js`))) {
            throw new Error("Module already exists.");
        }
        
    }

    async _generateFile(templatePath, destPath, replacements) {
        let content = await fs.promises.readFile(templatePath, 'utf8');
        for (const [key, value] of Object.entries(replacements)) {
            content = content.replaceAll(key, value);
        }
        await fs.promises.writeFile(destPath, content, {flag: 'wx'});
    }

    async generate(name, emptyOrFull) {
        try {
            const moduleName = CommandUtil.camelize(name, false);
            const titleModuleName = CommandUtil.camelize(name, true);
            this._validateModuleName(titleModuleName);

            let templatePath;
            if (emptyOrFull === 'empty') {
                templatePath = this._templateFileEmptyPath;
            } else if (emptyOrFull === 'complete') {
                templatePath = this._templateFileFilledPath;
            } else {
                throw new Error("The second parameter must be 'empty' or 'complete', " + emptyOrFull + " given.");
            }

            console.log(`🚀 Creating ${emptyOrFull} module (${name})...`);

            const replacements = {
                "__ModuleName__": moduleName,
                "__TitleModuleName__": titleModuleName
            };

            const modelTemplate = ['modelTemplate.js', 'ModelTemplate.js']
                .map(file => path.join(templatePath, file))
                .find(file => fs.existsSync(file));
            const controllerTemplate = ['controllerTemplate.js', 'ControllerTemplate.js']
                .map(file => path.join(templatePath, file))
                .find(file => fs.existsSync(file));

            await this._generateFile(
                modelTemplate,
                path.join(this._modelPath, `${titleModuleName}.js`),
                replacements
            );
            await this._generateFile(
                controllerTemplate,
                path.join(this._controllerPath, `${titleModuleName}Controller.js`),
                replacements
            );
            await this._generateFile(
                path.join(templatePath, "routerTemplate.js"),
                path.join(this._routePath, `${titleModuleName}Router.js`),
                replacements
            );

            console.log(`✅ Module (${titleModuleName}) created with success!`);
        } catch (error) {
            throw error;
        }
    }

    listModules() {
        return fs.readdirSync(this._modelPath)
            .filter(file => file.endsWith('.js'))
            .map(file => file.replace('.js', ''));
    }

    async remove(name) {
        try {
            const titleModuleName = CommandUtil.camelize(name, true);
            const files = [
                path.join(this._modelPath, `${titleModuleName}.js`),
                path.join(this._controllerPath, `${titleModuleName}Controller.js`),
                path.join(this._routePath, `${titleModuleName}Router.js`)
            ];
            for (const file of files) {
                if (fs.existsSync(file)) {
                    await fs.promises.unlink(file);
                }
            }
            console.log(`Module (${titleModuleName}) removed.`);
        } catch (error) {
            throw error;
        }

    }
}


export { ModuleGenerator };