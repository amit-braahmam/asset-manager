---
name: Toast compatibility
description: Workspace-specific guidance for rendering toast notifications in React web artifacts.
---

Use the existing project toast provider and hook for notifications in React web artifacts rather than adding a standalone toast renderer.

**Why:** A standalone toast renderer triggered an invalid React hook call at runtime in the shared workspace, even though typechecking and production build passed.

**How to apply:** Reuse the existing `Toaster` component and `useToast` hook from the artifact's UI scaffold when adding user feedback notifications.