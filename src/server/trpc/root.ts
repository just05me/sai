import { router } from './trpc';
import { workspaceRouter } from './routers/workspace';
import { projectsRouter } from './routers/projects';
import { nodesRouter } from './routers/nodes';
import { edgesRouter } from './routers/edges';
import { chatsRouter } from './routers/chats';
import { byokRouter } from './routers/byok';
import { snapshotsRouter } from './routers/snapshots';
import { hypothesesRouter } from './routers/hypotheses';
import { shareRouter } from './routers/share';
import { templatesRouter } from './routers/templates';
import { searchRouter } from './routers/search';
import { commentsRouter } from './routers/comments';
import { syncRouter } from './routers/sync';

export const appRouter = router({
  workspace: workspaceRouter,
  projects: projectsRouter,
  nodes: nodesRouter,
  edges: edgesRouter,
  chats: chatsRouter,
  byok: byokRouter,
  snapshots: snapshotsRouter,
  hypotheses: hypothesesRouter,
  share: shareRouter,
  templates: templatesRouter,
  search: searchRouter,
  comments: commentsRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
