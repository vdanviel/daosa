// ferramenta command line para gerar arquitetura de modulos de forma automatica e mais

import { ModuleGenerator } from "./src/command/generator/ModuleGenerator.js";
import { HelperGenerator } from "./src/command/generator/HelperGenerator.js";
import { Command } from 'commander';

const program = new Command();

//module commands...
const moduleCommand = program.command('module')
  .description('Module commands');

// gerar modulo
moduleCommand.command('generate <name>')
  .description('Generate new module')
  .argument('<name>', 'name of the module')
  .option('--mode <mode>', 'mode of the module (e.g., empty or complete)')
  .action(async (name, opt) => {

    const generator = new ModuleGenerator();
    
    await generator.generate(name, opt.mode || 'empty');

  });

// remover modulo
moduleCommand.command('remove') // Mudança aqui! De 'remove' para 'rm'
  .description('Remove an existing module')
  .argument('<name>', 'name of the module to remove')
  .action(async (name) => {

    const generator = new ModuleGenerator();

    // A lógica de remoção permanece a mesma, apenas o comando mudou
    await generator.remove(name);

  });

// listar modulos
moduleCommand.command('list')
  .description('List modules')
  .action(async () => {

    const generator = new ModuleGenerator();

    console.log(await generator.listModules())

  });

// comandos de helper
const helperCommand = program.command('helper')
.description('Helper commands');

// cria helper
helperCommand.command('create')
  .description("Create a new helper")
  .argument('<name>', 'name of the helper')
  .action(async (name, opt) => {

      const helper = new HelperGenerator();

      await helper.generate(name);

  });

// remove helper
helperCommand.command('remove')
  .description("Remove a helper")
  .argument('<name>', 'name of the helper')
  .action(async (name) => {

      const helper = new HelperGenerator();

      await helper.remove(name);

  });

// listar helpers
helperCommand.command('list')
  .description("List helpers")
  .action(async () => {

      const helper = new HelperGenerator();

      console.log(await helper.listHelpers());

  });

program.parse();