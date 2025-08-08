# Assistant Interaction Guidelines

## Before Making Changes
1. Ask the assistant to analyze existing code first:
   ```
   "Before suggesting any changes, please:
   1. Show me the existing implementation
   2. Explain the current flow
   3. Identify any gaps
   4. Only then suggest necessary changes"
   ```

2. Request documentation of current state:
   ```
   "Please document:
   1. Current endpoints and their functionality
   2. Existing data flow
   3. Current status management
   4. Any existing patterns"
   ```

## When Requesting Changes
1. Be explicit about constraints:
   ```
   "Please:
   - Don't add new endpoints unless absolutely necessary
   - Stick to existing patterns
   - Don't modify database schema unless explicitly requested
   - Only modify [specific files/components]"
   ```

2. Request step-by-step approach:
   ```
   "Please:
   1. First explain what you understand
   2. Then explain what changes you think are needed
   3. Wait for my confirmation before making changes"
   ```

3. Ask for validation:
   ```
   "Please confirm:
   - Is this change really necessary?
   - Are there existing endpoints that handle this?
   - Can you show me where this functionality exists?"
   ```

## For Complex Changes
1. Request incremental changes:
   ```
   "Let's:
   1. Make one small change at a time
   2. Show proposed changes before implementing
   3. Validate each step before proceeding"
   ```

2. Ask for impact analysis:
   ```
   "Please analyze:
   - What other parts will be affected?
   - What are the risks?
   - How will this affect existing functionality?"
   ```

## For Testing
1. Request test scenarios:
   ```
   "Please outline:
   - How to test this change
   - What could break
   - What edge cases to consider"
   ```

## Example Usage
```
"Before modifying the payment flow, please:
1. Show me the existing payment endpoints and their functionality
2. Explain how the current group payment flow works
3. Identify if there are any gaps in the current implementation
4. Only then suggest any necessary changes"
```

## Common Pitfalls to Avoid
1. Don't let the assistant:
   - Add redundant endpoints
   - Modify database schema without explicit request
   - Break existing patterns
   - Make changes without proper analysis

2. Always ask for:
   - Current implementation details
   - Impact analysis
   - Testing strategy
   - Validation of necessity

## Best Practices
1. Always start with analysis
2. Request documentation first
3. Validate necessity of changes
4. Make incremental changes
5. Test thoroughly
6. Consider impact on existing code 