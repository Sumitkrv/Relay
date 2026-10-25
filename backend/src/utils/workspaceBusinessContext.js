// Use the authorized workspace identity, never another business owned by the same user.
export function workspaceBusinessContext(user = {}, workspace) {
  if (!workspace) return user;
  const operator = user?.toObject ? user.toObject() : user;
  return {
    name: operator.name || '',
    businessName: workspace.name || '',
    workspaceName: workspace.name || '',
    businessPhone: workspace.businessPhone || '',
    businessEmail: workspace.businessEmail || '',
    website: workspace.website || workspace.settings?.website || '',
    businessAddress: workspace.settings?.address || '',
    businessHours: workspace.settings?.businessHours || '',
  };
}
