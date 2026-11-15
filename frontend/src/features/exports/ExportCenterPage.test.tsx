import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExportCenterPage } from './ExportCenterPage';
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

const mockReportsList = {
  data: {
    count: 2,
    results: [
      {
        uuid: 'rep-001',
        export_type: 'TRANSACTIONS',
        status: 'COMPLETED',
        filters: { customer_codes: ['C0001'] },
        file_name: 'finpilot_transactions_2026-11-16.csv',
        row_count: 10,
        is_downloaded: false,
        can_download: true,
        created: '2026-11-16T10:00:00Z',
      },
      {
        uuid: 'rep-002',
        export_type: 'PORTFOLIO_POSITIONS',
        status: 'PROCESSING',
        filters: {},
        file_name: '',
        row_count: 0,
        is_downloaded: false,
        can_download: false,
        created: '2026-11-16T10:05:00Z',
      },
    ],
  },
};

const renderExportCenter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ExportCenterPage />
    </QueryClientProvider>
  );
};

describe('ExportCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/exports/')) {
        return Promise.resolve({ data: mockReportsList });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('renders page header and export options cards', () => {
    renderExportCenter();

    expect(screen.getByRole('heading', { level: 1, name: /exports/i })).toBeInTheDocument();
    expect(screen.getByText('Download filtered portfolio and transaction data.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create export/i })).toBeInTheDocument();
    expect(screen.getByText('All Exports')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
  });

  it('opens export modal when Create export is clicked', async () => {
    renderExportCenter();

    const createBtn = screen.getByRole('button', { name: /create export/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /export data/i })).toBeInTheDocument();
    });
  });

  it('renders reports list table with status badges and download action', async () => {
    renderExportCenter();

    await waitFor(() => {
      expect(screen.getByText('Generated Reports')).toBeInTheDocument();
      expect(screen.getByText('Ready for Download')).toBeInTheDocument();
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    // Check download button on completed report
    const downloadBtns = screen.getAllByRole('button', { name: /download/i });
    expect(downloadBtns.length).toBeGreaterThan(0);

    fireEvent.click(downloadBtns[0]);
    await waitFor(() => {
      expect(downloadModule.downloadFile).toHaveBeenCalledWith(
        '/exports/rep-001/download/',
        'finpilot_transactions_2026-11-16.csv'
      );
    });
  });
});
