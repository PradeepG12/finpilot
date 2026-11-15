import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountsListPage } from './AccountsListPage';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockAccountsData = {
  data: {
    count: 2,
    next: null,
    previous: null,
    results: [
      {
        id: 1,
        uuid: 'acc-uuid-1',
        account_code: 'A0001',
        customer_code: 'C0001',
        customer_name: 'Aarav Sharma',
        account_type: 'BROKERAGE',
        provider: 'Harbor Investments',
        status: 'ACTIVE',
        opened_at: '2022-01-15',
        current_market_value: '250000.00',
      },
      {
        id: 2,
        uuid: 'acc-uuid-2',
        account_code: 'A0002',
        customer_code: 'C0002',
        customer_name: 'Deepa Patel',
        account_type: 'MUTUAL_FUND',
        provider: 'BlueRiver MF',
        status: 'DORMANT',
        opened_at: '2023-05-20',
        current_market_value: '120000.00',
      },
    ],
  },
};

const mockProvidersData = {
  data: ['BlueRiver MF', 'Harbor Investments'],
};

const renderWithProviders = (initialEntry = '/accounts') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/accounts" element={<AccountsListPage />} />
          <Route path="/customers/:customerCode" element={<div data-testid="customer-overview-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AccountsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/accounts/providers/')) {
        return Promise.resolve({ data: mockProvidersData });
      }
      return Promise.resolve({ data: mockAccountsData });
    });
  });

  it('renders page header and account items correctly', async () => {
    renderWithProviders();

    expect(screen.getByRole('heading', { level: 1, name: /accounts/i })).toBeInTheDocument();
    expect(
      screen.getByText('Browse customer investment accounts and open their current holdings.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('A0001')).toBeInTheDocument();
      expect(screen.getByText('A0002')).toBeInTheDocument();
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      expect(screen.getByText('Deepa Patel')).toBeInTheDocument();
      expect(screen.getAllByText('Harbor Investments').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('BlueRiver MF').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders filter dropdowns and search input', async () => {
    renderWithProviders();

    expect(screen.getByPlaceholderText(/search by account code/i)).toBeInTheDocument();
    expect(screen.getByTitle(/filter by account type/i)).toBeInTheDocument();
    expect(screen.getByTitle(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByTitle(/filter by provider/i)).toBeInTheDocument();
  });

  it('navigates to customer portfolio with preselected account on row or action click', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('A0001')).toBeInTheDocument();
    });

    const viewPortfolioButtons = screen.getAllByRole('button', { name: /view portfolio/i });
    expect(viewPortfolioButtons.length).toBeGreaterThan(0);

    fireEvent.click(viewPortfolioButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('customer-overview-page')).toBeInTheDocument();
    });
  });
});
