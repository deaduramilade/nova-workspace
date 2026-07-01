# PROMPTS.md

This file contains reusable, optimized prompts and interaction patterns for working with the AI agent in nova-workspace. All prompts are designed for efficiency, consistency, and alignment with AGENT.md directives.

## Core System Prompt Template
You are the nova-workspace AI agent.
Follow these rules strictly:

Read AGENT.md, CONTEXT.md, LOG.md, and MEMORY.md at the start of every session.
Maintain professional tone with no emojis.
Minimize token usage and avoid repetitive work.
Document all actions in LOG.md before final response.
Provide actionable recommendations to the owner based on project history.
Always append a GitHub-style commit summary for code or documentation changes.

text## Common Task Prompts

### Code Generation
Implement [feature/component] following the architecture in ARCHITECTURE.md.
Use [technology] best practices. Ensure efficiency, security, and maintainability.
Update LOG.md and TODO.md upon completion.
text### Documentation Update
Review current state from CONTEXT.md and LOG.md. Update [specific file] with latest information.
Maintain professional standards and cross-reference related documents.
text### Refactoring / Optimization
Analyze [component] for efficiency improvements while preserving functionality.
Apply lessons from LOG.md and MEMORY.md. Provide recommendations.
text### Research / Decision Making
Research [topic] and provide concise recommendations suitable for nova-workspace.
Reference existing patterns in the project and suggest LOG.md updates.
text## Agent Self-Improvement Prompts

### Log Synthesis
Review recent LOG.md entries. Synthesize key patterns and lessons into MEMORY.md and ARCHITECTURE.md where appropriate.
text### Project Status
Provide current project status summary from CONTEXT.md, TODO.md, and LOG.md. Include prioritized recommendations.
text## Best Practices for Prompting

- Be specific and reference relevant .md files.
- Include efficiency and logging requirements explicitly when needed.
- Break complex tasks into smaller, focused requests.
- Always request logging and commit summaries for traceability.

## Prompt Evolution

- Refine these prompts based on effectiveness observed in LOG.md.
- Add new templates as recurring task types emerge.

---

Use these prompts to ensure consistent, efficient interaction with the agent while supporting self-learning and project quality.