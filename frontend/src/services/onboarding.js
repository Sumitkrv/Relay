import api from './api';

/**
 * Checks the user's onboarding status and whether they already have a workspace or draft.
 */
export async function getOnboardingStatus() {
  const { data } = await api.get('/onboarding/status');
  return data;
}

/**
 * Fetches the user's existing draft.
 */
export async function getOnboardingDraft() {
  const { data } = await api.get('/onboarding/draft');
  return data.draft;
}

/**
 * Updates the user's onboarding draft.
 */
export async function updateOnboardingDraft(draftData) {
  const { data } = await api.put('/onboarding/draft', draftData);
  return data.draft;
}

/**
 * Uploads a logo file for the onboarding draft.
 * @param {File} file
 */
export async function uploadOnboardingLogo(file) {
  const formData = new FormData();
  formData.append('logo', file);
  const { data } = await api.post('/onboarding/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

/**
 * Removes the logo from the onboarding draft.
 */
export async function deleteOnboardingLogo() {
  const { data } = await api.delete('/onboarding/logo');
  return data;
}

/**
 * Atomically completes onboarding and provisions the workspace.
 */
export async function completeOnboarding() {
  const { data } = await api.post('/onboarding/complete');
  return data;
}
