# PATTERNS.md

This file documents reusable patterns, conventions, and proven solutions established in nova-workspace. The agent **must** consult this file to maintain consistency and avoid reinventing solutions already documented in LOG.md and MEMORY.md.

## Coding Patterns

### File Structure
- [Describe standard folder layout and naming conventions.]

### Component Design
- Modular, single-responsibility components.
- Clear separation of concerns.
- [Add specific patterns as they emerge.]

### Error Handling
- Consistent error handling strategy.
- Centralized logging of errors with context.

### Configuration Management
- [Preferred approach for configuration.]

### Performance Patterns
- Lazy loading where appropriate.
- Efficient data structures and algorithms.
- Resource cleanup best practices.

## Documentation Patterns

- Use clear, professional language.
- Cross-reference AGENT.md, CONTEXT.md, ARCHITECTURE.md, and DECISIONS.md.
- Update LOG.md after every significant task.

## Agent Interaction Patterns

- Always start sessions by reading AGENT.md + CONTEXT.md + LOG.md + MEMORY.md.
- Log all work before final output.
- Provide recommendations derived from project history.
- Append commit summary for all code and documentation changes.

## UI/UX Patterns (if applicable)
- [Document interface consistency rules.]

## Testing Patterns
- [Unit, integration, and end-to-end testing approaches.]

## Learned Patterns from LOG.md

[This section will grow with project history. Summarize recurring successful approaches here for quick reference.]

## Anti-Patterns to Avoid

- Code duplication (use existing patterns instead).
- Unnecessary complexity.
- Inefficient resource usage.
- Lack of documentation or logging.

---

**Maintenance**: Review and expand this file during code reviews and major development phases. The agent should reference PATTERNS.md to ensure new work aligns with established, proven approaches. Synthesize new effective patterns from LOG.md entries periodically.

This catalog of patterns supports consistency, efficiency, and continuous improvement across the project.