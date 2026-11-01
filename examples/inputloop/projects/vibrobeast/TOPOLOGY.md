---
name: vibrobeast
kind: container
pillar: part
layer: operational
contains: vibrobeast-skills
connects: gw33, avalon
repo: https://github.com/inputloop/vibrobeast
canonical: code.bru.st/corwin/vibrobeast
---
# vibrobeast

A memory Claude keeps on your own computer in plain files, with the skills, persona sheets and shared
rooms built around it. Ships as a plugin carrying three stdio MCP servers, and works as a plugin
marketplace for people who add the repository. Its skills are kept in their own repository,
`vibrobeast-skills`, so a person can take the skills without the servers.

A commit to vibrobeast is not complete unless its shelf on inputloop is correct.
