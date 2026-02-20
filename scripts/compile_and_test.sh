#!/bin/bash
# Run this inside WSL after reboot:
# wsl -d Ubuntu -- bash /mnt/c/Users/Asus/Desktop/ZKMind/scripts/compile_and_test.sh

set -e

export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"

CIRCUITS_DIR="/mnt/c/Users/Asus/Desktop/ZKMind/circuits"
cd "$CIRCUITS_DIR"

echo "=== Step 1: Verify toolchain ==="
nargo --version
bb --version

echo ""
echo "=== Step 2: Run circuit tests ==="
nargo test --show-output

echo ""
echo "=== Step 3: Compile circuit ==="
nargo compile

echo ""
echo "=== Step 4: Generate verification key ==="
bb write_vk_ultra_keccak_honk -b target/mastermind.json -o target/vk --oracle_hash keccak

echo ""
echo "=== Step 5: Generate test proof ==="
# First we need to execute to get the witness
nargo execute

# Then prove
bb prove_ultra_keccak_honk -b target/mastermind.json -w target/mastermind.gz -o target/proof --oracle_hash keccak

echo ""
echo "=== Step 6: Verify proof locally ==="
bb verify_ultra_keccak_honk -k target/vk -p target/proof

echo ""
echo "=== ALL DONE! Circuit compiles, proof generation and verification work. ==="
echo "VK file: $CIRCUITS_DIR/target/vk"
echo "Proof file: $CIRCUITS_DIR/target/proof"
