// AIDEV-NOTE: Unit tests for mode validation (Task #18 Phase 6)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateCredentialsEnhanced } from '../../src/utils/modeValidation.js';
import type { AppConfig } from '../../src/config/types.js';

describe('Mode Validation', () => {
  let mockConfig: AppConfig;

  beforeEach(() => {
    mockConfig = {
      tradingMode: 'paper',
      lastUsedMode: 'paper',
      credentials: {
        paper: {
          apiKey: 'PK_VALID_PAPER_KEY_1234567890',
          secretKey: 'valid_paper_secret_key_with_sufficient_length_1234567890',
        },
      },
      preferences: {
        alwaysDefaultToPaper: true,
        confirmModeSwitch: true,
      },
    };
  });

  describe('validateCredentialsEnhanced', () => {
    describe('Valid credentials', () => {
      it('should validate correct paper credentials', async () => {
        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate correct live credentials', async () => {
        mockConfig.credentials.live = {
          apiKey: 'AK_VALID_LIVE_KEY_12345678901234567890',
          secretKey: 'valid_live_secret_key_with_sufficient_length_1234567890',
        };

        const result = await validateCredentialsEnhanced('live', mockConfig);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Invalid API key format', () => {
      it('should reject paper credentials with AK prefix', async () => {
        mockConfig.credentials.paper.apiKey = 'AK_WRONG_PREFIX_1234567890';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('paper credentials are invalid or missing');
      });

      it('should reject live credentials with PK prefix', async () => {
        mockConfig.credentials.live = {
          apiKey: 'PK_WRONG_PREFIX_1234567890',
          secretKey: 'valid_live_secret_key_with_sufficient_length_1234567890',
        };

        const result = await validateCredentialsEnhanced('live', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('live credentials are invalid or missing');
      });
    });

    describe('Key length validation', () => {
      it('should reject API key that is too short', async () => {
        mockConfig.credentials.paper.apiKey = 'PK_SHORT';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('too short'))).toBe(true);
      });

      it('should reject secret key that is too short', async () => {
        mockConfig.credentials.paper.secretKey = 'short_secret';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('too short'))).toBe(true);
      });
    });

    describe('Placeholder detection', () => {
      it('should reject API key with YOUR_ placeholder', async () => {
        mockConfig.credentials.paper.apiKey = 'PK_YOUR_API_KEY_HERE_1234567890';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('placeholder'))).toBe(true);
      });

      it('should reject API key with PLACEHOLDER text', async () => {
        mockConfig.credentials.paper.apiKey = 'PK_PLACEHOLDER_KEY_1234567890';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('placeholder'))).toBe(true);
      });

      it('should reject API key with XXXX placeholder', async () => {
        mockConfig.credentials.paper.apiKey = 'PK_XXXXXXXXXXXXXXXXXXXX';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('placeholder'))).toBe(true);
      });

      it('should reject secret key with YOUR_ placeholder', async () => {
        mockConfig.credentials.paper.secretKey = 'YOUR_SECRET_KEY_HERE_WITH_SUFFICIENT_LENGTH';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('placeholder'))).toBe(true);
      });
    });

    describe('Warnings for live mode', () => {
      it('should add warnings when switching to live mode', async () => {
        mockConfig.credentials.live = {
          apiKey: 'AK_VALID_LIVE_KEY_12345678901234567890',
          secretKey: 'valid_live_secret_key_with_sufficient_length_1234567890',
        };

        const result = await validateCredentialsEnhanced('live', mockConfig);

        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some(w => w.includes('LIVE mode'))).toBe(true);
        expect(result.warnings.some(w => w.includes('real money'))).toBe(true);
      });

      it('should not add live warnings for paper mode', async () => {
        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('Missing credentials', () => {
      it('should reject when paper credentials are missing', async () => {
        mockConfig.credentials.paper = {
          apiKey: '',
          secretKey: '',
        };

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('paper credentials are invalid or missing');
      });

      it('should reject when live credentials are not configured', async () => {
        const result = await validateCredentialsEnhanced('live', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('live credentials are invalid or missing');
      });
    });

    describe('Multiple validation errors', () => {
      it('should collect all errors', async () => {
        mockConfig.credentials.paper.apiKey = 'PK_SHORT';
        mockConfig.credentials.paper.secretKey = 'SHORT';

        const result = await validateCredentialsEnhanced('paper', mockConfig);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle credentials with minimum valid length', async () => {
      mockConfig.credentials.paper.apiKey = 'PK_EXACTLY_20_CHARSS';
      mockConfig.credentials.paper.secretKey = 'exactly_40_characters_secret_key_1234567';

      const result = await validateCredentialsEnhanced('paper', mockConfig);

      expect(result.valid).toBe(true);
    });

    it('should handle very long credentials', async () => {
      mockConfig.credentials.paper.apiKey = 'PK_' + 'A'.repeat(100);
      mockConfig.credentials.paper.secretKey = 'B'.repeat(100);

      const result = await validateCredentialsEnhanced('paper', mockConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle credentials with special characters', async () => {
      mockConfig.credentials.paper.apiKey = 'PK_KEY-WITH_SPECIAL.CHARS123';
      mockConfig.credentials.paper.secretKey = 'secret-with_special.chars-1234567890123456789012';

      const result = await validateCredentialsEnhanced('paper', mockConfig);

      expect(result.valid).toBe(true);
    });
  });
});
