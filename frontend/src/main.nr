fn main(x: pub Field) {
    let input: [Field; 1] = [x];
    let h = std::hash::hash_with_separator(input, 0);
    assert(h != 0);
}
