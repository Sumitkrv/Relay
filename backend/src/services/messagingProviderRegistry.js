import mockWhatsAppProvider from './mockWhatsAppProvider.js';

class MessagingProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.providers.set('MOCK', mockWhatsAppProvider);
  }

  getProvider(mode = 'MOCK') {
    const normalizedMode = String(mode || '').trim().toUpperCase();

    if (normalizedMode === 'LIVE') {
      const err = new Error('Live WhatsApp Cloud API is disabled in Prompt 5. Official Meta Cloud integration is reserved for Prompt 10. Only MOCK mode is permitted.');
      err.status = 403;
      err.code = 'LIVE_MODE_DISABLED';
      throw err;
    }

    if (normalizedMode === 'DISABLED') {
      const err = new Error('Messaging provider is currently DISABLED by administrator configuration.');
      err.status = 503;
      err.code = 'PROVIDER_DISABLED';
      throw err;
    }

    if (normalizedMode === 'MOCK') {
      return this.providers.get('MOCK');
    }

    const err = new Error(`Unsupported messaging provider mode: "${mode}". Permitted modes: MOCK.`);
    err.status = 400;
    err.code = 'INVALID_PROVIDER_MODE';
    throw err;
  }

  getSupportedModes() {
    return ['MOCK'];
  }

  isLiveEnabled() {
    return false;
  }
}

export default new MessagingProviderRegistry();
