#!/bin/bash
set -e
export PATH="$HOME/.nargo/bin:$PATH"
cd /tmp/test_hash

# Test 1: pedersen_hash (known to work)
cat > src/main.nr << 'EOF'
fn main(x: pub Field) {
    let h = std::hash::pedersen_hash([x]);
    assert(h != 0);
}
EOF
echo "=== Test pedersen_hash ==="
nargo check && echo "OK" || echo "FAIL"

# Test 2: poseidon2 via Poseidon2::hash
cat > src/main.nr << 'EOF'
fn main(x: pub Field) {
    let h = std::hash::poseidon2::Poseidon2::hash([x], 1);
    assert(h != 0);
}
EOF
echo "=== Test Poseidon2::hash ==="
nargo check 2>&1 && echo "OK" || echo "FAIL"

# Test 3: hash_with_separator
cat > src/main.nr << 'EOF'
fn main(x: pub Field) {
    let h = std::hash::hash_with_separator([x], 0);
    assert(h != 0);
}
EOF
echo "=== Test hash_with_separator ==="
nargo check 2>&1 && echo "OK" || echo "FAIL"

# Test 4: sha256
cat > src/main.nr << 'EOF'
fn main(x: pub Field) {
    let h = std::hash::sha256([x as u8]);
    assert(h[0] != 0);
}
EOF
echo "=== Test sha256 ==="
nargo check 2>&1 && echo "OK" || echo "FAIL"

# Test 5: Try poseidon (external lib) - skip for now
echo "=== Available hash functions tested ==="
