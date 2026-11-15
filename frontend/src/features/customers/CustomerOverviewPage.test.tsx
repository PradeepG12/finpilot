import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerOverviewPage } from './CustomerOverviewPage';
import { apiClient } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockCustomerDetail = {
  data: {
    id: 1,
    uuid: 'cust-uuid-1',
    customer_code: 'C0001',
    full_name: 'Aarav Sharma',
    email: 'aarav@test.local',
    phone: '+919876543210',
    city: 'Mumbai',
    state: 'MH',
    kyc_status: 'VERIFIED',
    segment: 'HNI',
    accounts_count: 2,
    goals_count: 1,
    risk_profile: {
      risk_score: 75,
      risk_level: 'GROWTH',
      horizon_years: 10,
    },
  },
};

const mockPortfolioResponse = {
  data: {
    customer_code: 'C0001',
    currency: 'INR',
    as_of: {
      snapshot_date: '2026-09-18',
      price_date: '2026-09-18',
      stale: false,
      age_days: 0,
    },
    totals: {
      market_value: '350000.00',
      cost_value: '300000.00',
      unrealised_pl: '50000.00',
      unrealised_pl_pct: '16.67',
    },
    allocation: [],
    accounts: [
      {
        account_code: 'A0001',
        account_type: 'BROKERAGE',
        provider: 'Harbor Investments',
        status: 'ACTIVE',
        opened_at: '2022-01-15',
        totals: {
          market_value: '250000.00',
          cost_value: '200000.00',
          unrealised_pl: '50000.00',
          unrealised_pl_pct: '25.00',
        },
        positions: [
          {
            instrument_code: 'I0001',
            symbol: 'RELIANCE',
            name: 'Reliance Industries',
            asset_class: 'EQUITY',
            quantity: '10.00',
            avg_cost: '2000.00',
            last_price: '2500.00',
            market_value: '25000.00',
            unrealised_pl: '5000.00',
            unrealised_pl_pct: '25.00',
          },
        ],
      },
      {
        account_code: 'A0002',
        account_type: 'MUTUAL_FUND',
        provider: 'BlueRiver MF',
        status: 'ACTIVE',
        opened_at: '2023-05-20',
        totals: {
          market_value: '100000.00',
          cost_value: '100000.00',
          unrealised_pl: '0.00',
          unrealised_pl_pct: '0.00',
        },
        positions: [],
      },
    ],
  },
};

const renderCustomerOverview = (initialEntry = '/customers/C0001') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/customers/:customerCode" element={<CustomerOverviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CustomerOverviewPage route query params and preselection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/portfolio/')) {
        return Promise.resolve({ data: mockPortfolioResponse });
      }
      return Promise.resolve({ data: mockCustomerDetail });
    });
  });

  it('preselects portfolio tab and account from URL query parameters', async () => {
    renderCustomerOverview('/customers/C0001?tab=portfolio&account=A0001');

    await waitFor(() => {
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    });

    // Check that Portfolio tab button has primary border indicating it is active
    const portfolioTabBtn = screen.getByRole('button', { name: /^portfolio$/i });
    expect(portfolioTabBtn).toHaveClass('border-primary');

    // Check that the filtered account banner is displayed
    await waitFor(() => {
      expect(screen.getByText(/viewing filtered account:/i)).toBeInTheDocument();
      expect(screen.getAllByText('A0001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /all accounts/i })).toBeInTheDocument();
    });

    // A0001 is displayed, and A0002 is filtered out
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.queryByText('A0002')).not.toBeInTheDocument();
  });

  it('resets to all accounts when "All Accounts" reset button is clicked', async () => {
    renderCustomerOverview('/customers/C0001?tab=portfolio&account=A0001');

    await waitFor(() => {
      expect(screen.getByText(/viewing filtered account:/i)).toBeInTheDocument();
    });

    const allAccountsBtn = screen.getByRole('button', { name: /all accounts/i });
    fireEvent.click(allAccountsBtn);

    // After reset, both accounts are visible and the filter banner disappears
    await waitFor(() => {
      expect(screen.queryByText(/viewing filtered account:/i)).not.toBeInTheDocument();
      expect(screen.getByText('A0002')).toBeInTheDocument();
    });
  });
});
