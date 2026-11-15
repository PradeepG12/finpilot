import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExportModal } from './ExportModal';
import { apiClient } from '@/lib/api';
import * as downloadModule from '@/lib/download';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/download', () => ({
  downloadFile: vi.fn(),
}));

const mockCustomerLookup = {
  data: [
    { customer_code: 'C0001', full_name: 'Aarav Sharma', email: 'aarav@test.local' },
    { customer_code: 'C0002', full_name: 'Deepa Patel', email: 'deepa@test.local' },
  ],
};

const mockAccountLookup = {
  data: [
    { account_code: 'A0001', customer_code: 'C0001', account_type: 'BROKERAGE', provider: 'Harbor Investments', status: 'ACTIVE' },
    { account_code: 'A0002', customer_code: 'C0002', account_type: 'MUTUAL_FUND', provider: 'BlueRiver MF', status: 'ACTIVE' },
  ],
};

const renderExportModal = (props: React.ComponentProps<typeof ExportModal>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ExportModal {...props} />
    </QueryClientProvider>
  );
};

describe('ExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/customers/lookup/')) {
        return Promise.resolve({ data: mockCustomerLookup });
      }
      if (url.includes('/accounts/lookup/')) {
        return Promise.resolve({ data: mockAccountLookup });
      }
      if (url.includes('/status/')) {
        return Promise.resolve({
          data: {
            data: {
              uuid: 'test-uuid-1234',
              status: 'COMPLETED',
              file_name: 'finpilot_transactions_2026-11-16.csv',
              row_count: 42,
              can_download: true,
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    (apiClient.post as any).mockResolvedValue({
      data: {
        data: {
          uuid: 'test-uuid-1234',
          status: 'PENDING',
        },
      },
    });
  });

  it('renders modal when open with default transactions export type', async () => {
    renderExportModal({ isOpen: true, onClose: vi.fn() });

    expect(screen.getByRole('heading', { level: 2, name: /export data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transactions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /portfolio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /goals/i })).toBeInTheDocument();
  });

  it('prefills customer and account filters from initialFilters', async () => {
    renderExportModal({
      isOpen: true,
      onClose: vi.fn(),
      initialFilters: {
        exportType: 'portfolio_positions',
        customerCodes: ['C0001'],
        accountCodes: ['A0001'],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('C0001')).toBeInTheDocument();
      expect(screen.getByText('A0001')).toBeInTheDocument();
    });
  });

  it('submits export task to API, polls status, and downloads completed file', async () => {
    renderExportModal({
      isOpen: true,
      onClose: vi.fn(),
      initialFilters: {
        exportType: 'transactions',
        customerCodes: ['C0001'],
        accountCodes: ['A0001'],
        dateFrom: '2026-01-01',
        dateTo: '2026-11-15',
        transactionType: 'BUY',
        status: 'SETTLED',
      },
    });

    const downloadBtn = screen.getByRole('button', { name: /download report/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/exports/', expect.objectContaining({
        export_type: 'transactions',
        customer_codes: ['C0001'],
        account_codes: ['A0001'],
        date_from: '2026-01-01',
        date_to: '2026-11-15',
        transaction_type: ['BUY'],
        status: ['SETTLED'],
      }));
    });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/exports/test-uuid-1234/status/');
      expect(downloadModule.downloadFile).toHaveBeenCalledWith(
        '/exports/test-uuid-1234/download/',
        'finpilot_transactions_2026-11-16.csv'
      );
    });
  });

  it('validates date ranges and disables export if dateFrom > dateTo', async () => {
    renderExportModal({
      isOpen: true,
      onClose: vi.fn(),
      initialFilters: {
        exportType: 'transactions',
        dateFrom: '2026-12-01',
        dateTo: '2026-01-01',
      },
    });

    expect(screen.getByText(/date from cannot be after date to/i)).toBeInTheDocument();
    const downloadBtn = screen.getByRole('button', { name: /download report/i });
    expect(downloadBtn).toBeDisabled();
  });
});
