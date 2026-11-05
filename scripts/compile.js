const fs = require('fs');
const path = require('path');
const solc = require('solc');

function compile() {
  const contractPath = path.resolve(__dirname, '../contracts/BOTNetworkHealth.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'BOTNetworkHealth.sol': {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  console.log('Compiling BOTNetworkHealth.sol...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    for (const error of output.errors) {
      if (error.severity === 'error') {
        console.error(error.formattedMessage);
        hasError = true;
      } else {
        console.warn(error.formattedMessage);
      }
    }
    if (hasError) {
      process.exit(1);
    }
  }

  const contract = output.contracts['BOTNetworkHealth.sol']['BOTNetworkHealth'];
  const artifact = {
    contractName: 'BOTNetworkHealth',
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };

  const artifactDir = path.resolve(__dirname, '../contracts');
  fs.writeFileSync(
    path.join(artifactDir, 'BOTNetworkHealth.json'),
    JSON.stringify(artifact, null, 2)
  );

  const libDir = path.resolve(__dirname, '../lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(libDir, 'BOTNetworkHealthArtifact.json'),
    JSON.stringify(artifact, null, 2)
  );

  console.log('Successfully compiled BOTNetworkHealth.sol and generated artifacts!');
}

if (require.main === module) {
  compile();
}

module.exports = compile;

