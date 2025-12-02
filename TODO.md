# Pre-Deployment TODO

## Before Production Deployment

- [ ] **Database-backed subject ID validation** - Replace in-memory `subjectIdList` with MongoDB check to verify if a session already exists for that subjectID. Current in-memory approach resets on server restart and doesn't verify actual experiment participation.
