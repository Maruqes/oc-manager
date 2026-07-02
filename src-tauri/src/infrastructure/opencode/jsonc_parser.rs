use serde_json::Value;

pub struct JsoncParser;

impl JsoncParser {
    pub fn parse(content: &str) -> serde_json::Result<Value> {
        let without_comments = strip_jsonc_comments(content);
        serde_json::from_str(&strip_trailing_commas(&without_comments))
    }
}

fn strip_jsonc_comments(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(ch) = chars.next() {
        if in_string {
            output.push(ch);

            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }

            continue;
        }

        if ch == '"' {
            in_string = true;
            output.push(ch);
            continue;
        }

        if ch == '/' {
            match chars.peek() {
                Some('/') => {
                    chars.next();
                    for next in chars.by_ref() {
                        if next == '\n' {
                            output.push('\n');
                            break;
                        }
                    }
                }
                Some('*') => {
                    chars.next();
                    let mut previous = '\0';
                    for next in chars.by_ref() {
                        if previous == '*' && next == '/' {
                            break;
                        }
                        previous = next;
                    }
                }
                _ => output.push(ch),
            }
            continue;
        }

        output.push(ch);
    }

    output
}

fn strip_trailing_commas(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut index = 0;
    let mut in_string = false;
    let mut escaped = false;

    while index < chars.len() {
        let ch = chars[index];

        if in_string {
            output.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            index += 1;
            continue;
        }

        if ch == '"' {
            in_string = true;
            output.push(ch);
            index += 1;
            continue;
        }

        if ch == ',' {
            let mut lookahead = index + 1;
            while lookahead < chars.len() && chars[lookahead].is_whitespace() {
                lookahead += 1;
            }

            if matches!(chars.get(lookahead), Some('}' | ']')) {
                index += 1;
                continue;
            }
        }

        output.push(ch);
        index += 1;
    }

    output
}
