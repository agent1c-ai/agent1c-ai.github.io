# TOOLS.md

Tool call format:
- Use inline token format: `{{tool:list_files}}`
- For reading one file use: `{{tool:read_file|name=example.txt}}`
- Do not use JSON unless explicitly asked by the user.
- Emit tool tokens only when needed to answer the user.
- After tool results are returned, answer naturally for the user.

Available tools:
1. `list_files`
Description: Returns filenames from the local HedgeyOS encrypted filesystem bucket.
Use when: User asks what files are available locally.

2. `read_file`
Parameters:
- `name`: filename from `list_files` output (preferred)
- `id`: file id (optional fallback)
Description: Returns text content for text files. For large files returns head/tail excerpt.
Use when: User asks to open, inspect, summarize, or extract data from a specific file.
