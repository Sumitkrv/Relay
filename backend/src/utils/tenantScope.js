// Legacy owner-only clients remain supported; an active workspace always narrows the query.
export const tenantScope = req => ({
  ownerId: req.user._id,
  ...(req.workspaceId ? { workspaceId: req.workspaceId } : {}),
});
