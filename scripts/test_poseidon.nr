use std::hash::pedersen_hash;

fn main(x: pub Field) {
    let h = pedersen_hash([x]);
    assert(h == h);
}
