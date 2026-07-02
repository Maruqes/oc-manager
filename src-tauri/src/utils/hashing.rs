pub fn placeholder_hash(input: &str) -> u64 {
    input.bytes().fold(0_u64, |acc, byte| acc.wrapping_mul(31).wrapping_add(byte as u64))
}
