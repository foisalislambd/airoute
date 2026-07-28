export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`airoute providers\` for the full provider management interface:

    airoute providers available   — show provider catalog
    airoute providers list        — list configured connections
    airoute providers test <name> — test a provider connection
    airoute providers test-all    — test all active connections
    airoute providers validate    — validate local configuration
`);
    });
}
