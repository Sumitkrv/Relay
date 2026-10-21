import api from './api';

export const listTemplates=params=>api.get('/templates',{params});
export const getTemplate=id=>api.get(`/templates/${id}`);
export const createTemplate=body=>api.post('/templates',body);
export const updateTemplate=(id,body)=>api.patch(`/templates/${id}`,body);
export const deleteTemplate=id=>api.delete(`/templates/${id}`);
export const duplicateTemplate=id=>api.post(`/templates/${id}/duplicate`);
export const archiveTemplate=id=>api.post(`/templates/${id}/archive`);
export const restoreTemplate=id=>api.post(`/templates/${id}/restore`);
export const getTemplateHistory=id=>api.get(`/templates/${id}/history`);
export const getTemplateCampaigns=id=>api.get(`/templates/${id}/campaigns`);
export const previewTemplate=(id,contactId)=>api.post(`/templates/${id}/preview`,{contactId});
export const bulkPreview=(id,body)=>api.post(`/templates/${id}/bulk-preview`,body);
export const getTemplateVersions=id=>api.get(`/templates/${id}/versions`);
export const previewTemplateVersion=(id,versionId,contactId)=>api.post(`/templates/${id}/versions/${versionId}/preview`,{contactId});
export const restoreTemplateVersion=(id,versionId)=>api.post(`/templates/${id}/restore-version`,{versionId});
export const validateTemplate=id=>api.post(`/templates/${id}/validate`);
export const getTemplateLibrary=()=>api.get('/templates/library');
export const getTemplateVariables=()=>api.get('/templates/variables');
export const getTemplateCategories=()=>api.get('/templates/categories');
export const generateTemplateAI=body=>api.post('/templates/ai/generate',body);
export const rewriteTemplateAI=body=>api.post('/templates/ai/rewrite',body);
export const getTemplateAIStatus=()=>api.get('/templates/ai/status');

export const uploadTemplateMedia=(file,onUploadProgress)=>{
  const formData=new FormData();
  formData.append('media',file);
  return api.post('/template-media',formData,{
    headers:{'Content-Type':'multipart/form-data'},
    onUploadProgress
  });
};

export const deleteTemplateMedia=id=>api.delete(`/template-media/${id}`);
