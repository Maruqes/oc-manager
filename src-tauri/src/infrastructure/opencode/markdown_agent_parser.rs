use serde_json::{json, Map, Value};

pub struct MarkdownAgentParser;

impl MarkdownAgentParser {
    pub fn parse(content: &str) -> Value {
        let normalized = content.replace("\r\n", "\n");
        let mut lines = normalized.lines();
        if lines.next().map(str::trim) != Some("---") {
            return json!({ "markdownBody": content });
        }

        let mut frontmatter_lines = Vec::new();
        let mut body_lines = Vec::new();
        let mut in_frontmatter = true;

        for line in lines {
            if in_frontmatter && line.trim() == "---" {
                in_frontmatter = false;
                continue;
            }

            if in_frontmatter {
                frontmatter_lines.push(line.to_string());
            } else {
                body_lines.push(line.to_string());
            }
        }

        if in_frontmatter {
            return json!({ "markdownBody": content });
        }

        let mut object = Map::new();
        let mut index = 0;
        while index < frontmatter_lines.len() {
            let line = &frontmatter_lines[index];
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || is_indented(line) {
                index += 1;
                continue;
            }

            if let Some((key, value)) = trimmed.split_once(':') {
                let key = key.trim().to_string();
                let value = value.trim();
                if value.is_empty() {
                    let (nested, next_index) = parse_nested_block(&frontmatter_lines, index + 1);
                    object.insert(key, nested);
                    index = next_index;
                    continue;
                }

                object.insert(key, scalar_value(value));
            }

            index += 1;
        }

        let body = body_lines.join("\n").trim().to_string();
        object.insert("prompt".into(), json!(body));
        object.insert("markdownBody".into(), json!(body));
        Value::Object(object)
    }
}

fn parse_nested_block(lines: &[String], start: usize) -> (Value, usize) {
    let mut map = Map::new();
    let mut index = start;

    while index < lines.len() {
        let line = &lines[index];
        if !is_indented(line) && !line.trim().is_empty() {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            index += 1;
            continue;
        }

        if let Some(item) = trimmed.strip_prefix("- ") {
            map.insert(item.trim().to_string(), json!(true));
        } else if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim();
            if value.is_empty() {
                let (nested, next_index) = parse_deeper_nested_block(lines, index + 1, indentation(line));
                map.insert(key, nested);
                index = next_index;
                continue;
            }
            map.insert(key, scalar_value(value));
        }

        index += 1;
    }

    (Value::Object(map), index)
}

fn parse_deeper_nested_block(lines: &[String], start: usize, parent_indent: usize) -> (Value, usize) {
    let mut map = Map::new();
    let mut index = start;

    while index < lines.len() {
        let line = &lines[index];
        if line.trim().is_empty() {
            index += 1;
            continue;
        }
        if indentation(line) <= parent_indent {
            break;
        }

        let trimmed = line.trim();
        if let Some((key, value)) = trimmed.split_once(':') {
            map.insert(key.trim().to_string(), scalar_value(value.trim()));
        }
        index += 1;
    }

    (Value::Object(map), index)
}

fn is_indented(line: &str) -> bool {
    line.chars().next().map(|ch| ch.is_whitespace()).unwrap_or(false)
}

fn indentation(line: &str) -> usize {
    line.chars().take_while(|ch| ch.is_whitespace()).count()
}

fn scalar_value(value: &str) -> Value {
    let unquoted = value.trim_matches('"').trim_matches('\'');
    match unquoted {
        "true" => json!(true),
        "false" => json!(false),
        _ => unquoted
            .parse::<f64>()
            .map(Value::from)
            .unwrap_or_else(|_| json!(unquoted)),
    }
}
