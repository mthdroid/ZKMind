/**
 * Compile the Mastermind Noir circuit using noir_wasm (no WSL needed).
 * Works around Windows path issues by manually writing files to FileManager.
 */
import { compile_program, createFileManager } from '@noir-lang/noir_wasm';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const circuitsDir = resolve(__dirname, '..', 'circuits');
const targetDir = resolve(circuitsDir, 'target');

async function main() {
  console.log('=== Compiling Noir circuit ===');

  // Create FM with a virtual root and manually add files
  // This works around Windows backslash path issues
  const fm = createFileManager('/');

  // Read source files from disk
  const mainNr = readFileSync(resolve(circuitsDir, 'src', 'main.nr'), 'utf8');
  const nargoToml = readFileSync(resolve(circuitsDir, 'Nargo.toml'), 'utf8');

  // Write them to the virtual file manager with Unix-style paths
  fm.writeFile('src/main.nr', new TextEncoder().encode(mainNr));
  fm.writeFile('Nargo.toml', new TextEncoder().encode(nargoToml));

  console.log('Files loaded into FileManager');
  console.log('Compiling...');

  const compiled = await compile_program(fm);

  // Save compiled circuit
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(
    resolve(targetDir, 'mastermind.json'),
    JSON.stringify(compiled.program)
  );

  console.log('Circuit compiled successfully!');
  console.log('Output:', resolve(targetDir, 'mastermind.json'));
  console.log('ABI parameters:');
  for (const p of compiled.program.abi.parameters) {
    console.log(`  ${p.visibility === 'public' ? 'pub ' : '    '}${p.name}: ${JSON.stringify(p.type)}`);
  }
  console.log(`Bytecode size: ${compiled.program.bytecode.length} chars`);

  // Step 2: Test witness generation
  console.log('\n=== Testing witness generation ===');
  const noir = new Noir(compiled.program);

  try {
    const { witness } = await noir.execute({
      secret_code: [0, 1, 2, 3],
      guess: [0, 3, 1, 2],
      correct_position: 1,
      correct_color: 3,
      commitment: '0x0000000000000000000000000000000000000000000000000000000000000000',
    });
    console.log('WARNING: Witness generated with dummy commitment (unexpected)');
  } catch (e) {
    console.log('Expected: commitment assertion failed');
    console.log('Error:', e.message?.substring(0, 200));
  }

  console.log('\nCompilation and basic testing complete!');
}

main().catch(err => {
  console.error('Compilation failed:', err.message?.substring(0, 300) || err);
  process.exit(1);
});
