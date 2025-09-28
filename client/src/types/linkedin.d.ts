interface LinkedInTracking {
  (action: 'track', options: { conversion_id: number }): void;
  q?: any[];
}

declare global {
  interface Window {
    lintrk?: LinkedInTracking;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
  }
}

export {};