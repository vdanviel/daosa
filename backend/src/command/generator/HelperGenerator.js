import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandUtil } from '../CommandUtil.js';

class HelperGenerator {

    #helperPath;
    #templateFilePath;

    constructor() {
        this.#helperPath = path.dirname(fileURLToPath(import.meta.url)) + "/../../helper/";
        this.#templateFilePath = path.dirname(fileURLToPath(import.meta.url)) + "/../template/helper/";
    }

    #validateHelperName(name) {

        if (fs.existsSync(path.join(this.#helperPath, `${name}Helper.js`))) {
            throw new Error("Helper already exists.");
        }
        
    }

    async #generateFile(templatePath, destPath, replacements) {
        let content = await fs.promises.readFile(templatePath, 'utf8');
        for (const [key, value] of Object.entries(replacements)) {
            content = content.replaceAll(key, value);
        }
        await fs.promises.writeFile(destPath, content, {flag: 'wx'});
    }

    async generate(name) {
        try {
            this.#validateHelperName(name);

            console.log(`🚀 Creating helper (${name})...`);

            let helperName = CommandUtil.camelize(name, false);
            let titleHelperName = CommandUtil.camelize(name, true);

            const replacements = {
                "__ModuleName__": helperName,
                "__TitleModuleName__": titleHelperName
            };

            await this.#generateFile(
                path.join(this.#templateFilePath, "helperTemplate.js"),
                path.join(this.#helperPath, `${titleHelperName}Helper.js`),
                replacements
            );

            console.log(`✅ Helper (${helperName}) created with success!`);
        } catch (error) {
            throw error;
        }
    }

    listHelpers() {
        return fs.readdirSync(this.#helperPath)
            .filter(file => file.endsWith('Helper.js'))
            .map(file => file.replace('Helper.js', ''));
    }

    async remove(name) {
        try {
            const file = path.join(this.#helperPath, `${name.toLowerCase()}Helper.js`);
            if (fs.existsSync(file)) {
                await fs.promises.unlink(file);
            }
            console.log(`🗑️  Helper (${name.toLowerCase()}) removed.`);
        } catch (error) {
            throw error;
        }

    }
}


export { HelperGenerator };
